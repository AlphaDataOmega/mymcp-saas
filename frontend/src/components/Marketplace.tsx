import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { backendMarketplaceService, BackendMCP, BackendCategory } from '../services/BackendMarketplaceService';
import { MarketplaceService } from '../services/MarketplaceService';
import { useTenant } from '../hooks/useTenant';
import { 
  Store, 
  Search, 
  Filter, 
  Download,
  CheckCircle,
  RefreshCw,
  Star,
  Calendar,
  Users,
  Package,
  ExternalLink,
  Loader2,
  TrendingUp,
  Clock,
  Award,
  AlphabeticalIcon as SortAsc,
  Eye,
  Tag,
  Grid3X3,
  BookOpen,
  Zap,
  Server,
  Code,
  Wrench
} from 'lucide-react';

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
      <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-lg p-6 min-h-screen">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            <p className="text-gray-300">Loading marketplace...</p>
          </div>
        </div>
      </div>
    );
  }

  const views = [
    { id: 'featured', title: 'Featured', description: 'Curated selection of top servers', icon: Award },
    { id: 'categories', title: 'Categories', description: 'Browse by functionality', icon: Grid3X3 },
    { id: 'trending', title: 'Trending', description: 'Most popular downloads', icon: TrendingUp },
    { id: 'installed', title: 'My Tools', description: 'Your installed servers', icon: Package }
  ];

  return (
    <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-lg p-6 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
              <Store className="w-10 h-10 text-purple-400" />
              Marketplace
            </h1>
            <p className="text-gray-300">
              Discover and install MCP servers, tools, and automation workflows
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2 text-sm px-4 py-2 rounded-full border transition-all duration-300 bg-purple-500/10 border-purple-500/30 text-purple-400 shadow-lg shadow-purple-500/20">
              <Package className="w-4 h-4" />
              <span className="font-medium">{filteredAndSortedServers.length} servers available</span>
            </div>
            <button
              onClick={loadMarketplaceData}
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
          {/* Left Column: Category Navigation */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <h3 className="text-xl font-bold text-white mb-6">Browse Categories</h3>
            
            <div className="space-y-3">
              {categories.map((category, index) => {
                const isActive = category === categoryFilter;
                const count = category === 'All' 
                  ? marketplaceServers.length 
                  : marketplaceServers.filter(s => s.category === category).length;
                
                return (
                  <div key={category} className={`p-3 rounded-lg border transition-all duration-300 cursor-pointer ${ 
                    isActive
                      ? 'bg-purple-500/20 border-purple-500/30'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`} onClick={() => setCategoryFilter(category)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          isActive
                            ? 'bg-purple-500 text-white'
                            : 'bg-gray-600 text-gray-300'
                        }`}>
                          {getCategoryIcon(category)}
                        </div>
                        <div className={`font-medium text-sm ${
                          isActive ? 'text-white' : 'text-gray-100'
                        }`}>
                          {category}
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">{count}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Stats */}
            <div className="mt-6 pt-4 border-t border-white/20">
              <h4 className="text-white font-medium mb-3">Quick Stats</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between text-gray-300">
                  <span className="flex items-center gap-2">
                    <Server className="w-4 h-4" />
                    Available
                  </span>
                  <span className="font-bold text-blue-400">{marketplaceServers.length}</span>
                </div>
                <div className="flex items-center justify-between text-gray-300">
                  <span className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Installed
                  </span>
                  <span className="font-bold text-green-400">{installedServers.length}</span>
                </div>
                <div className="flex items-center justify-between text-gray-300">
                  <span className="flex items-center gap-2">
                    <Wrench className="w-4 h-4" />
                    Total Tools
                  </span>
                  <span className="font-bold text-purple-400">
                    {marketplaceServers.reduce((sum, server) => sum + server.tools.length, 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Columns: Main Content (spans 3 columns) */}
          <div className="lg:col-span-3 bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center bg-purple-500 text-white`}>
                  <Store className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">Browse Servers</h3>
                  <p className="text-gray-100 text-base">Find the perfect tools for your automation needs</p>
                </div>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col lg:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search servers, tools, or descriptions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white/10 border-white/20 text-white placeholder-gray-400"
                />
              </div>
              
              <div className="flex gap-3">
                <div className="relative">
                  <Filter className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white min-w-[140px]"
                  >
                    <option value="popular" className="bg-gray-800">Most Popular</option>
                    <option value="recent" className="bg-gray-800">Recently Updated</option>
                    <option value="rating" className="bg-gray-800">Highest Rated</option>
                    <option value="name" className="bg-gray-800">Name A-Z</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Featured Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 rounded-xl p-4 text-center">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Server className="w-4 h-4 text-white" />
                </div>
                <div className="text-2xl font-bold text-white">{marketplaceServers.length}</div>
                <div className="text-sm text-gray-300">Available Servers</div>
              </div>
              <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl p-4 text-center">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-2">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
                <div className="text-2xl font-bold text-white">{installedServers.length}</div>
                <div className="text-sm text-gray-300">Installed</div>
              </div>
              <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl p-4 text-center">
                <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Wrench className="w-4 h-4 text-white" />
                </div>
                <div className="text-2xl font-bold text-white">
                  {marketplaceServers.reduce((sum, server) => sum + server.tools.length, 0)}
                </div>
                <div className="text-sm text-gray-300">Total Tools</div>
              </div>
              <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded-xl p-4 text-center">
                <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Grid3X3 className="w-4 h-4 text-white" />
                </div>
                <div className="text-2xl font-bold text-white">{categories.length - 1}</div>
                <div className="text-sm text-gray-300">Categories</div>
              </div>
            </div>

            {/* Marketplace Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
              <div className="text-center py-12">
                <div className="w-24 h-24 bg-gray-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-12 h-12 text-gray-400" />
                </div>
                <h3 className="text-white font-semibold mb-2">No servers found</h3>
                <p className="text-gray-400 mb-4">Try adjusting your search terms or category filter</p>
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setCategoryFilter('All');
                  }}
                  className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function for category icons
function getCategoryIcon(category: string) {
  switch (category.toLowerCase()) {
    case 'all': return <Grid3X3 className="w-3 h-3" />;
    case 'development': return <Code className="w-3 h-3" />;
    case 'productivity': return <Zap className="w-3 h-3" />;
    case 'ai': return <Wrench className="w-3 h-3" />;
    default: return <Package className="w-3 h-3" />;
  }
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
    <div className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all duration-300 hover:scale-105">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          {server.logoUrl ? (
            <img src={server.logoUrl} alt={server.name} className="w-12 h-12 rounded-lg" />
          ) : (
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
              {server.name.charAt(0)}
            </div>
          )}
          <div className="flex-1">
            <h3 className="font-semibold text-lg text-white">{server.name}</h3>
            <p className="text-sm text-gray-400 flex items-center gap-1">
              <Users className="w-3 h-3" />
              by {server.author}
            </p>
            <div className="flex items-center space-x-2 mt-2">
              <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">
                {server.category}
              </Badge>
              <Badge className="bg-green-500/20 text-green-300 border-green-500/30 text-xs">
                v{server.version}
              </Badge>
              {server.rating && (
                <div className="flex items-center text-xs text-yellow-400">
                  <Star className="w-3 h-3 mr-1 fill-current" />
                  {server.rating.toFixed(1)}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {isInstalled && (
          <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
            <CheckCircle className="w-3 h-3 mr-1" />
            Installed
          </Badge>
        )}
      </div>
      
      <p className="text-sm text-gray-300 mb-4 line-clamp-2">{server.description}</p>
      
      {/* Tools Preview */}
      <div className="mb-4">
        <div className="text-sm font-medium mb-2 text-white flex items-center gap-2">
          <Wrench className="w-4 h-4 text-purple-400" />
          Tools ({server.tools.length}):
        </div>
        <div className="flex flex-wrap gap-1">
          {server.tools.slice(0, 3).map((tool, index) => (
            <Badge key={index} className="bg-white/10 text-gray-300 border-white/20 text-xs">
              {tool}
            </Badge>
          ))}
          {server.tools.length > 3 && (
            <Badge className="bg-white/10 text-gray-300 border-white/20 text-xs">
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
              <Badge key={index} className="bg-purple-500/10 text-purple-300 border-purple-500/30 text-xs flex items-center gap-1">
                <Tag className="w-2 h-2" />
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}
      
      {/* Stats */}
      <div className="flex justify-between items-center text-xs text-gray-400 mb-4">
        <span className="flex items-center gap-1">
          <Download className="w-3 h-3" />
          {formatDownloads(server.downloads)} downloads
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {formatDate(server.lastUpdated)}
        </span>
      </div>
      
      {/* Actions */}
      <div className="flex space-x-2">
        {isInstalled ? (
          <button
            disabled
            className="flex-1 bg-green-500/20 text-green-300 border border-green-500/30 font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Installed
          </button>
        ) : (
          <button
            onClick={() => onInstall(server.id)}
            disabled={isInstalling}
            className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2"
          >
            {isInstalling ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Installing...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Install
              </>
            )}
          </button>
        )}
        
        {server.repositoryUrl && (
          <button
            onClick={() => window.open(server.repositoryUrl, '_blank')}
            className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium py-2 px-3 rounded-lg transition-all duration-300 flex items-center justify-center"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}