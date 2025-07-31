// Tenant and multi-tenancy types for MyMCP.me SaaS

export interface Tenant {
  id: string;
  subdomain: string;
  userId: string;
  status: 'provisioning' | 'active' | 'suspended' | 'deleted';
  tier: 'free' | 'pro' | 'enterprise';
  createdAt: string;
  lastActiveAt: string;
  
  // Instance configuration
  instance: TenantInstance;
  
  // User preferences
  settings: TenantSettings;
  
  // Usage metrics
  usage: TenantUsage;
}

export interface TenantInstance {
  subdomain: string;
  backendUrl: string;
  frontendUrl: string;
  databaseConfig: DatabaseConfig;
  storageConfig: StorageConfig;
  status: 'provisioning' | 'running' | 'stopped' | 'error';
}

export interface DatabaseConfig {
  type: 'user_supabase' | 'user_postgres'; // MVP: user-provided only
  supabaseUrl?: string;
  supabaseServiceKey?: string;
  postgresUrl?: string; // For future managed Postgres option
}

export interface StorageConfig {
  bucket: string;
  region: string;
  accessKey: string;
  secretKey: string;
}

export interface TenantSettings {
  // AI Provider Configuration
  aiProvider: 'openai' | 'anthropic' | 'openrouter' | 'ollama';
  apiKeys: Record<string, string>;
  
  // OAuth Integrations
  oauthConnections: OAuthConnection[];
  
  // UI Preferences
  theme: 'light' | 'dark' | 'auto';
  onboardingComplete: boolean;
  
  // Feature flags
  features: {
    advancedMode: boolean;
    betaFeatures: boolean;
    analytics: boolean;
  };
}

export interface OAuthConnection {
  provider: 'google' | 'twitter' | 'github' | 'slack' | 'microsoft';
  status: 'connected' | 'disconnected' | 'expired';
  scopes: string[];
  connectedAt: string;
  lastUsed?: string;
  accessToken?: string; // Encrypted
  refreshToken?: string; // Encrypted
}

export interface TenantUsage {
  currentPeriodStart: string;
  currentPeriodEnd: string;
  
  // Usage metrics
  recordingSessions: number;
  toolsGenerated: number;
  agentExecutions: number;
  apiCalls: number;
  storageUsed: number; // bytes
  
  // Limits based on tier
  limits: {
    recordingSessions: number;
    toolsGenerated: number;
    agentExecutions: number;
    apiCalls: number;
    storageLimit: number; // bytes
  };
}

// Component prop types
export interface TenantProviderProps {
  children: React.ReactNode;
  tenant: Tenant;
}

export interface UseTenantReturn {
  tenant: Tenant | null;
  loading: boolean;
  error: string | null;
  updateTenant: (updates: Partial<Tenant>) => Promise<void>;
  refreshTenant: () => Promise<void>;
}