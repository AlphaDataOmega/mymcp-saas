import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/Tabs';
import { ToolService } from '../services/ToolService';
import { MarketplaceService } from '../services/MarketplaceService';
import { useTenant } from '../hooks/useTenant';

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
  const [activeTab, setActiveTab] = useState('overview');

  const toolService = new ToolService(tenant?.id || '');
  const marketplaceService = new MarketplaceService(tenant?.id || '');

  useEffect(() => {
    loadAllData();
  }, [tenant?.id]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // Load tools from all sources
      const allTools = await toolService.getAllTools();
      setTools(allTools);

      // Load marketplace data
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
        await loadAllData(); // Refresh data
      }
    } catch (error) {
      console.error('Error installing server:', error);
    }
  };

  const handleToggleTool = async (serverId: string, toolName: string, enabled: boolean) => {
    try {
      await toolService.toggleServerTool(serverId, toolName, enabled);
      await loadAllData(); // Refresh data
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">🔧 Tool Manager</h1>
          <p className="text-muted-foreground mt-2">
            Manage your automation tools, MCP servers, and marketplace integrations
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="text-sm text-muted-foreground">
            {getTotalToolCount()} tools available
          </div>
          <Button 
            onClick={loadAllData}
            variant="outline"
            size="sm"
          >
            🔄 Refresh
          </Button>
        </div>
      </div>

      {/* MCP Server URL */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">📡 MCP Server Integration</h2>
          <p className="text-sm text-muted-foreground">
            Connect external AI tools and IDEs to your automation workspace
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <Input
              value={toolService.getMCPServerUrl()}
              readOnly
              className="font-mono text-sm"
            />
            <Button
              onClick={() => navigator.clipboard.writeText(toolService.getMCPServerUrl())}
              variant="outline"
            >
              📋 Copy URL
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            💡 Use this URL to connect Claude Desktop, Cursor, or other MCP clients
          </p>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">🔀 All Tools</TabsTrigger>
          <TabsTrigger value="installed">📦 Installed</TabsTrigger>
          <TabsTrigger value="config">⚙️ Configuration</TabsTrigger>
        </TabsList>

        {/* All Tools Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Backend Tools */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">🖥️ Backend Tools</h3>
                  <Badge variant="secondary">{tools.backend.length}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {tools.backend.slice(0, 3).map((tool, index) => (
                    <div key={index} className="text-sm">
                      <div className="font-medium">{tool.name}</div>
                      <div className="text-muted-foreground text-xs truncate">
                        {tool.description}
                      </div>
                    </div>
                  ))}
                  {tools.backend.length > 3 && (
                    <div className="text-xs text-muted-foreground">
                      +{tools.backend.length - 3} more...
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Agent Tools */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">🤖 AI Agents</h3>
                  <Badge variant="secondary">{tools.agents.length}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {tools.agents.slice(0, 3).map((tool, index) => (
                    <div key={index} className="text-sm">
                      <div className="font-medium">{tool.name.replace('agent_', '').replace('_', ' ')}</div>
                      <div className="text-muted-foreground text-xs truncate">
                        {tool.description}
                      </div>
                    </div>
                  ))}
                  {tools.agents.length > 3 && (
                    <div className="text-xs text-muted-foreground">
                      +{tools.agents.length - 3} more...
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recorded Tools */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">🎬 Recorded Tools</h3>
                  <Badge variant="secondary">{tools.recorded.length}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {tools.recorded.slice(0, 3).map((tool, index) => (
                    <div key={index} className="text-sm">
                      <div className="font-medium">{tool.name}</div>
                      <div className="text-muted-foreground text-xs truncate">
                        {tool.description}
                      </div>
                    </div>
                  ))}
                  {tools.recorded.length > 3 && (
                    <div className="text-xs text-muted-foreground">
                      +{tools.recorded.length - 3} more...
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Marketplace Tools */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">🏪 Marketplace</h3>
                  <Badge variant="secondary">{installedServers.length}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {installedServers.slice(0, 3).map((server, index) => (
                    <div key={index} className="text-sm">
                      <div className="font-medium">{server.name}</div>
                      <div className="text-muted-foreground text-xs truncate">
                        {server.tools.length} tools
                      </div>
                    </div>
                  ))}
                  {installedServers.length > 3 && (
                    <div className="text-xs text-muted-foreground">
                      +{installedServers.length - 3} more...
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Tool List */}
          <div className="space-y-4">
            {tools.backend.length > 0 && (
              <ToolSection
                title="🖥️ Backend Tools"
                tools={tools.backend}
                onToggleTool={handleToggleTool}
              />
            )}
            
            {tools.agents.length > 0 && (
              <ToolSection
                title="🤖 AI Agents"
                tools={tools.agents}
                onToggleTool={handleToggleTool}
              />
            )}
            
            {tools.recorded.length > 0 && (
              <ToolSection
                title="🎬 Recorded Tools"
                tools={tools.recorded}
                onToggleTool={handleToggleTool}
              />
            )}
          </div>
        </TabsContent>


        {/* Installed Servers Tab */}
        <TabsContent value="installed" className="space-y-6">
          {installedServers.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <div className="text-muted-foreground">
                  <div className="text-4xl mb-4">📦</div>
                  <h3 className="font-semibold mb-2">No installed servers</h3>
                  <p className="text-sm">Browse the marketplace to install MCP servers and tools</p>
                </div>
                <Button
                  onClick={() => window.location.href = '/marketplace'}
                  className="mt-4"
                >
                  🏪 Browse Marketplace
                </Button>
              </CardContent>
            </Card>
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
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="config" className="space-y-6">
          <IDEConfigurationPanel mcpUrl={toolService.getMCPServerUrl()} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Tool Section Component
function ToolSection({ 
  title, 
  tools, 
  onToggleTool 
}: { 
  title: string; 
  tools: Tool[]; 
  onToggleTool: (serverId: string, toolName: string, enabled: boolean) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold">{title}</h3>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {tools.map((tool, index) => (
            <div key={index} className="border rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-medium">{tool.name}</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {tool.description}
                  </p>
                  
                  {tool.inputSchema?.properties && (
                    <div className="mt-3">
                      <div className="text-xs font-medium text-muted-foreground mb-2">Parameters:</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {Object.entries(tool.inputSchema.properties).map(([param, info]: [string, any]) => (
                          <div key={param} className="text-xs">
                            <code className="bg-muted px-1 rounded">{param}</code>
                            <span className="text-muted-foreground ml-1">
                              ({info.type}) - {info.description}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="ml-4">
                  <Badge variant={tool.status === 'enabled' ? 'default' : 'secondary'}>
                    {tool.status || 'available'}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            {server.logoUrl ? (
              <img src={server.logoUrl} alt={server.name} className="w-10 h-10 rounded" />
            ) : (
              <div className="w-10 h-10 bg-muted rounded flex items-center justify-center text-lg">
                🔧
              </div>
            )}
            <div>
              <h3 className="font-semibold">{server.name}</h3>
              <p className="text-sm text-muted-foreground">{server.category}</p>
            </div>
          </div>
          
          {isInstalled ? (
            <Badge variant="default">✅ Installed</Badge>
          ) : (
            <Button
              onClick={() => onInstall(server.id)}
              size="sm"
            >
              Install
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">{server.description}</p>
        
        {server.tags && (
          <div className="flex flex-wrap gap-1 mb-4">
            {server.tags.slice(0, 3).map((tag, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
        
        <div className="text-sm">
          <div><strong>Tools:</strong> {server.tools.length}</div>
          <div><strong>Author:</strong> {server.author}</div>
          <div><strong>Version:</strong> {server.version}</div>
        </div>
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {server.logoUrl ? (
              <img src={server.logoUrl} alt={server.name} className="w-8 h-8 rounded" />
            ) : (
              <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">🔧</div>
            )}
            <div>
              <h3 className="font-semibold">{server.name}</h3>
              <p className="text-sm text-muted-foreground">{server.tools.length} tools</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Badge variant={server.status === 'running' ? 'default' : 'secondary'}>
              {server.status === 'running' ? '🟢 Running' : '🔴 Stopped'}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? '↑' : '↓'}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {expanded && (
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">{server.description}</p>
          
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Available Tools:</h4>
            {server.tools.map((tool, index) => (
              <div key={index} className="flex items-center justify-between py-2 px-3 bg-muted rounded">
                <span className="text-sm">🛠️ {tool}</span>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    defaultChecked={true}
                    onChange={(e) => onToggleTool(server.id, tool, e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-xs text-muted-foreground">enabled</span>
                </label>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
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
    <Card>
      <CardHeader>
        <h3 className="font-semibold">🔧 IDE Integration Setup</h3>
        <p className="text-sm text-muted-foreground">
          Configure MyMCP.me with your AI development environment
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {Object.keys(ideConfigs).map((ide) => (
            <Button
              key={ide}
              variant={selectedIDE === ide ? 'default' : 'outline'}
              onClick={() => setSelectedIDE(ide)}
              className="h-auto py-3"
            >
              {ide}
            </Button>
          ))}
        </div>

        {selectedIDE && (
          <div className="space-y-3">
            <h4 className="font-medium">Configuration for {selectedIDE}</h4>
            <div className="bg-muted p-4 rounded-lg">
              <pre className="text-sm overflow-x-auto">
                {ideConfigs[selectedIDE as keyof typeof ideConfigs].config}
              </pre>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigator.clipboard.writeText(ideConfigs[selectedIDE as keyof typeof ideConfigs].config)}
            >
              📋 Copy Configuration
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}