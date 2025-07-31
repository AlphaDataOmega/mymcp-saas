import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { MarketplaceService } from '../services/MarketplaceService';
import { useTenant } from '../hooks/useTenant';

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
  downloads?: number;
  rating?: number;
  lastUpdated?: string;
}

export function Marketplace() {
  const { tenant } = useTenant();
  const [marketplaceServers, setMarketplaceServers] = useState<MarketplaceServer[]>([]);
  const [installedServers, setInstalledServers] = useState<MarketplaceServer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [sortBy, setSortBy] = useState('popular');
  const [loading, setLoading] = useState(true);
  const [installLoading, setInstallLoading] = useState<string | null>(null);

  const marketplaceService = new MarketplaceService(tenant?.id || '');

  useEffect(() => {
    loadMarketplaceData();
  }, [tenant?.id]);

  const loadMarketplaceData = async () => {
    setLoading(true);
    try {
      const [availableServers, installed] = await Promise.all([
        marketplaceService.getAvailableServers(),
        marketplaceService.getInstalledServers()
      ]);

      setMarketplaceServers(availableServers);
      setInstalledServers(installed);
    } catch (error) {
      console.error('Error loading marketplace data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInstallServer = async (serverId: string) => {
    setInstallLoading(serverId);
    try {
      const result = await marketplaceService.installServer(serverId);
      if (result.success) {
        await loadMarketplaceData(); // Refresh data
      }
    } catch (error) {
      console.error('Error installing server:', error);
    } finally {
      setInstallLoading(null);
    }
  };

  const filteredAndSortedServers = marketplaceServers
    .filter(server => {
      const matchesSearch = !searchTerm || 
        server.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        server.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        server.tools.some(tool => tool.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesCategory = categoryFilter === 'All' || server.category === categoryFilter;
      
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'popular':
          return (b.downloads || 0) - (a.downloads || 0);
        case 'recent':
          return new Date(b.lastUpdated || '').getTime() - new Date(a.lastUpdated || '').getTime();
        case 'rating':
          return (b.rating || 0) - (a.rating || 0);
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

  const categories = ['All', ...new Set(marketplaceServers.map(server => server.category))];

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
          <h1 className="text-3xl font-bold text-foreground">🏪 Marketplace</h1>
          <p className="text-muted-foreground mt-2">
            Discover and install MCP servers, tools, and automation workflows
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="text-sm text-muted-foreground">
            {filteredAndSortedServers.length} servers available
          </div>
          <Button 
            onClick={loadMarketplaceData}
            variant="outline"
            size="sm"
          >
            🔄 Refresh
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search servers, tools, or descriptions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>
        
        <div className="flex gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border rounded-md bg-background min-w-[120px]"
          >
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border rounded-md bg-background min-w-[120px]"
          >
            <option value="popular">Most Popular</option>
            <option value="recent">Recently Updated</option>
            <option value="rating">Highest Rated</option>
            <option value="name">Name A-Z</option>
          </select>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{marketplaceServers.length}</div>
            <div className="text-sm text-muted-foreground">Available Servers</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{installedServers.length}</div>
            <div className="text-sm text-muted-foreground">Installed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">
              {marketplaceServers.reduce((sum, server) => sum + server.tools.length, 0)}
            </div>
            <div className="text-sm text-muted-foreground">Total Tools</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{categories.length - 1}</div>
            <div className="text-sm text-muted-foreground">Categories</div>
          </CardContent>
        </Card>
      </div>

      {/* Marketplace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredAndSortedServers.map((server) => (
          <MarketplaceServerCard
            key={server.id}
            server={server}
            isInstalled={installedServers.some(s => s.id === server.id)}
            isInstalling={installLoading === server.id}
            onInstall={handleInstallServer}
          />
        ))}
      </div>

      {filteredAndSortedServers.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <div className="text-muted-foreground">
              <div className="text-4xl mb-4">🔍</div>
              <h3 className="font-semibold mb-2">No servers found</h3>
              <p className="text-sm">Try adjusting your search terms or filters</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Marketplace Server Card Component
function MarketplaceServerCard({ 
  server, 
  isInstalled, 
  isInstalling,
  onInstall 
}: { 
  server: MarketplaceServer; 
  isInstalled: boolean;
  isInstalling: boolean;
  onInstall: (serverId: string) => void;
}) {
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown';
    return new Date(dateStr).toLocaleDateString();
  };

  const formatDownloads = (downloads?: number) => {
    if (!downloads) return '0';
    if (downloads > 1000) return `${(downloads / 1000).toFixed(1)}k`;
    return downloads.toString();
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            {server.logoUrl ? (
              <img src={server.logoUrl} alt={server.name} className="w-12 h-12 rounded-lg" />
            ) : (
              <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center text-xl">
                🔧
              </div>
            )}
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{server.name}</h3>
              <p className="text-sm text-muted-foreground">by {server.author}</p>
              <div className="flex items-center space-x-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {server.category}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  v{server.version}
                </Badge>
                {server.rating && (
                  <div className="flex items-center text-xs text-muted-foreground">
                    ⭐ {server.rating.toFixed(1)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">{server.description}</p>
        
        {/* Tools Preview */}
        <div className="mb-4">
          <div className="text-sm font-medium mb-2">Tools ({server.tools.length}):</div>
          <div className="flex flex-wrap gap-1">
            {server.tools.slice(0, 3).map((tool, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {tool}
              </Badge>
            ))}
            {server.tools.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{server.tools.length - 3} more
              </Badge>
            )}
          </div>
        </div>

        {/* Tags */}
        {server.tags && server.tags.length > 0 && (
          <div className="mb-4">
            <div className="flex flex-wrap gap-1">
              {server.tags.slice(0, 4).map((tag, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  #{tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {/* Stats */}
        <div className="flex justify-between items-center text-xs text-muted-foreground mb-4">
          <span>📥 {formatDownloads(server.downloads)} downloads</span>
          <span>📅 {formatDate(server.lastUpdated)}</span>
        </div>
        
        {/* Actions */}
        <div className="flex space-x-2">
          {isInstalled ? (
            <Button disabled className="flex-1" variant="outline">
              ✅ Installed
            </Button>
          ) : (
            <Button 
              onClick={() => onInstall(server.id)}
              disabled={isInstalling}
              className="flex-1"
            >
              {isInstalling ? '⏳ Installing...' : '📦 Install'}
            </Button>
          )}
          
          {server.repositoryUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(server.repositoryUrl, '_blank')}
              className="px-3"
            >
              📖
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}