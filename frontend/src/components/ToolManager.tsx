import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { ToolService } from '../services/ToolService';
import { MarketplaceService } from '../services/MarketplaceService';
import { useTenant } from '../hooks/useTenant';
import { 
  Wrench, 
  Bot, 
  Video, 
  Store, 
  Server, 
  Settings, 
  Copy, 
  RefreshCw, 
  ChevronRight, 
  ChevronDown, 
  Play, 
  Square, 
  Download,
  ExternalLink,
  Code,
  Zap,
  Eye,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Loader2,
  Package
} from 'lucide-react';

interface Tool {
  name: string;
  description: string;
  source: 'backend' | 'agent' | 'recorder' | 'marketplace';
  status?: 'enabled' | 'disabled';
  inputSchema?: any;
  sessionId?: string;
  filename?: string;
  serverId?: string;
}

interface MarketplaceServer {
  id: string;
  name: string;
  description: string;
  category: string;
  author: string;
  version: string;
  status: 'active' | 'installed' | 'running' | 'stopped';
  tools: string[];
  logoUrl?: string;
  tags?: string[];
  repositoryUrl?: string;
  installCommand?: string;
  dockerImage?: string;
  examples?: any[];
}

export function ToolManager() {
  const { tenant } = useTenant();
  const [currentView, setCurrentView] = useState(0); // 0: Overview, 1: Installed, 2: Marketplace, 3: Configuration
  const [tools, setTools] = useState<{
    backend: Tool[];
    agents: Tool[];
    recorded: Tool[];
    marketplace: Tool[];
  }>({
    backend: [],
    agents: [],
    recorded: [],
    marketplace: []
  });
  
  const [marketplaceServers, setMarketplaceServers] = useState<MarketplaceServer[]>([]);
  const [installedServers, setInstalledServers] = useState<MarketplaceServer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [loading, setLoading] = useState(true);

  const toolService = new ToolService(tenant?.id || '');
  const marketplaceService = new MarketplaceService(tenant?.id || '');

  const views = [
    { id: 'overview', title: 'Overview', description: 'All your tools at a glance', icon: Eye },
    { id: 'installed', title: 'Installed', description: 'Manage installed servers', icon: Package },
    { id: 'marketplace', title: 'Marketplace', description: 'Discover new tools', icon: Store },
    { id: 'config', title: 'Configuration', description: 'IDE integration setup', icon: Settings }
  ];

  useEffect(() => {
    loadAllData();
  }, [tenant?.id]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const allTools = await toolService.getAllTools();
      setTools(allTools);

      const [availableServers, installed] = await Promise.all([
        marketplaceService.getAvailableServers(),
        marketplaceService.getInstalledServers()
      ]);

      setMarketplaceServers(availableServers);
      setInstalledServers(installed);
    } catch (error) {
      console.error('Error loading tool data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInstallServer = async (serverId: string) => {
    try {
      const result = await marketplaceService.installServer(serverId);
      if (result.success) {
        await loadAllData();
      }
    } catch (error) {
      console.error('Error installing server:', error);
    }
  };

  const handleToggleTool = async (serverId: string, toolName: string, enabled: boolean) => {
    try {
      await toolService.toggleServerTool(serverId, toolName, enabled);
      await loadAllData();
    } catch (error) {
      console.error('Error toggling tool:', error);
    }
  };

  const getTotalToolCount = () => {
    return tools.backend.length + tools.agents.length + tools.recorded.length + tools.marketplace.length;
  };

  const filteredMarketplaceServers = marketplaceServers.filter(server => {
    const matchesSearch = !searchTerm || 
      server.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      server.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'All' || server.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-lg p-6 min-h-screen">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            <p className="text-gray-300">Loading your tools...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-lg p-6 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
              <Wrench className="w-10 h-10 text-purple-400" />
              Tool Manager
            </h1>
            <p className="text-gray-300">
              Manage your automation tools, MCP servers, and marketplace integrations
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2 text-sm px-4 py-2 rounded-full border transition-all duration-300 bg-blue-500/10 border-blue-500/30 text-blue-400 shadow-lg shadow-blue-500/20">
              <Zap className="w-4 h-4" />
              <span className="font-medium">{getTotalToolCount()} tools available</span>
            </div>
            <button
              onClick={loadAllData}
              disabled={loading}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold py-2 px-4 rounded-xl transition-all duration-300 hover:scale-105"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* View Navigation + Content */}
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Left Column: View Navigation */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <h3 className="text-xl font-bold text-white mb-6">Tool Categories</h3>
            
            <div className="space-y-4">
              {views.map((view, index) => {
                const IconComponent = view.icon;
                return (
                  <div key={view.id} className={`p-4 rounded-lg border transition-all duration-300 cursor-pointer ${ 
                    index === currentView
                      ? 'bg-blue-500/20 border-blue-500/30'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`} onClick={() => setCurrentView(index)}>
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        index === currentView
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-600 text-gray-300'
                      }`}>
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className={`font-medium text-sm ${
                          index === currentView ? 'text-white' : 'text-gray-100'
                        }`}>
                          {view.title}
                        </div>
                        <div className="text-xs text-gray-300">{view.description}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Actions */}
            <div className="mt-6 pt-4 border-t border-white/20">
              <h4 className="text-white font-medium mb-3">Quick Actions</h4>
              <div className="space-y-2">
                <button
                  onClick={() => window.location.href = '/recorder'}
                  className="w-full flex items-center gap-2 p-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  <Video className="w-4 h-4" />
                  Record New Tool
                </button>
                <button
                  onClick={() => setCurrentView(2)}
                  className="w-full flex items-center gap-2 p-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  <Store className="w-4 h-4" />
                  Browse Marketplace
                </button>
              </div>
            </div>
          </div>

          {/* Right Columns: Content Panel (spans 3 columns) */}
          <div className="lg:col-span-3 bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center bg-blue-500 text-white`}>
                  {React.createElement(views[currentView].icon, { className: "w-6 h-6" })}
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">{views[currentView].title}</h3>
                  <p className="text-gray-100 text-base">{views[currentView].description}</p>
                </div>
              </div>
            </div>

            {/* Overview Content */}
            {currentView === 0 && (
              <div className="space-y-6">
                {/* MCP Server Integration Card */}
                <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Server className="w-6 h-6 text-blue-400" />
                    <h3 className="text-xl font-bold text-white">MCP Server Integration</h3>
                  </div>
                  <p className="text-gray-200 mb-4">
                    Connect external AI tools and IDEs to your automation workspace
                  </p>
                  <div className="flex items-center gap-3">
                    <Input
                      value={toolService.getMCPServerUrl()}
                      readOnly
                      className="font-mono text-sm bg-black/20 border-white/20 text-white"
                    />
                    <button
                      onClick={() => navigator.clipboard.writeText(toolService.getMCPServerUrl())}
                      className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                      Copy
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    💡 Use this URL to connect Claude Desktop, Cursor, or other MCP clients
                  </p>
                </div>

                {/* Tool Categories Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  <ToolCategoryCard
                    title="Backend Tools"
                    description="Server-side automation tools"
                    count={tools.backend.length}
                    icon={Server}
                    color="blue"
                    tools={tools.backend}
                  />
                  <ToolCategoryCard
                    title="AI Agents"
                    description="Intelligent automation agents"
                    count={tools.agents.length}
                    icon={Bot}
                    color="purple"
                    tools={tools.agents}
                  />
                  <ToolCategoryCard
                    title="Recorded Tools"
                    description="Browser automation recordings"
                    count={tools.recorded.length}
                    icon={Video}
                    color="green"
                    tools={tools.recorded}
                  />
                  <ToolCategoryCard
                    title="Marketplace"
                    description="Installed marketplace tools"
                    count={installedServers.length}
                    icon={Store}
                    color="orange"
                    tools={[]}
                    servers={installedServers}
                  />
                </div>

                {/* Detailed Tool Lists */}
                <div className="space-y-6">
                  {tools.backend.length > 0 && (
                    <ToolSection
                      title="Backend Tools"
                      tools={tools.backend}
                      icon={Server}
                      color="blue"
                      onToggleTool={handleToggleTool}
                    />
                  )}
                  
                  {tools.agents.length > 0 && (
                    <ToolSection
                      title="AI Agents"
                      tools={tools.agents}
                      icon={Bot}
                      color="purple"
                      onToggleTool={handleToggleTool}
                    />
                  )}
                  
                  {tools.recorded.length > 0 && (
                    <ToolSection
                      title="Recorded Tools"
                      tools={tools.recorded}
                      icon={Video}
                      color="green"
                      onToggleTool={handleToggleTool}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Installed Servers Content */}
            {currentView === 1 && (
              <div className="space-y-6">
                {installedServers.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Package className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-white font-semibold mb-2">No installed servers</h3>
                    <p className="text-gray-400 mb-4">Browse the marketplace to install MCP servers and tools</p>
                    <button
                      onClick={() => setCurrentView(2)}
                      className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300"
                    >
                      <Store className="w-4 h-4 mr-2 inline" />
                      Browse Marketplace
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {installedServers.map((server) => (
                      <InstalledServerCard
                        key={server.id}
                        server={server}
                        onToggleTool={handleToggleTool}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Marketplace Content */}
            {currentView === 2 && (
              <div className="space-y-6">
                {/* Search and Filter */}
                <div className="flex items-center gap-4">
                  <div className="flex-1 relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <Input
                      placeholder="Search marketplace..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 bg-white/10 border-white/20 text-white placeholder-gray-400"
                    />
                  </div>
                  <div className="relative">
                    <Filter className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                    >
                      <option value="All" className="bg-gray-800">All Categories</option>
                      <option value="Development" className="bg-gray-800">Development</option>
                      <option value="Productivity" className="bg-gray-800">Productivity</option>
                      <option value="AI" className="bg-gray-800">AI</option>
                    </select>
                  </div>
                </div>

                {/* Marketplace Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredMarketplaceServers.map((server) => (
                    <MarketplaceServerCard
                      key={server.id}
                      server={server}
                      isInstalled={installedServers.some(s => s.id === server.id)}
                      onInstall={handleInstallServer}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Configuration Content */}
            {currentView === 3 && (
              <div className="space-y-6">
                <IDEConfigurationPanel mcpUrl={toolService.getMCPServerUrl()} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Tool Category Card Component
function ToolCategoryCard({ 
  title, 
  description, 
  count, 
  icon: IconComponent, 
  color, 
  tools,
  servers = []
}: { 
  title: string; 
  description: string; 
  count: number; 
  icon: any; 
  color: string;
  tools: Tool[];
  servers?: MarketplaceServer[];
}) {
  const colorClasses = {
    blue: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30',
    purple: 'from-purple-500/20 to-pink-500/20 border-purple-500/30',
    green: 'from-green-500/20 to-emerald-500/20 border-green-500/30',
    orange: 'from-orange-500/20 to-red-500/20 border-orange-500/30'
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses]} border rounded-xl p-6 hover:scale-105 transition-all duration-300`}>
      <div className="flex items-center justify-between mb-4">
        <IconComponent className="w-8 h-8 text-white" />
        <Badge className="bg-white/20 text-white border-white/30 font-bold">
          {count}
        </Badge>
      </div>
      <h3 className="text-white font-bold text-lg mb-1">{title}</h3>
      <p className="text-gray-200 text-sm mb-3">{description}</p>
      
      {/* Preview items */}
      <div className="space-y-1">
        {(tools.length > 0 ? tools : servers).slice(0, 2).map((item, index) => (
          <div key={index} className="text-xs text-gray-300 truncate">
            • {item.name || `Server ${index + 1}`}
          </div>
        ))}
        {count > 2 && (
          <div className="text-xs text-gray-400">
            +{count - 2} more...
          </div>
        )}
      </div>
    </div>
  );
}

// Tool Section Component
function ToolSection({ 
  title, 
  tools, 
  icon: IconComponent,
  color,
  onToggleTool 
}: { 
  title: string; 
  tools: Tool[];
  icon: any;
  color: string;
  onToggleTool: (serverId: string, toolName: string, enabled: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  
  const colorClasses = {
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    green: 'text-green-400',
    orange: 'text-orange-400'
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <IconComponent className={`w-6 h-6 ${colorClasses[color as keyof typeof colorClasses]}`} />
          <h3 className="text-xl font-bold text-white">{title}</h3>
          <Badge className="bg-white/20 text-white border-white/30">
            {tools.length}
          </Badge>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
        >
          {expanded ? 'Hide' : 'Show All'}
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      <div className={`space-y-3 ${expanded ? '' : 'max-h-48 overflow-hidden'}`}>
        {tools.map((tool, index) => (
          <div key={index} className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-medium text-white">{tool.name}</h4>
                <p className="text-sm text-gray-300 mt-1">
                  {tool.description}
                </p>
                
                {tool.inputSchema?.properties && (
                  <div className="mt-3">
                    <div className="text-xs font-medium text-gray-400 mb-2">Parameters:</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {Object.entries(tool.inputSchema.properties).slice(0, 4).map(([param, info]: [string, any]) => (
                        <div key={param} className="text-xs">
                          <code className="bg-black/30 text-cyan-300 px-1 rounded">{param}</code>
                          <span className="text-gray-400 ml-1">
                            ({info.type})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="ml-4 flex items-center gap-2">
                {tool.status === 'enabled' ? (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-gray-400" />
                )}
                <Badge variant={tool.status === 'enabled' ? 'default' : 'secondary'} className={
                  tool.status === 'enabled' 
                    ? 'bg-green-500/20 text-green-300 border-green-500/30' 
                    : 'bg-gray-500/20 text-gray-300 border-gray-500/30'
                }>
                  {tool.status || 'available'}
                </Badge>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {!expanded && tools.length > 3 && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full mt-4 text-center text-gray-400 hover:text-white transition-colors text-sm"
        >
          Show {tools.length - 3} more tools...
        </button>
      )}
    </div>
  );
}

// Marketplace Server Card Component
function MarketplaceServerCard({ 
  server, 
  isInstalled, 
  onInstall 
}: { 
  server: MarketplaceServer; 
  isInstalled: boolean;
  onInstall: (serverId: string) => void;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all duration-300 hover:scale-105">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          {server.logoUrl ? (
            <img src={server.logoUrl} alt={server.name} className="w-10 h-10 rounded" />
          ) : (
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded flex items-center justify-center text-white font-bold">
              {server.name.charAt(0)}
            </div>
          )}
          <div>
            <h3 className="font-semibold text-white">{server.name}</h3>
            <p className="text-sm text-gray-400">{server.category}</p>
          </div>
        </div>
        
        {isInstalled ? (
          <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
            <CheckCircle className="w-3 h-3 mr-1" />
            Installed
          </Badge>
        ) : (
          <button
            onClick={() => onInstall(server.id)}
            className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 text-sm"
          >
            <Download className="w-3 h-3 mr-1 inline" />
            Install
          </button>
        )}
      </div>
      
      <p className="text-sm text-gray-300 mb-4">{server.description}</p>
      
      {server.tags && (
        <div className="flex flex-wrap gap-1 mb-4">
          {server.tags.slice(0, 3).map((tag, index) => (
            <Badge key={index} variant="outline" className="text-xs bg-white/10 text-gray-300 border-white/20">
              {tag}
            </Badge>
          ))}
        </div>
      )}
      
      <div className="flex items-center justify-between text-sm text-gray-400">
        <span>{server.tools.length} tools</span>
        <span>v{server.version}</span>
      </div>
    </div>
  );
}

// Installed Server Card Component
function InstalledServerCard({ 
  server, 
  onToggleTool 
}: { 
  server: MarketplaceServer;
  onToggleTool: (serverId: string, toolName: string, enabled: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          {server.logoUrl ? (
            <img src={server.logoUrl} alt={server.name} className="w-8 h-8 rounded" />
          ) : (
            <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded flex items-center justify-center text-white font-bold text-sm">
              {server.name.charAt(0)}
            </div>
          )}
          <div>
            <h3 className="font-semibold text-white">{server.name}</h3>
            <p className="text-sm text-gray-400">{server.tools.length} tools</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {server.status === 'running' ? (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-green-400 text-sm font-medium">Running</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-400 rounded-full"></div>
              <span className="text-red-400 text-sm font-medium">Stopped</span>
            </div>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
        </div>
      </div>
      
      {expanded && (
        <div className="border-t border-white/10 pt-4">
          <p className="text-sm text-gray-300 mb-4">{server.description}</p>
          
          <div className="space-y-2">
            <h4 className="font-medium text-sm text-white">Available Tools:</h4>
            {server.tools.map((tool, index) => (
              <div key={index} className="flex items-center justify-between py-2 px-3 bg-white/5 rounded border border-white/10">
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-white">{tool}</span>
                </div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    defaultChecked={true}
                    onChange={(e) => onToggleTool(server.id, tool, e.target.checked)}
                    className="rounded border-white/20 bg-white/10 text-blue-500"
                  />
                  <span className="text-xs text-gray-400">enabled</span>
                </label>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// IDE Configuration Panel Component
function IDEConfigurationPanel({ mcpUrl }: { mcpUrl: string }) {
  const [selectedIDE, setSelectedIDE] = useState<string>('');

  const ideConfigs = {
    'Windsurf': {
      type: 'json',
      config: JSON.stringify({
        mcpServers: {
          mymcp: {
            command: "curl",
            args: [mcpUrl]
          }
        }
      }, null, 2)
    },
    'Cursor': {
      type: 'text',
      config: `Connect to: ${mcpUrl}`
    },
    'Claude Code': {
      type: 'bash',
      config: `claude mcp add MyMCP ${mcpUrl}`
    }
  };

  return (
    <div className="space-y-6">
      {/* IDE Selection */}
      <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Code className="w-6 h-6 text-green-400" />
          <h3 className="text-xl font-bold text-white">IDE Integration Setup</h3>
        </div>
        <p className="text-gray-200 mb-6">
          Configure MyMCP.me with your AI development environment
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {Object.keys(ideConfigs).map((ide) => (
            <button
              key={ide}
              onClick={() => setSelectedIDE(ide)}
              className={`p-4 rounded-xl border transition-all duration-300 ${
                selectedIDE === ide
                  ? 'bg-blue-500/20 border-blue-500/30 text-white'
                  : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-center mb-2">
                <Code className="w-6 h-6" />
              </div>
              <div className="font-medium">{ide}</div>
            </button>
          ))}
        </div>

        {selectedIDE && (
          <div className="space-y-4">
            <h4 className="font-medium text-white">Configuration for {selectedIDE}</h4>
            <div className="bg-black/30 border border-white/20 rounded-lg p-4">
              <pre className="text-sm text-green-300 overflow-x-auto whitespace-pre-wrap">
                {ideConfigs[selectedIDE as keyof typeof ideConfigs].config}
              </pre>
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(ideConfigs[selectedIDE as keyof typeof ideConfigs].config)}
              className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              <Copy className="w-4 h-4" />
              Copy Configuration
            </button>
          </div>
        )}
      </div>

      {/* Additional Resources */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h4 className="font-bold text-white mb-3 flex items-center gap-2">
            <ExternalLink className="w-5 h-5 text-blue-400" />
            Documentation
          </h4>
          <p className="text-gray-300 text-sm mb-4">
            Learn how to integrate MyMCP.me with your favorite development tools.
          </p>
          <button className="text-blue-400 hover:text-blue-300 text-sm font-medium">
            View Integration Docs →
          </button>
        </div>
        
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h4 className="font-bold text-white mb-3 flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-400" />
            API Reference
          </h4>
          <p className="text-gray-300 text-sm mb-4">
            Explore the full MCP API and build custom integrations.
          </p>
          <button className="text-purple-400 hover:text-purple-300 text-sm font-medium">
            View API Docs →
          </button>
        </div>
      </div>
    </div>
  );
}