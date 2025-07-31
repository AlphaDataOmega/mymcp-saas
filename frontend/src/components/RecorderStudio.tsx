// Recorder Studio - Simple workflow: Record → Generate → Name & Save
// No upfront session setup - name and describe tools after generation

import React, { useState, useEffect, useRef } from 'react';
import { useTenant } from '../hooks/useTenant';
import { RecordingService, RecordedAction } from '../services/RecordingService';

interface RecorderStudioProps {
  onNavigateToAgent?: () => void;
  onNavigateToTools?: () => void;
}

export function RecorderStudio({ onNavigateToAgent, onNavigateToTools }: RecorderStudioProps) {
  const { tenant } = useTenant();
  const [recordingService] = useState(() => new RecordingService(tenant?.id || ''));
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [actions, setActions] = useState<RecordedAction[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connected' | 'error'>('disconnected');
  const [recordingTime, setRecordingTime] = useState(0);
  
  // Code generation state
  const [generatedCode, setGeneratedCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState('');
  
  // Tool naming state (after generation)
  const [showNamingModal, setShowNamingModal] = useState(false);
  const [toolName, setToolName] = useState('');
  const [toolDescription, setToolDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Refs
  const recordingInterval = useRef<NodeJS.Timeout | null>(null);
  const actionPollingInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    checkBrowserConnection();
    loadCurrentSession();
    
    // Set up periodic connection checking
    const connectionCheck = setInterval(checkBrowserConnection, 5000);
    
    return () => {
      clearInterval(connectionCheck);
      if (recordingInterval.current) clearInterval(recordingInterval.current);
      if (actionPollingInterval.current) clearInterval(actionPollingInterval.current);
    };
  }, []);

  const checkBrowserConnection = async () => {
    try {
      const status = await recordingService.getBrowserConnectionStatus();
      setConnectionStatus(status.connected ? 'connected' : 'disconnected');
    } catch (error) {
      setConnectionStatus('error');
    }
  };

  const loadCurrentSession = async () => {
    try {
      // Check if there's an active recording session
      const sessions = await recordingService.getSessions();
      const activeSession = sessions.find(s => s.status === 'recording');
      
      if (activeSession) {
        setActions(activeSession.actions);
        setIsRecording(true);
        setRecordingTime(Date.now() - activeSession.startTime);
        startActionPolling();
        startRecordingTimer();
      } else {
        // Load the latest completed session for code generation
        const latestSession = sessions[0];
        if (latestSession && latestSession.actions.length > 0) {
          setActions(latestSession.actions);
        }
      }
    } catch (error) {
      console.error('Failed to load current session:', error);
    }
  };

  const startRecording = async () => {
    if (connectionStatus !== 'connected') {
      alert('Browser extension is not connected. Please install and connect the browser extension.');
      return;
    }

    try {
      // Start recording with a simple timestamp-based name
      const sessionName = `Recording_${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}`;
      await recordingService.startRecording(sessionName, '');
      
      setIsRecording(true);
      setActions([]);
      setRecordingTime(0);
      setGeneratedCode('');
      setGenerationError('');
      
      // Start polling for actions and timer
      startActionPolling();
      startRecordingTimer();
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Failed to start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    try {
      await recordingService.stopRecording();
      setIsRecording(false);
      
      // Stop polling and timer
      if (actionPollingInterval.current) {
        clearInterval(actionPollingInterval.current);
        actionPollingInterval.current = null;
      }
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
        recordingInterval.current = null;
      }
      
    } catch (error) {
      console.error('Failed to stop recording:', error);
      alert('Failed to stop recording. Please try again.');
    }
  };

  const startActionPolling = () => {
    if (actionPollingInterval.current) return;
    
    actionPollingInterval.current = setInterval(async () => {
      try {
        // Get the latest session (should be the active one)
        const sessions = await recordingService.getSessions();
        const latestSession = sessions[0];
        if (latestSession) {
          setActions(latestSession.actions);
        }
      } catch (error) {
        console.error('Failed to poll actions:', error);
      }
    }, 1000); // Poll every second
  };

  const startRecordingTimer = () => {
    if (recordingInterval.current) return;
    
    recordingInterval.current = setInterval(() => {
      setRecordingTime(prev => prev + 1000);
    }, 1000);
  };

  const generateCode = async () => {
    if (actions.length === 0) {
      alert('No actions recorded to generate code from');
      return;
    }

    setIsGenerating(true);
    setGeneratedCode('');
    setGenerationError('');

    try {
      // Generate code from the latest session
      const code = await recordingService.generateTool();
      setGeneratedCode(code);
      
      // Auto-suggest tool name based on actions
      const suggestedName = generateToolNameFromActions(actions);
      setToolName(suggestedName);
      setToolDescription(`Automation tool with ${actions.length} recorded actions`);
      
    } catch (error) {
      console.error('Failed to generate code:', error);
      setGenerationError(error instanceof Error ? error.message : 'Failed to generate code');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateToolNameFromActions = (actions: RecordedAction[]): string => {
    // Simple heuristic to suggest a tool name based on actions
    const hasLogin = actions.some(a => 
      a.description.toLowerCase().includes('login') || 
      a.description.toLowerCase().includes('sign in') ||
      a.selector?.toLowerCase().includes('password')
    );
    
    const hasForm = actions.some(a => 
      a.type === 'type' || 
      a.description.toLowerCase().includes('submit') ||
      a.description.toLowerCase().includes('form')
    );
    
    const hasNavigation = actions.some(a => a.type === 'navigate');
    
    if (hasLogin) return 'login_automation';
    if (hasForm) return 'form_filler';
    if (hasNavigation) return 'web_navigator';
    return 'browser_automation';
  };

  const saveGeneratedTool = async () => {
    if (!toolName.trim()) {
      alert('Please enter a tool name');
      return;
    }

    setIsSaving(true);
    try {
      await recordingService.saveGeneratedTool(toolName, toolDescription, generatedCode);
      setShowNamingModal(false);
      alert(`Tool "${toolName}" saved successfully!`);
      
      // Clear the current work
      setGeneratedCode('');
      setActions([]);
      setToolName('');
      setToolDescription('');
      
    } catch (error) {
      console.error('Failed to save tool:', error);
      alert('Failed to save tool. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'navigate': return '🧭';
      case 'click': return '🖱️';
      case 'type': return '⌨️';
      case 'scroll': return '📜';
      case 'wait': return '⏱️';
      case 'screenshot': return '📸';
      default: return '🔧';
    }
  };

  const getConnectionStatusDisplay = () => {
    switch (connectionStatus) {
      case 'connected':
        return <span className="text-green-400">✅ Connected</span>;
      case 'disconnected':
        return <span className="text-yellow-400">⚠️ Disconnected</span>;
      case 'error':
        return <span className="text-red-400">❌ Error</span>;
      default:
        return <span className="text-gray-400">🔄 Checking...</span>;
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-lg p-6 min-h-full">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            🎬 Recording Studio
          </h1>
          <p className="text-gray-300">
            Record → Generate → Name & Save your automation tools
          </p>
        </div>

        {/* Connection Status */}
        <div className="mb-6 p-4 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold">Browser Extension Status</h3>
              <p className="text-gray-300 text-sm">Extension must be connected to record actions</p>
            </div>
            <div className="text-right">
              {getConnectionStatusDisplay()}
              {connectionStatus === 'disconnected' && (
                <p className="text-sm text-gray-400 mt-1">Install browser extension to continue</p>
              )}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column: Simple Recording Control */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <h3 className="text-xl font-bold text-white mb-6">Recording Control</h3>
            
            {!isRecording ? (
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-r from-red-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-3xl">🎬</span>
                </div>
                <p className="text-gray-300 mb-6">
                  Ready to record browser actions
                </p>
                <button
                  onClick={startRecording}
                  disabled={connectionStatus !== 'connected'}
                  className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all duration-300 ${
                    connectionStatus === 'connected'
                      ? 'bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white hover:scale-105'
                      : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  🔴 Start Recording
                </button>
                {connectionStatus !== 'connected' && (
                  <p className="text-sm text-gray-400 mt-3">
                    Connect browser extension first
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center">
                <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-3xl animate-pulse">🔴</span>
                </div>
                <h4 className="text-white font-bold text-lg mb-2">Recording Active</h4>
                <p className="text-cyan-400 font-mono text-2xl mb-6">{formatTime(recordingTime)}</p>
                <p className="text-gray-300 mb-6">
                  Navigate and interact with websites.<br/>
                  Your actions are being captured.
                </p>
                <button
                  onClick={stopRecording}
                  className="w-full bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 hover:scale-105"
                >
                  ⏹️ Stop Recording
                </button>
              </div>
            )}

            {/* Quick Stats */}
            {actions.length > 0 && (
              <div className="mt-6 p-4 bg-cyan-500/20 border border-cyan-500/30 rounded-lg">
                <h4 className="text-cyan-300 font-semibold mb-2">Current Session</h4>
                <p className="text-white">{actions.length} actions recorded</p>
                <p className="text-gray-300 text-sm">Ready to generate automation tool</p>
              </div>
            )}
          </div>

          {/* Middle Column: Live Action Feed */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <h3 className="text-xl font-bold text-white mb-4">
              Actions ({actions.length})
            </h3>
            
            {actions.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">📝</span>
                </div>
                <p className="text-gray-400">No actions recorded yet</p>
                <p className="text-sm text-gray-500 mt-2">Start recording to see actions here</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {actions.map((action, index) => (
                  <div
                    key={`${action.timestamp}-${index}`}
                    className="p-3 bg-white/5 rounded-lg border border-white/10"
                  >
                    <div className="flex items-start space-x-3">
                      <span className="text-xl">{getActionIcon(action.type)}</span>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <h4 className="text-white font-medium">{action.description}</h4>
                          <span className="text-xs text-gray-400">
                            #{index + 1}
                          </span>
                        </div>
                        {action.selector && (
                          <p className="text-gray-400 text-sm mt-1">
                            <code className="bg-black/20 px-1 rounded">{action.selector}</code>
                          </p>
                        )}
                        {action.text && (
                          <p className="text-gray-400 text-sm mt-1">
                            "<code className="bg-black/20 px-1 rounded">{action.text}</code>"
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Code Generation */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <h3 className="text-xl font-bold text-white mb-4">Generate Tool</h3>
            
            <div className="space-y-4">
              <button
                onClick={generateCode}
                disabled={actions.length === 0 || isGenerating}
                className={`w-full py-3 px-4 rounded-lg font-bold transition-all duration-300 ${
                  actions.length > 0 && !isGenerating
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isGenerating ? '🔄 Generating...' : '✨ Generate Tool Code'}
              </button>

              {generationError && (
                <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                  <p className="text-red-400 text-sm">{generationError}</p>
                </div>
              )}

              {generatedCode && (
                <div className="space-y-3">
                  <div className="bg-black/20 rounded-lg p-4 max-h-64 overflow-y-auto">
                    <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap">
                      {generatedCode.slice(0, 500)}...
                    </pre>
                  </div>
                  
                  <div className="flex space-x-3">
                    <button
                      onClick={() => navigator.clipboard.writeText(generatedCode)}
                      className="flex-1 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300"
                    >
                      📋 Copy
                    </button>
                    <button
                      onClick={() => setShowNamingModal(true)}
                      className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300"
                    >
                      💾 Save Tool
                    </button>
                  </div>

                  {onNavigateToAgent && (
                    <button
                      onClick={onNavigateToAgent}
                      className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300"
                    >
                      🤖 Use in Agent Chat
                    </button>
                  )}
                </div>
              )}

              {!generatedCode && actions.length > 0 && (
                <div className="p-4 bg-cyan-500/20 border border-cyan-500/30 rounded-lg">
                  <p className="text-cyan-300 text-sm">
                    💡 {actions.length} actions ready! Click "Generate Tool Code" to create your automation.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tool Naming Modal */}
        {showNamingModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full border border-white/20">
              <h3 className="text-xl font-bold text-white mb-4">Name Your Tool</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Tool Name *
                  </label>
                  <input
                    type="text"
                    value={toolName}
                    onChange={(e) => setToolName(e.target.value)}
                    placeholder="e.g., login_automation"
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={toolDescription}
                    onChange={(e) => setToolDescription(e.target.value)}
                    placeholder="What does this automation do?"
                    rows={3}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                </div>
                
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowNamingModal(false)}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveGeneratedTool}
                    disabled={!toolName.trim() || isSaving}
                    className={`flex-1 font-bold py-2 px-4 rounded-lg transition-all duration-300 ${
                      toolName.trim() && !isSaving
                        ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white'
                        : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {isSaving ? 'Saving...' : 'Save Tool'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}