// Tenant Provisioning Service - Spins up mini instances for each user

import { Tenant, TenantInstance, DatabaseConfig } from '../types/tenant';
import { DockerService } from './DockerService';
import { DNSService } from './DNSService';
import { DatabaseService } from './DatabaseService';

export class TenantProvisioningService {
  private dockerService: DockerService;
  private dnsService: DNSService;
  private databaseService: DatabaseService;

  constructor() {
    this.dockerService = new DockerService();
    this.dnsService = new DNSService();
    this.databaseService = new DatabaseService();
  }

  /**
   * Provision a complete tenant instance
   */
  async provisionTenant(
    userId: string,
    subdomain: string,
    tier: 'free' | 'pro' | 'enterprise' = 'free'
  ): Promise<Tenant> {
    const tenantId = `tenant_${userId}_${Date.now()}`;
    
    try {
      // 1. Validate subdomain availability
      await this.validateSubdomain(subdomain);
      
      // 2. Create DNS record
      await this.dnsService.createSubdomain(subdomain);
      
      // 3. Setup database (managed or user's Supabase)
      const databaseConfig = await this.setupTenantDatabase(tenantId, tier);
      
      // 4. Deploy backend instance
      const backendInstance = await this.deployBackendInstance({
        tenantId,
        subdomain,
        databaseConfig,
        tier
      });
      
      // 5. Initialize tenant data
      await this.initializeTenantData(tenantId, databaseConfig);
      
      // 6. Create tenant record
      const tenant: Tenant = {
        id: tenantId,
        subdomain,
        userId,
        status: 'active',
        tier,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        
        instance: {
          subdomain: `${subdomain}.mymcp.me`,
          backendUrl: backendInstance.internalUrl,
          frontendUrl: `https://${subdomain}.mymcp.me`,
          databaseConfig,
          storageConfig: {
            bucket: `tenant-${tenantId}`,
            region: 'us-east-1',
            accessKey: backendInstance.storageCredentials.accessKey,
            secretKey: backendInstance.storageCredentials.secretKey
          },
          status: 'running'
        },
        
        settings: {
          aiProvider: 'openai',
          apiKeys: {},
          oauthConnections: [],
          theme: 'auto',
          onboardingComplete: false,
          features: {
            advancedMode: false,
            betaFeatures: false,
            analytics: true
          }
        },
        
        usage: {
          currentPeriodStart: new Date().toISOString(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          recordingSessions: 0,
          toolsGenerated: 0,
          agentExecutions: 0,
          apiCalls: 0,
          storageUsed: 0,
          limits: this.getTierLimits(tier)
        }
      };
      
      await this.saveTenantRecord(tenant);
      
      return tenant;
      
    } catch (error) {
      // Cleanup on failure
      await this.cleanupFailedProvisioning(tenantId, subdomain);
      throw error;
    }
  }

  /**
   * Deploy backend instance using Docker
   */
  private async deployBackendInstance(config: {
    tenantId: string;
    subdomain: string;
    databaseConfig: DatabaseConfig;
    tier: string;
  }): Promise<{
    internalUrl: string;
    port: number;
    containerId: string;
    storageCredentials: { accessKey: string; secretKey: string };
  }> {
    const containerName = `mymcp-${config.tenantId}`;
    const port = await this.getAvailablePort();
    
    // Generate storage credentials
    const storageCredentials = {
      accessKey: this.generateAccessKey(),
      secretKey: this.generateSecretKey()
    };
    
    const envVars = {
      TENANT_ID: config.tenantId,
      SUBDOMAIN: config.subdomain,
      DATABASE_URL: this.buildDatabaseUrl(config.databaseConfig),
      STORAGE_BUCKET: `tenant-${config.tenantId}`,
      STORAGE_ACCESS_KEY: storageCredentials.accessKey,
      STORAGE_SECRET_KEY: storageCredentials.secretKey,
      PORT: port.toString(),
      NODE_ENV: 'production'
    };
    
    const resources = this.getResourcesForTier(config.tier);
    
    const containerId = await this.dockerService.createContainer({
      image: 'mymcp/backend:latest',
      name: containerName,
      ports: [`${port}:8100`],
      env: envVars,
      resources
    });
    
    await this.dockerService.startContainer(containerId);
    
    // Wait for container to be healthy
    await this.waitForContainerHealth(containerId);
    
    return {
      internalUrl: `http://localhost:${port}`,
      port,
      containerId,
      storageCredentials
    };
  }

  /**
   * Setup tenant database - either managed or user's Supabase
   */
  private async setupTenantDatabase(
    tenantId: string,
    tier: string
  ): Promise<DatabaseConfig> {
    if (tier === 'free') {
      // Use managed database for free tier
      const managedDb = await this.databaseService.createManagedDatabase(tenantId);
      return {
        type: 'managed',
        managedInstanceId: managedDb.instanceId
      };
    } else {
      // Pro/Enterprise users can use their own Supabase
      return {
        type: 'user_supabase'
        // User will configure their Supabase credentials later
      };
    }
  }

  /**
   * Initialize tenant database with required tables
   */
  private async initializeTenantData(
    tenantId: string,
    databaseConfig: DatabaseConfig
  ): Promise<void> {
    if (databaseConfig.type === 'managed') {
      await this.databaseService.runMigrations(
        databaseConfig.managedInstanceId!,
        this.getTenantMigrations()
      );
    }
    // For user Supabase, they'll run setup through the UI
  }

  /**
   * OAuth Integration Setup
   */
  async setupOAuthIntegration(
    tenantId: string,
    provider: 'google' | 'twitter' | 'github' | 'slack',
    credentials: {
      clientId: string;
      clientSecret: string;
      scopes: string[];
    }
  ): Promise<void> {
    // Store OAuth credentials securely
    await this.storeOAuthCredentials(tenantId, provider, credentials);
    
    // Configure OAuth redirect URLs
    const tenant = await this.getTenant(tenantId);
    const redirectUrl = `https://${tenant.subdomain}.mymcp.me/auth/callback/${provider}`;
    
    // Register with OAuth provider if needed
    await this.registerOAuthApplication(provider, redirectUrl, credentials);
  }

  /**
   * Validate subdomain availability and format
   */
  private async validateSubdomain(subdomain: string): Promise<void> {
    // Check format
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(subdomain)) {
      throw new Error('Invalid subdomain format');
    }
    
    // Check length
    if (subdomain.length < 3 || subdomain.length > 63) {
      throw new Error('Subdomain must be 3-63 characters');
    }
    
    // Check reserved words
    const reserved = ['www', 'api', 'app', 'admin', 'support', 'help'];
    if (reserved.includes(subdomain)) {
      throw new Error('Subdomain is reserved');
    }
    
    // Check availability
    const exists = await this.dnsService.checkSubdomainExists(subdomain);
    if (exists) {
      throw new Error('Subdomain already taken');
    }
  }

  /**
   * Get tier-based resource limits
   */
  private getResourcesForTier(tier: string) {
    switch (tier) {
      case 'free':
        return {
          memory: '512m',
          cpu: '0.5',
          storage: '1GB'
        };
      case 'pro':
        return {
          memory: '1024m',
          cpu: '1.0',
          storage: '10GB'
        };
      case 'enterprise':
        return {
          memory: '2048m',
          cpu: '2.0',
          storage: '100GB'
        };
      default:
        return this.getResourcesForTier('free');
    }
  }

  private getTierLimits(tier: string) {
    switch (tier) {
      case 'free':
        return {
          recordingSessions: 10,
          toolsGenerated: 5,
          agentExecutions: 100,
          apiCalls: 1000,
          storageLimit: 1024 * 1024 * 1024 // 1GB
        };
      case 'pro':
        return {
          recordingSessions: 100,
          toolsGenerated: 50,
          agentExecutions: 1000,
          apiCalls: 10000,
          storageLimit: 10 * 1024 * 1024 * 1024 // 10GB
        };
      case 'enterprise':
        return {
          recordingSessions: -1, // unlimited
          toolsGenerated: -1,
          agentExecutions: -1,
          apiCalls: -1,
          storageLimit: 100 * 1024 * 1024 * 1024 // 100GB
        };
      default:
        return this.getTierLimits('free');
    }
  }

  // Helper methods
  private async getAvailablePort(): Promise<number> {
    // Find available port in range 8101-9000
    for (let port = 8101; port <= 9000; port++) {
      if (await this.isPortAvailable(port)) {
        return port;
      }
    }
    throw new Error('No available ports');
  }

  private async isPortAvailable(port: number): Promise<boolean> {
    // Implementation to check if port is available
    return true; // Simplified
  }

  private generateAccessKey(): string {
    return 'AK' + Math.random().toString(36).substring(2, 20).toUpperCase();
  }

  private generateSecretKey(): string {
    return Math.random().toString(36).substring(2, 42);
  }

  private buildDatabaseUrl(config: DatabaseConfig): string {
    if (config.type === 'managed') {
      return `postgresql://managed_db_${config.managedInstanceId}`;
    } else {
      return config.supabaseUrl || '';
    }
  }

  private getTenantMigrations(): string[] {
    return [
      // Add tenant-specific database migrations here
      'CREATE_SITE_PAGES_TABLE.sql',
      'CREATE_RECORDING_SESSIONS_TABLE.sql',
      'CREATE_GENERATED_TOOLS_TABLE.sql',
      'CREATE_AGENTS_TABLE.sql'
    ];
  }

  // Placeholder methods - implement based on your infrastructure
  private async waitForContainerHealth(containerId: string): Promise<void> {
    // Wait for container health check to pass
  }

  private async storeOAuthCredentials(tenantId: string, provider: string, credentials: any): Promise<void> {
    // Store OAuth credentials securely (encrypted)
  }

  private async registerOAuthApplication(provider: string, redirectUrl: string, credentials: any): Promise<void> {
    // Register OAuth application with provider if needed
  }

  private async getTenant(tenantId: string): Promise<Tenant> {
    // Get tenant record from database
    throw new Error('Not implemented');
  }

  private async saveTenantRecord(tenant: Tenant): Promise<void> {
    // Save tenant record to main database
  }

  private async cleanupFailedProvisioning(tenantId: string, subdomain: string): Promise<void> {
    // Cleanup resources on failed provisioning
    try {
      await this.dockerService.removeContainer(`mymcp-${tenantId}`);
      await this.dnsService.deleteSubdomain(subdomain);
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }
}