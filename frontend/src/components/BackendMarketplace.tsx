import { useState, useEffect } from 'react';
import { Input } from '../ui/Input';
import { backendMarketplaceService, BackendMCP, BackendCategory } from '../services/BackendMarketplaceService';
import { useTenant } from '../hooks/useTenant';
import { 
  Store, 
  Search, 
  Download,
  RefreshCw,
  Star,
  Package,
  ExternalLink,
  Loader2,
  Tag,
  Grid3X3,
  Zap,
  Server,
  Code,
  Wrench,
  AlertCircle
} from 'lucide-react';

export function BackendMarketplace() {
  const { tenant } = useTenant();
  const [mcps, setMcps] = useState<BackendMCP[]>([]);
  const [categories, setCategories] = useState<BackendCategory[]>([]);
  const [installedMcps, setInstalledMcps] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [sortBy, setSortBy] = useState<'popularity' | 'rating' | 'newest' | 'name'>('popularity');
  const [loading, setLoading] = useState(true);
  const [installLoading, setInstallLoading] = useState<string | null>(null);
  const [selectedMcp, setSelectedMcp] = useState<BackendMCP | null>(null);

  useEffect(() => {
    loadMarketplaceData();
  }, []);

  const loadMarketplaceData = async () => {
    setLoading(true);
    try {
      const [mcpsResponse, categoriesResponse] = await Promise.all([
        backendMarketplaceService.getMCPs({ sort: sortBy }),
        backendMarketplaceService.getCategories()
      ]);

      setMcps(mcpsResponse.mcps);
      setCategories(categoriesResponse.categories);

      // Load installed MCPs if we have a tenant
      if (tenant?.id) {
        try {
          const installations = await backendMarketplaceService.getInstallations(tenant.id);
          const installedIds = new Set(
            installations.installations
              .filter(inst => inst.status === 'active')
              .map(inst => inst.mcp_id)
          );
          setInstalledMcps(installedIds);
        } catch (error) {
          console.warn('Could not load installations:', error);
        }
      }
    } catch (error) {
      console.error('Error loading marketplace data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async (mcp: BackendMCP) => {
    if (!tenant?.id) {
      alert('Please complete tenant setup first');
      return;
    }

    setInstallLoading(mcp.id);
    try {
      // Check for required environment variables
      const requiredEnvVars = mcp.required_env_vars.filter(env => env.required);
      let environmentConfig: Record<string, string> = {};

      if (requiredEnvVars.length > 0) {
        const confirmed = confirm(
          `This MCP requires ${requiredEnvVars.length} environment variable(s):\n` +
          requiredEnvVars.map(env => `- ${env.name}: ${env.description}`).join('\n') +
          '\n\nFor now, we\'ll install with placeholder values. You can configure them later in Settings.'
        );

        if (!confirmed) {
          return;
        }

        // Set placeholder values for demo
        requiredEnvVars.forEach(env => {
          environmentConfig[env.name] = env.example || 'placeholder-value';
        });
      }

      const result = await backendMarketplaceService.installMCP(
        mcp.id, 
        tenant.id, 
        environmentConfig
      );

      if (result.success) {
        // Update installed MCPs list
        setInstalledMcps(prev => new Set([...prev, mcp.id]));
        alert(`✅ ${mcp.display_name} installed successfully!\n\nAvailable tools: ${result.available_tools.join(', ')}`);
      }
    } catch (error) {
      console.error('Installation error:', error);
      alert(`❌ Failed to install ${mcp.display_name}: ${error}`);
    } finally {
      setInstallLoading(null);
    }
  };

  const handleUninstall = async (mcp: BackendMCP) => {
    if (!tenant?.id) return;

    const confirmed = confirm(`Are you sure you want to uninstall ${mcp.display_name}?`);
    if (!confirmed) return;

    setInstallLoading(mcp.id);
    try {
      // Find the installation ID
      const installations = await backendMarketplaceService.getInstallations(tenant.id);
      const installation = installations.installations.find(inst => inst.mcp_id === mcp.id);

      if (installation) {
        await backendMarketplaceService.uninstallMCP(installation.id);
        setInstalledMcps(prev => {
          const newSet = new Set(prev);
          newSet.delete(mcp.id);
          return newSet;
        });
        alert(`✅ ${mcp.display_name} uninstalled successfully!`);
      }
    } catch (error) {
      console.error('Uninstallation error:', error);
      alert(`❌ Failed to uninstall ${mcp.display_name}: ${error}`);
    } finally {
      setInstallLoading(null);
    }
  };

  const filteredMcps = mcps.filter(mcp => {
    const matchesSearch = mcp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         mcp.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         mcp.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = categoryFilter === 'All' || mcp.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'development': return <Code className="w-4 h-4" />;
      case 'ai': case 'ai & machine learning': return <Zap className="w-4 h-4" />;
      case 'data': case 'data & analytics': return <Grid3X3 className="w-4 h-4" />;
      case 'utilities': return <Wrench className="w-4 h-4" />;
      case 'communication': return <Server className="w-4 h-4" />;
      default: return <Package className="w-4 h-4" />;
    }
  };

  const renderMcpCard = (mcp: BackendMCP) => {
    const isInstalled = installedMcps.has(mcp.id);
    const isInstalling = installLoading === mcp.id;

    return (
      <div key={mcp.id} className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-6 hover:bg-white/15 transition-all duration-300 hover:scale-105">
        {/* Header with Icon and Rating */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              {getCategoryIcon(mcp.category)}
            </div>
            <h3 className="text-lg font-bold text-white">{mcp.display_name}</h3>
          </div>
          <div className="flex items-center space-x-1">
            {mcp.rating > 0 && (
              <>
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span className="text-sm text-white/80">{mcp.rating}</span>
              </>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-white/70 text-sm mb-4 leading-relaxed line-clamp-3">{mcp.description}</p>

        {/* Tags - Limited to 3 */}
        <div className="flex flex-wrap gap-1 mb-4">
          {mcp.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded text-xs">
              {tag}
            </span>
          ))}
          {mcp.tags.length > 3 && (
            <span className="text-white/50 text-xs px-2 py-1">+{mcp.tags.length - 3}</span>
          )}
        </div>

        {/* Status Badge */}
        {isInstalled && (
          <div className="mb-4">
            <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded-full text-xs font-medium border border-green-500/30">
              ✓ Installed
            </span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1 text-white/60 text-sm">
            <Wrench className="w-4 h-4" />
            <span>{mcp.tools_schema.length} tools</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedMcp(mcp)}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300"
            >
              View Details
            </button>
            {isInstalled ? (
              <button 
                onClick={() => handleUninstall(mcp)}
                disabled={isInstalling}
                className="bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {isInstalling ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Uninstall'
                )}
              </button>
            ) : (
              <button 
                onClick={() => handleInstall(mcp)}
                disabled={isInstalling}
                className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {isInstalling ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Install'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-lg p-6 min-h-full">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-500 animate-pulse"></div>
            <div className="space-y-2">
              <div className="h-6 bg-white/10 rounded w-48 animate-pulse"></div>
              <div className="h-4 bg-white/5 rounded w-64 animate-pulse"></div>
            </div>
          </div>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mr-3 text-blue-400" />
            <span className="text-white">Loading marketplace...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-lg p-6 min-h-full">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center bg-blue-500 text-white">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white">MCP Marketplace</h3>
            <p className="text-gray-100">
              Discover and install Model Context Protocol servers to extend your AI capabilities
            </p>
          </div>
        </div>

        {/* Search and Sort */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search MCPs, categories, or tags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white/10 border-white/20 text-white placeholder-gray-400"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
        >
          <option value="popularity">Most Popular</option>
          <option value="rating">Highest Rated</option>
          <option value="newest">Newest</option>
          <option value="name">Name A-Z</option>
        </select>
        <button
          onClick={loadMarketplaceData}
          className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Categories */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={() => setCategoryFilter('All')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-300 ${
            categoryFilter === 'All'
              ? 'bg-blue-500 text-white'
              : 'bg-white/10 text-white/80 hover:bg-white/20'
          }`}
        >
          <Package className="w-4 h-4" />
          <span className="text-sm font-medium">All</span>
          <span className="text-xs bg-white/20 px-2 py-1 rounded-full">{mcps.length}</span>
        </button>
        {categories.map((category) => (
          <button
            key={category.slug}
            onClick={() => setCategoryFilter(category.name)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-300 ${
              categoryFilter === category.name
                ? 'bg-blue-500 text-white'
                : 'bg-white/10 text-white/80 hover:bg-white/20'
            }`}
          >
            {getCategoryIcon(category.name)}
            <span className="text-sm font-medium">{category.name}</span>
            <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
              {mcps.filter(m => m.category === category.name).length}
            </span>
          </button>
        ))}
      </div>

      {/* Results Info */}
      <div className="flex items-center justify-between text-sm text-gray-300">
        <span>
          Showing {filteredMcps.length} of {mcps.length} MCPs
          {categoryFilter !== 'All' && ` in ${categoryFilter}`}
        </span>
        {installedMcps.size > 0 && (
          <span>{installedMcps.size} installed</span>
        )}
      </div>

      {/* MCP Grid */}
      {filteredMcps.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMcps.map(renderMcpCard)}
        </div>
      ) : (
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No MCPs found</h3>
          <p className="text-gray-300">
            {searchTerm ? 'Try adjusting your search terms' : 'No MCPs available in this category'}
          </p>
        </div>
      )}

      {/* Lightweight MCP Preview Modal */}
      {selectedMcp && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl">
            {/* Header */}
            <div className="border-b border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                    {getCategoryIcon(selectedMcp.category)}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">{selectedMcp.display_name}</h2>
                    <p className="text-gray-400">{selectedMcp.category}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedMcp(null)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Description */}
              <p className="text-gray-300 leading-relaxed">{selectedMcp.description}</p>

              {/* Tools as Badges with Tooltips */}
              <div>
                <h3 className="text-white font-medium mb-2">Available Tools ({selectedMcp.tools_schema.length})</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedMcp.tools_schema.map((tool) => (
                    <span
                      key={tool.name}
                      title={tool.description}
                      className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-sm border border-blue-500/30 cursor-help"
                    >
                      {tool.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Warning if env vars required */}
              {selectedMcp.required_env_vars.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-amber-300 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    Requires {selectedMcp.required_env_vars.length} environment variable(s) to configure
                  </div>
                </div>
              )}

              {/* Call to Action */}
              <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <ExternalLink className="w-5 h-5 text-purple-400" />
                  <span className="text-white font-medium">Want to learn more?</span>
                </div>
                <p className="text-gray-300 text-sm mb-4">
                  View detailed information, setup guides, reviews, and examples on our public marketplace.
                </p>
                <div className="flex gap-3">
                  <a
                    href={`https://mymcp.me/marketplace/${selectedMcp.name.toLowerCase().replace(/\s+/g, '-')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-all"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View Details
                  </a>
                  {installedMcps.has(selectedMcp.id) ? (
                    <button
                      onClick={() => handleUninstall(selectedMcp)}
                      disabled={installLoading === selectedMcp.id}
                      className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
                    >
                      {installLoading === selectedMcp.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Uninstall'
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleInstall(selectedMcp)}
                      disabled={installLoading === selectedMcp.id}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
                    >
                      {installLoading === selectedMcp.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Quick Install'
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}