// Marketplace Service - Handles MCP server/tool discovery, installation, and management
// Extracted from marketplace.py functionality

import { TenantApiClient } from './TenantApiClient';
import { recordUsageAfterAction } from './BillingService';

export interface MarketplaceServer {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  logoUrl?: string;
  repositoryUrl?: string;
  dockerImage?: string;
  installCommand?: string;
  version?: string;
  author?: string;
  license?: string;
  featured: boolean;
  status: 'active' | 'inactive' | 'deprecated';
  tools?: MarketplaceTool[];
  examples?: MarketplaceExample[];
  downloadCount?: number;
  rating?: number;
  reviewCount?: number;
  createdAt: string;
  updatedAt: string;
  serverKey: string; // Backend identifier
}

export interface MarketplaceTool {
  name: string;
  description: string;
  parameters?: Record<string, any>;
  examples?: string[];
}

export interface MarketplaceExample {
  title: string;
  description: string;
  code: string;
  language: string;
}

export interface UserServerInstallation {
  id: string;
  userId: string;
  serverId: string;
  serverName: string;
  status: 'installed' | 'installing' | 'failed' | 'uninstalled';
  installedAt: string;
  config: {
    backendServerId?: string;
    serverName: string;
    installedAsAgent: boolean;
    setupRequired?: boolean;
    credentials?: Record<string, any>;
  };
  marketplaceServer?: MarketplaceServer;
}

export interface ServerSEOPage {
  id: string;
  serverId: string;
  pageType: 'overview' | 'setup' | 'api-reference' | 'examples';
  title: string;
  content: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InstallationRequirement {
  name: string;
  description: string;
  type: 'api_key' | 'credential' | 'config';
  required: boolean;
  example?: string;
}

export interface ServerSetupInfo {
  requirements: InstallationRequirement[];
  configured: boolean;
  missing: string[];
}

export class MarketplaceService {
  private apiClient: TenantApiClient;
  private userId: string;

  constructor(tenantId: string) {
    this.apiClient = new TenantApiClient(tenantId);
    this.userId = tenantId; // In multi-tenant, tenant ID = user ID
  }

  /**
   * Get all available servers from marketplace
   */
  async getAvailableServers(options?: {
    category?: string;
    search?: string;
    featured?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<MarketplaceServer[]> {
    try {
      const params = new URLSearchParams();
      
      if (options?.category) params.append('category', options.category);
      if (options?.search) params.append('search', options.search);
      if (options?.featured !== undefined) params.append('featured', options.featured.toString());
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.offset) params.append('offset', options.offset.toString());

      const response = await this.apiClient.get(`/marketplace/servers?${params.toString()}`);
      return response.servers || [];
    } catch (error) {
      console.error('Failed to fetch available servers:', error);
      return [];
    }
  }

  /**
   * Get servers installed by the current user
   */
  async getInstalledServers(): Promise<UserServerInstallation[]> {
    try {
      const response = await this.apiClient.get('/marketplace/installations');
      return response.installations || [];
    } catch (error) {
      console.error('Failed to fetch installed servers:', error);
      return [];
    }
  }

  /**
   * Get server details by ID
   */
  async getServerDetails(serverId: string): Promise<MarketplaceServer | null> {
    try {
      const response = await this.apiClient.get(`/marketplace/servers/${serverId}`);
      return response.server || null;
    } catch (error) {
      console.error('Failed to fetch server details:', error);
      return null;
    }
  }

  /**
   * Get SEO content pages for a server
   */
  async getServerSEOPages(serverId: string): Promise<ServerSEOPage[]> {
    try {
      const response = await this.apiClient.get(`/marketplace/servers/${serverId}/pages`);
      return response.pages || [];
    } catch (error) {
      console.error('Failed to fetch server SEO pages:', error);
      return [];
    }
  }

  /**
   * Check if a server is already installed
   */
  async isServerInstalled(serverId: string): Promise<boolean> {
    try {
      const installations = await this.getInstalledServers();
      return installations.some(installation => 
        installation.serverId === serverId && installation.status === 'installed'
      );
    } catch (error) {
      console.error('Failed to check installation status:', error);
      return false;
    }
  }

  /**
   * Get server setup requirements
   */
  async getServerSetupInfo(serverKey: string): Promise<ServerSetupInfo | null> {
    try {
      const response = await this.apiClient.get(`/setup/${serverKey}`);
      return {
        requirements: response.requirements || [],
        configured: response.configured || false,
        missing: response.missing || []
      };
    } catch (error) {
      console.error('Failed to fetch server setup info:', error);
      return null;
    }
  }

  /**
   * Install a marketplace server
   */
  async installServer(serverId: string): Promise<{
    success: bool;
    installation?: UserServerInstallation;
    error?: string;
    requiresSetup?: boolean;
    setupInfo?: ServerSetupInfo;
  }> {
    try {
      // First check if already installed
      const isInstalled = await this.isServerInstalled(serverId);
      if (isInstalled) {
        return {
          success: false,
          error: 'Server is already installed'
        };
      }

      // Get server details
      const server = await this.getServerDetails(serverId);
      if (!server) {
        return {
          success: false,
          error: 'Server not found in marketplace'
        };
      }

      // Check setup requirements
      const setupInfo = await this.getServerSetupInfo(server.serverKey);
      if (setupInfo && setupInfo.requirements.length > 0 && !setupInfo.configured) {
        return {
          success: false,
          error: 'Server requires setup before installation',
          requiresSetup: true,
          setupInfo
        };
      }

      // Install server via backend
      const response = await this.apiClient.post('/marketplace/servers/install', {
        serverId,
        serverKey: server.serverKey,
        serverName: server.name
      });

      if (!response.success) {
        return {
          success: false,
          error: response.error || 'Failed to install server'
        };
      }

      // Record usage for billing
      await recordUsageAfterAction(this.apiClient.tenantId, 'toolsGenerated');

      return {
        success: true,
        installation: response.installation
      };
    } catch (error) {
      console.error('Failed to install server:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown installation error'
      };
    }
  }

  /**
   * Uninstall a marketplace server
   */
  async uninstallServer(serverId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const response = await this.apiClient.post('/marketplace/servers/uninstall', {
        serverId
      });

      if (!response.success) {
        return {
          success: false,
          error: response.error || 'Failed to uninstall server'
        };
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to uninstall server:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown uninstall error'
      };
    }
  }

  /**
   * Search marketplace servers
   */
  async searchServers(query: string, filters?: {
    category?: string;
    tags?: string[];
    featured?: boolean;
  }): Promise<MarketplaceServer[]> {
    try {
      const params = new URLSearchParams();
      params.append('search', query);
      
      if (filters?.category) params.append('category', filters.category);
      if (filters?.featured !== undefined) params.append('featured', filters.featured.toString());
      if (filters?.tags) {
        filters.tags.forEach(tag => params.append('tags', tag));
      }

      const response = await this.apiClient.get(`/marketplace/servers/search?${params.toString()}`);
      return response.servers || [];
    } catch (error) {
      console.error('Failed to search servers:', error);
      return [];
    }
  }

  /**
   * Get marketplace categories
   */
  async getCategories(): Promise<Array<{
    name: string;
    count: number;
    description: string;
  }>> {
    try {
      const response = await this.apiClient.get('/marketplace/categories');
      return response.categories || [];
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      return [];
    }
  }

  /**
   * Get popular/trending servers
   */
  async getPopularServers(limit: number = 10): Promise<MarketplaceServer[]> {
    try {
      const response = await this.apiClient.get(`/marketplace/servers/popular?limit=${limit}`);
      return response.servers || [];
    } catch (error) {
      console.error('Failed to fetch popular servers:', error);
      return [];
    }
  }

  /**
   * Get recently added servers
   */
  async getRecentServers(limit: number = 10): Promise<MarketplaceServer[]> {
    try {
      const response = await this.apiClient.get(`/marketplace/servers/recent?limit=${limit}`);
      return response.servers || [];
    } catch (error) {
      console.error('Failed to fetch recent servers:', error);
      return [];
    }
  }

  /**
   * Get featured servers
   */
  async getFeaturedServers(): Promise<MarketplaceServer[]> {
    return this.getAvailableServers({ featured: true });
  }

  /**
   * Rate a server (if rating system exists)
   */
  async rateServer(serverId: string, rating: number, review?: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const response = await this.apiClient.post(`/marketplace/servers/${serverId}/rate`, {
        rating: Math.max(1, Math.min(5, rating)), // Ensure 1-5 range
        review
      });

      return {
        success: response.success,
        error: response.error
      };
    } catch (error) {
      console.error('Failed to rate server:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to submit rating'
      };
    }
  }

  /**
   * Get server reviews
   */
  async getServerReviews(serverId: string, limit: number = 10): Promise<Array<{
    id: string;
    userId: string;
    userName: string;
    rating: number;
    review: string;
    createdAt: string;
  }>> {
    try {
      const response = await this.apiClient.get(`/marketplace/servers/${serverId}/reviews?limit=${limit}`);
      return response.reviews || [];
    } catch (error) {
      console.error('Failed to fetch server reviews:', error);
      return [];
    }
  }

  /**
   * Submit a new server to marketplace (for future use)
   */
  async submitServer(serverData: {
    name: string;
    description: string;
    category: string;
    repositoryUrl: string;
    dockerImage?: string;
    tags: string[];
  }): Promise<{
    success: boolean;
    serverId?: string;
    error?: string;
  }> {
    try {
      const response = await this.apiClient.post('/marketplace/servers/submit', serverData);
      
      return {
        success: response.success,
        serverId: response.serverId,
        error: response.error
      };
    } catch (error) {
      console.error('Failed to submit server:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to submit server'
      };
    }
  }

  /**
   * Get marketplace statistics
   */
  async getMarketplaceStats(): Promise<{
    totalServers: number;
    totalInstallations: number;
    popularCategories: Array<{ name: string; count: number }>;
    recentActivity: Array<{
      type: 'installation' | 'submission' | 'review';
      serverName: string;
      timestamp: string;
    }>;
  }> {
    try {
      const response = await this.apiClient.get('/marketplace/stats');
      return response.stats || {
        totalServers: 0,
        totalInstallations: 0,
        popularCategories: [],
        recentActivity: []
      };
    } catch (error) {
      console.error('Failed to fetch marketplace stats:', error);
      return {
        totalServers: 0,
        totalInstallations: 0,
        popularCategories: [],
        recentActivity: []
      };
    }
  }

  /**
   * Check for server updates
   */
  async checkServerUpdates(): Promise<Array<{
    serverId: string;
    serverName: string;
    currentVersion: string;
    latestVersion: string;
    updateAvailable: boolean;
    updateDescription?: string;
  }>> {
    try {
      const response = await this.apiClient.get('/marketplace/updates');
      return response.updates || [];
    } catch (error) {
      console.error('Failed to check for updates:', error);
      return [];
    }
  }

  /**
   * Update an installed server
   */
  async updateServer(serverId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const response = await this.apiClient.post(`/marketplace/servers/${serverId}/update`);
      
      return {
        success: response.success,
        error: response.error
      };
    } catch (error) {
      console.error('Failed to update server:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update server'
      };
    }
  }

  /**
   * Get server installation logs
   */
  async getInstallationLogs(installationId: string): Promise<Array<{
    timestamp: string;
    level: 'info' | 'warning' | 'error';
    message: string;
  }>> {
    try {
      const response = await this.apiClient.get(`/marketplace/installations/${installationId}/logs`);
      return response.logs || [];
    } catch (error) {
      console.error('Failed to fetch installation logs:', error);
      return [];
    }
  }

  /**
   * Export marketplace configuration
   */
  async exportConfiguration(): Promise<{
    servers: UserServerInstallation[];
    settings: Record<string, any>;
    exportedAt: string;
  }> {
    try {
      const response = await this.apiClient.get('/marketplace/export');
      return response.configuration || {
        servers: [],
        settings: {},
        exportedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to export configuration:', error);
      return {
        servers: [],
        settings: {},
        exportedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Import marketplace configuration
   */
  async importConfiguration(configuration: {
    servers: UserServerInstallation[];  
    settings: Record<string, any>;
  }): Promise<{
    success: boolean;
    imported: number;
    failed: number;
    errors: string[];
  }> {
    try {
      const response = await this.apiClient.post('/marketplace/import', {
        configuration
      });
      
      return {
        success: response.success,
        imported: response.imported || 0,
        failed: response.failed || 0,
        errors: response.errors || []
      };
    } catch (error) {
      console.error('Failed to import configuration:', error);
      return {
        success: false,
        imported: 0,
        failed: 0,
        errors: [error instanceof Error ? error.message : 'Import failed']
      };
    }
  }
}

// Helper function to create marketplace service instance
export function createMarketplaceService(tenantId: string): MarketplaceService {
  return new MarketplaceService(tenantId);
}

// Export types for use in components
export type {
  MarketplaceServer,
  MarketplaceTool,
  MarketplaceExample,
  UserServerInstallation,
  ServerSEOPage,
  InstallationRequirement,
  ServerSetupInfo
};