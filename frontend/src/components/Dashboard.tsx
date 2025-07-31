// Dashboard - Main user overview with automation stats and recent activity
// Modern landing page for username.mymcp.me showing personalized automation workspace

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '../hooks/useTenant';
import { RecordingService, RecordingSession } from '../services/RecordingService';
import { ToolService } from '../services/ToolService';
import { BillingService, UsageRecord } from '../services/BillingService';

interface DashboardProps {
  onNavigateToRecorder?: () => void;
  onNavigateToTools?: () => void;
}

interface DashboardStats {
  recordedSessions: number;
  toolsCreated: number;
  executionsThisWeek: number;
  activeAgents: number;
  connectionStatus: 'connected' | 'disconnected' | 'error';
}

interface RecentActivity {
  id: string;
  type: 'recording' | 'tool_generated' | 'agent_execution' | 'tool_execution';
  title: string;
  description: string;
  timestamp: string;
  status: 'completed' | 'running' | 'failed';
  icon: string;
}

export function Dashboard({ onNavigateToRecorder, onNavigateToTools }: DashboardProps) {
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const [recordingService] = useState(() => new RecordingService(tenant?.id || ''));
  const [toolService] = useState(() => new ToolService(tenant?.id || ''));
  const [billingService] = useState(() => new BillingService(tenant?.id || ''));
  
  // Dashboard state
  const [stats, setStats] = useState<DashboardStats>({
    recordedSessions: 0,
    toolsCreated: 0,
    executionsThisWeek: 0,
    activeAgents: 0,
    connectionStatus: 'disconnected'
  });
  
  const [recentSessions, setRecentSessions] = useState<RecordingSession[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [usageData, setUsageData] = useState<UsageRecord | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Quick actions state
  const [quickRecording, setQuickRecording] = useState(false);
  const [archonPanelOpen, setArchonPanelOpen] = useState(false);
  const [toolsModalOpen, setToolsModalOpen] = useState(false);

  useEffect(() => {
    loadDashboardData();
    
    // Refresh data every 30 seconds
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load all dashboard data in parallel
      const [sessions, tools, usage, connectionStatus] = await Promise.all([
        recordingService.getSessions(),
        toolService.getAllTools(),
        billingService.getCurrentUsage(),
        toolService.testMCPConnection()
      ]);

      // Calculate stats
      const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const recentSessions = sessions.filter(s => new Date(s.startTime).getTime() > weekAgo);
      
      setStats({
        recordedSessions: sessions.length,
        toolsCreated: tools.recorderTools.length + tools.agentTools.length,
        executionsThisWeek: usage?.agentExecutions || 0,
        activeAgents: tools.agentTools.length,
        connectionStatus: connectionStatus.connected ? 'connected' : 'disconnected'
      });
      
      setRecentSessions(sessions.slice(0, 3));
      setUsageData(usage);
      
      // Generate recent activity
      const activity = generateRecentActivity(sessions.slice(0, 5), tools.recorderTools.slice(0, 3));
      setRecentActivity(activity);
      
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateRecentActivity = (sessions: RecordingSession[], tools: any[]): RecentActivity[] => {
    const activities: RecentActivity[] = [];
    
    // Add recent recording sessions
    sessions.forEach(session => {
      activities.push({
        id: session.id,
        type: 'recording',
        title: session.name,
        description: `${session.actions.length} actions recorded`,
        timestamp: new Date(session.startTime).toISOString(),
        status: session.status === 'completed' ? 'completed' : session.status === 'recording' ? 'running' : 'failed',
        icon: '🎬'
      });
    });
    
    // Add recent tool generations
    tools.forEach(tool => {
      activities.push({
        id: tool.name,
        type: 'tool_generated',
        title: `Generated ${tool.name}`,
        description: tool.description || 'Browser automation tool',
        timestamp: new Date().toISOString(), // Mock timestamp
        status: 'completed',
        icon: '🔧'
      });
    });
    
    // Sort by timestamp and return latest 5
    return activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);
  };

  const handleQuickRecord = async () => {
    if (stats.connectionStatus !== 'connected') {
      alert('Browser extension is not connected. Please install and connect the extension first.');
      return;
    }
    
    setQuickRecording(true);
    try {
      const sessionName = `Quick_Recording_${new Date().toISOString().slice(11, 19).replace(/:/g, '-')}`;
      await recordingService.startRecording(sessionName, 'Quick recording from dashboard');
      
      // Navigate to recorder
      if (onNavigateToRecorder) {
        onNavigateToRecorder();
      }
    } catch (error) {
      console.error('Failed to start quick recording:', error);
      alert('Failed to start recording. Please try again.');
    } finally {
      setQuickRecording(false);
    }
  };

  const getConnectionStatusDisplay = () => {
    switch (stats.connectionStatus) {
      case 'connected':
        return { text: '✅ Connected', color: 'text-green-400' };
      case 'disconnected':
        return { text: '⚠️ Disconnected', color: 'text-yellow-400' };
      case 'error':
        return { text: '❌ Error', color: 'text-red-400' };
      default:
        return { text: '🔄 Checking...', color: 'text-gray-400' };
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = Date.now();
    const time = new Date(timestamp).getTime();
    const diffInMinutes = Math.floor((now - time) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const getActivityStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400';
      case 'running': return 'text-cyan-400';
      case 'failed': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getUsagePercentage = (used: number, limit: number) => {
    if (limit === -1) return 0; // Unlimited
    return Math.min((used / limit) * 100, 100);
  };

  const connectionStatus = getConnectionStatusDisplay();

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-lg p-6 min-h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Loading your automation workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-lg h-[calc(100vh-8rem)] relative flex flex-col">
      
      {/* Connected Tools Stat Button - Top Right */}
      <button
        onClick={() => setToolsModalOpen(true)}
        className="absolute top-4 right-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-300 hover:scale-105 shadow-lg text-sm z-10"
      >
        🔧 {stats.toolsCreated} Connected Tools
      </button>

      {/* Maestro Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-sm">M</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Maestro</h2>
            <p className="text-sm text-gray-400">Tool Orchestrator</p>
          </div>
        </div>
      </div>
      
      {/* Chat Messages Area - Takes remaining space */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-4">
          {/* Welcome message */}
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <div className="bg-white/10 rounded-lg p-4 max-w-md">
              <p className="text-white">
                👋 Hi there! I'm Maestro, your Tool Orchestrator. I can help you use your automation tools, execute workflows, and get things done. What would you like to accomplish today?
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Chat Input - Fixed at Bottom */}
      <div className="p-4 border-t border-white/10">
        <div className="flex space-x-2">
          <input
            type="text"
            placeholder="Ask Maestro to orchestrate your tools..."
            className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500"
          />
          <button className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white px-6 py-3 rounded-lg font-medium transition-all duration-300">
            Send
          </button>
          <button
            onClick={() => setArchonPanelOpen(!archonPanelOpen)}
            className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white px-4 py-3 rounded-lg font-medium transition-all duration-300"
            title="Open Archon Builder"
          >
            🔧
          </button>
        </div>
      </div>

      {/* Archon Drawer - Right Side Slide In */}
      <div className={`fixed top-0 right-0 bottom-0 w-96 bg-black/90 backdrop-blur-lg border-l border-white/10 transition-transform duration-300 ${
        archonPanelOpen ? 'translate-x-0' : 'translate-x-full'
      } flex flex-col z-20`}>
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Archon</h2>
                <p className="text-sm text-gray-400">System AI for building tools & agents</p>
              </div>
            </div>
            <button
              onClick={() => setArchonPanelOpen(false)}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
        
        {/* Archon Chat Messages */}
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <div className="bg-white/10 rounded-lg p-4 max-w-md">
                <p className="text-white">
                  🔧 I'm Archon, the system builder. I can create new tools, set up MCP servers, build agents, and configure your automation infrastructure. What would you like me to build?
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Archon Chat Input */}
        <div className="p-4 border-t border-white/10">
          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="Tell Archon what to build..."
              className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 text-sm"
            />
            <button className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-all duration-300 text-sm">
              Build
            </button>
          </div>
        </div>
      </div>

      {/* Tools Modal */}
      {toolsModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-xl border border-white/20 w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">🔧 Connected Tools</h2>
                <button
                  onClick={() => setToolsModalOpen(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
              <p className="text-gray-400 text-sm mt-2">Enable or disable tools available to Maestro</p>
            </div>

            {/* Modal Content */}
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="space-y-4">
                {/* Backend Tools */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">🖥️ Backend Tools</h3>
                  <div className="space-y-2">
                    {['file_operations', 'web_scraper', 'data_processor', 'api_connector'].map((tool) => (
                      <div key={tool} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                        <div>
                          <div className="font-medium text-white">{tool.replace('_', ' ')}</div>
                          <div className="text-sm text-gray-400">System tool for automation</div>
                        </div>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            defaultChecked={true}
                            className="w-4 h-4 rounded"
                          />
                          <span className="text-sm text-gray-400">enabled</span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recorded Tools */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">🎬 Recorded Tools</h3>
                  <div className="space-y-2">
                    {['login_automation', 'form_filler', 'data_extractor'].map((tool) => (
                      <div key={tool} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                        <div>
                          <div className="font-medium text-white">{tool.replace('_', ' ')}</div>
                          <div className="text-sm text-gray-400">Browser automation tool</div>
                        </div>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            defaultChecked={true}
                            className="w-4 h-4 rounded"
                          />
                          <span className="text-sm text-gray-400">enabled</span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Agent Tools */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">🤖 Agent Tools</h3>
                  <div className="space-y-2">
                    {['email_assistant', 'calendar_manager', 'task_scheduler'].map((tool) => (
                      <div key={tool} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                        <div>
                          <div className="font-medium text-white">{tool.replace('_', ' ')}</div>
                          <div className="text-sm text-gray-400">AI agent workflow</div>
                        </div>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            defaultChecked={true}
                            className="w-4 h-4 rounded"
                          />
                          <span className="text-sm text-gray-400">enabled</span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-white/10">
              <div className="flex justify-between">
                <button
                  onClick={() => setToolsModalOpen(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setToolsModalOpen(false)}
                  className="px-6 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white rounded-lg font-medium transition-all duration-300"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}