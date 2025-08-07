// Backend Marketplace Service - Connects to the real marketplace API

export interface BackendMCP {
  id: string;
  name: string;
  slug: string;
  display_name: string;
  description: string;
  category: string;
  tags: string[];
  rating: number;
  review_count: number;
  github_url: string;
  install_command: string;
  required_env_vars: Array<{
    name: string;
    description: string;
    required: boolean;
    example?: string;
  }>;
  tools_schema: Array<{
    name: string;
    description: string;
    parameters?: any;
  }>;
  created_at: string;
}

export interface BackendCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  sort_order: number;
  created_at: string;
}

export interface BackendInstallation {
  id: string;
  tenant_id: string;
  mcp_id: string;
  server_instance_id: string;
  status: 'installing' | 'active' | 'error' | 'disabled';
  installation_config: any;
  error_message?: string;
  installed_at: string;
  mcp_catalog?: BackendMCP;
}

export class BackendMarketplaceService {
  private baseUrl: string;

  constructor() {
    // Use the backend API URL from environment
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8100';
  }

  /**
   * Get all available MCPs from marketplace
   */
  async getMCPs(options?: {
    category?: string;
    search?: string;
    tags?: string[];
    sort?: 'popularity' | 'rating' | 'newest' | 'name';
    limit?: number;
    offset?: number;
  }): Promise<{ mcps: BackendMCP[]; total: number; has_more: boolean }> {
    const params = new URLSearchParams();
    
    if (options?.category) params.append('category', options.category);
    if (options?.search) params.append('search', options.search);
    if (options?.tags) options.tags.forEach(tag => params.append('tags', tag));
    if (options?.sort) params.append('sort', options.sort);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());

    const response = await fetch(`${this.baseUrl}/api/marketplace/mcps?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch MCPs: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get detailed MCP information
   */
  async getMCP(id: string): Promise<BackendMCP> {
    const response = await fetch(`${this.baseUrl}/api/marketplace/mcps/${id}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch MCP: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get all categories
   */
  async getCategories(): Promise<{ categories: BackendCategory[] }> {
    const response = await fetch(`${this.baseUrl}/api/marketplace/categories`);
    if (!response.ok) {
      throw new Error(`Failed to fetch categories: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Install an MCP for a tenant
   */
  async installMCP(
    mcpId: string, 
    tenantId: string, 
    environmentConfig?: Record<string, string>
  ): Promise<{
    success: boolean;
    installation_id: string;
    server_instance_id: string;
    status: string;
    available_tools: string[];
    message: string;
  }> {
    const response = await fetch(`${this.baseUrl}/api/marketplace/install`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mcp_id: mcpId,
        tenant_id: tenantId,
        environment_config: environmentConfig || {}
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Installation failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get tenant's installed MCPs
   */
  async getInstallations(tenantId: string): Promise<{ installations: BackendInstallation[] }> {
    const response = await fetch(`${this.baseUrl}/api/marketplace/installations/${tenantId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch installations: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Uninstall an MCP
   */
  async uninstallMCP(installationId: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${this.baseUrl}/api/marketplace/installations/${installationId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Uninstallation failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Check if an MCP is already installed for a tenant
   */
  async isInstalled(mcpId: string, tenantId: string): Promise<boolean> {
    try {
      const { installations } = await this.getInstallations(tenantId);
      return installations.some(installation => 
        installation.mcp_id === mcpId && 
        installation.status === 'active'
      );
    } catch (error) {
      console.error('Error checking installation status:', error);
      return false;
    }
  }
}

// Create a singleton instance
export const backendMarketplaceService = new BackendMarketplaceService();