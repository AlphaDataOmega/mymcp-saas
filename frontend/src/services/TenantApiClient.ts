// Tenant-aware API client for multi-tenant architecture

export class TenantApiClient {
  public readonly tenantId: string;
  private baseUrl: string;
  private authToken?: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
    this.baseUrl = this.getApiBaseUrl();
  }

  private getApiBaseUrl(): string {
    // In production, each tenant gets their own subdomain
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      
      if (hostname === 'localhost' || hostname.includes('localhost')) {
        // Development mode - use Vite proxy
        return '/api';
      }
      
      // Extract subdomain from hostname (e.g., "johnsmith.mymcp.me" -> "johnsmith")
      const subdomain = hostname.split('.')[0];
      return `https://${subdomain}.mymcp.me/api`;
    }
    
    // Server-side fallback
    return `https://${this.tenantId}.mymcp.me/api`;
  }

  setAuthToken(token: string): void {
    this.authToken = token;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Tenant-ID': this.tenantId
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  async get(endpoint: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    return this.handleResponse(response);
  }

  async post(endpoint: string, data?: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined
    });

    return this.handleResponse(response);
  }

  async put(endpoint: string, data?: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined
    });

    return this.handleResponse(response);
  }

  async delete(endpoint: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });

    return this.handleResponse(response);
  }

  private async handleResponse(response: Response): Promise<any> {
    const contentType = response.headers.get('content-type');
    
    let data;
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = { message: await response.text() };
    }

    if (!response.ok) {
      throw new ApiError(
        data.error || data.message || 'API request failed',
        response.status,
        data
      );
    }

    return data;
  }

  // WebSocket connection for real-time updates
  createWebSocket(endpoint: string): WebSocket {
    const wsUrl = this.baseUrl.replace('http', 'ws') + endpoint;
    const ws = new WebSocket(wsUrl);
    
    // Add tenant identification
    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({
        type: 'auth',
        tenantId: this.tenantId,
        authToken: this.authToken
      }));
    });

    return ws;
  }

  // Health check for tenant instance
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    services: Record<string, boolean>;
    latency: number;
  }> {
    const startTime = Date.now();
    
    try {
      const response = await this.get('/health');
      const latency = Date.now() - startTime;
      
      return {
        status: 'healthy',
        services: response.services || {},
        latency
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        services: {},
        latency: Date.now() - startTime
      };
    }
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Helper function to create tenant-specific API client
export function createTenantApiClient(tenantId?: string): TenantApiClient {
  if (!tenantId) {
    // Extract tenant ID from current subdomain
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      tenantId = hostname.split('.')[0];
    }
  }

  if (!tenantId || tenantId === 'www' || tenantId === 'localhost') {
    throw new Error('Invalid tenant ID or not in tenant subdomain');
  }

  return new TenantApiClient(tenantId);
}