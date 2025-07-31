/**
 * Intelligent Setup Manager
 * Handles API key collection and server configuration based on metadata
 */

interface SetupRequirement {
  key: string;
  name: string;
  description: string;
  type: 'api_key' | 'url' | 'token' | 'connection_string' | 'oauth';
  required: boolean;
  instructions: string;
  validation?: RegExp;
  setupUrl?: string; // Where to get the key
  testEndpoint?: string; // How to test the key
}

interface ServerSetupMetadata {
  serverName: string;
  displayName: string;
  description: string;
  category: string;
  requirements: SetupRequirement[];
  setupInstructions: string;
  estimatedSetupTime: string;
}

export class SetupManager {
  private setupMetadata: Map<string, ServerSetupMetadata> = new Map();

  constructor() {
    this.initializeSetupMetadata();
  }

  private initializeSetupMetadata() {
    // GitHub setup metadata
    this.setupMetadata.set('github', {
      serverName: 'github',
      displayName: 'GitHub MCP Server',
      description: 'Access GitHub repositories, issues, pull requests, and more',
      category: 'development',
      estimatedSetupTime: '2 minutes',
      setupInstructions: 'Create a Personal Access Token with repo and issues permissions',
      requirements: [
        {
          key: 'GITHUB_PERSONAL_ACCESS_TOKEN',
          name: 'GitHub Personal Access Token',
          description: 'Token with repo, issues, and pull requests permissions',
          type: 'api_key',
          required: true,
          instructions: '1. Go to GitHub Settings > Developer settings > Personal access tokens\n2. Click "Generate new token (classic)"\n3. Select scopes: repo, issues, pull_requests\n4. Copy the generated token',
          setupUrl: 'https://github.com/settings/tokens/new',
          validation: /^gh[ps]_[A-Za-z0-9]{36,}$/,
          testEndpoint: 'https://api.github.com/user'
        }
      ]
    });

    // Slack setup metadata
    this.setupMetadata.set('slack', {
      serverName: 'slack',
      displayName: 'Slack MCP Server', 
      description: 'Send messages, manage channels, and interact with Slack workspaces',
      category: 'communication',
      estimatedSetupTime: '5 minutes',
      setupInstructions: 'Create a Slack app and get a Bot User OAuth Token',
      requirements: [
        {
          key: 'SLACK_BOT_TOKEN',
          name: 'Slack Bot Token',
          description: 'Bot User OAuth Token with chat:write permissions',
          type: 'oauth',
          required: true,
          instructions: '1. Go to https://api.slack.com/apps\n2. Create new app "From scratch"\n3. Add Bot Token Scopes: chat:write, channels:read, users:read\n4. Install app to workspace\n5. Copy "Bot User OAuth Token"',
          setupUrl: 'https://api.slack.com/apps',
          validation: /^xoxb-[0-9]+-[0-9]+-[A-Za-z0-9]+$/,
          testEndpoint: 'https://slack.com/api/auth.test'
        }
      ]
    });

    // QuickBooks setup metadata
    this.setupMetadata.set('quickbooks', {
      serverName: 'quickbooks',
      displayName: 'QuickBooks Online MCP Server',
      description: 'Manage customers, invoices, payments, and financial data',
      category: 'finance',
      estimatedSetupTime: '10 minutes',
      setupInstructions: 'Create QuickBooks app and get OAuth credentials',
      requirements: [
        {
          key: 'QB_CLIENT_ID',
          name: 'QuickBooks Client ID',
          description: 'OAuth 2.0 Client ID from QuickBooks Developer account',
          type: 'api_key',
          required: true,
          instructions: '1. Go to QuickBooks Developer Dashboard\n2. Create new app\n3. Copy Client ID from app keys',
          setupUrl: 'https://developer.intuit.com/app/developer/myapps'
        },
        {
          key: 'QB_CLIENT_SECRET',
          name: 'QuickBooks Client Secret',
          description: 'OAuth 2.0 Client Secret from QuickBooks Developer account',
          type: 'api_key',
          required: true,
          instructions: '1. In your QuickBooks app dashboard\n2. Copy Client Secret from app keys\n3. Keep this secret secure!',
          setupUrl: 'https://developer.intuit.com/app/developer/myapps'
        },
        {
          key: 'QB_REDIRECT_URI',
          name: 'Redirect URI',
          description: 'OAuth redirect URI (use your domain or localhost for testing)',
          type: 'url',
          required: true,
          instructions: 'Set to https://yourdomain.com/oauth/callback or http://localhost:3000/callback for testing'
        }
      ]
    });

    // OpenAI setup metadata
    this.setupMetadata.set('openai', {
      serverName: 'openai',
      displayName: 'OpenAI API',
      description: 'Access to GPT models and other OpenAI services',
      category: 'ai_provider',
      estimatedSetupTime: '2 minutes',
      setupInstructions: 'Get API key from OpenAI platform',
      requirements: [
        {
          key: 'OPENAI_API_KEY',
          name: 'OpenAI API Key',
          description: 'API key for accessing OpenAI services',
          type: 'api_key',
          required: true,
          instructions: '1. Go to OpenAI Platform\n2. Navigate to API Keys section\n3. Create new secret key\n4. Copy the generated key',
          setupUrl: 'https://platform.openai.com/api-keys',
          validation: /^sk-[a-zA-Z0-9\-_]{40,}$/,
          testEndpoint: 'https://api.openai.com/v1/models'
        }
      ]
    });

    // Anthropic setup metadata
    this.setupMetadata.set('anthropic', {
      serverName: 'anthropic',
      displayName: 'Anthropic API',
      description: 'Access to Claude models and other Anthropic services',
      category: 'ai_provider',
      estimatedSetupTime: '2 minutes',
      setupInstructions: 'Get API key from Anthropic console',
      requirements: [
        {
          key: 'ANTHROPIC_API_KEY',
          name: 'Anthropic API Key',
          description: 'API key for accessing Anthropic services',
          type: 'api_key',
          required: true,
          instructions: '1. Go to Anthropic Console\n2. Navigate to API Keys section\n3. Create new API key\n4. Copy the generated key',
          setupUrl: 'https://console.anthropic.com/settings/keys',
          validation: /^sk-ant-[a-zA-Z0-9\-_]{95,}$/,
          testEndpoint: 'https://api.anthropic.com/v1/messages'
        }
      ]
    });
  }

  // Get setup requirements for a server
  getSetupRequirements(serverName: string): ServerSetupMetadata | null {
    return this.setupMetadata.get(serverName.toLowerCase()) || null;
  }

  // Check if a server needs setup
  needsSetup(serverName: string): boolean {
    const metadata = this.getSetupRequirements(serverName);
    if (!metadata) return false;

    return metadata.requirements.some(req => 
      req.required && !process.env[req.key]
    );
  }

  // Get missing requirements
  getMissingRequirements(serverName: string): SetupRequirement[] {
    const metadata = this.getSetupRequirements(serverName);
    if (!metadata) return [];

    return metadata.requirements.filter(req => 
      req.required && !process.env[req.key]
    );
  }

  // Validate API key format
  validateApiKey(serverName: string, key: string, value: string): boolean {
    const metadata = this.getSetupRequirements(serverName);
    if (!metadata) return true;

    const requirement = metadata.requirements.find(req => req.key === key);
    if (!requirement?.validation) return true;

    return requirement.validation.test(value);
  }

  // Test API key by making a test request
  async testApiKey(serverName: string, key: string, value: string): Promise<{valid: boolean, error?: string}> {
    const metadata = this.getSetupRequirements(serverName);
    if (!metadata) return {valid: true};

    const requirement = metadata.requirements.find(req => req.key === key);
    if (!requirement?.testEndpoint) return {valid: true};

    try {
      const headers: Record<string, string> = {};
      
      // Set appropriate headers based on service
      if (serverName === 'github') {
        headers['Authorization'] = `token ${value}`;
      } else if (serverName === 'slack') {
        headers['Authorization'] = `Bearer ${value}`;
      } else if (serverName === 'openai') {
        headers['Authorization'] = `Bearer ${value}`;
      } else if (serverName === 'anthropic') {
        headers['x-api-key'] = value;
        headers['anthropic-version'] = '2023-06-01';
        // For Anthropic, we need to make a POST request with a test message
        const testMessage = {
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'test' }]
        };
        const response = await fetch(requirement.testEndpoint, { 
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(testMessage)
        });
        
        return {
          valid: response.ok,
          error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`
        };
      }

      // Only make GET request for non-Anthropic services
      if (serverName !== 'anthropic') {
        const response = await fetch(requirement.testEndpoint, { headers });
        
        return {
          valid: response.ok,
          error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`
        };
      }
    } catch (error) {
      return {
        valid: false,
        error: `Connection failed: ${String(error)}`
      };
    }
  }

  // Generate interactive setup guide
  generateSetupGuide(serverName: string): string {
    const metadata = this.getSetupRequirements(serverName);
    if (!metadata) return `No setup guide available for ${serverName}`;

    let guide = `# ${metadata.displayName} Setup Guide\n\n`;
    guide += `**Description:** ${metadata.description}\n`;
    guide += `**Category:** ${metadata.category}\n`;
    guide += `**Estimated Time:** ${metadata.estimatedSetupTime}\n\n`;
    guide += `## Overview\n${metadata.setupInstructions}\n\n`;
    guide += `## Required Configuration\n\n`;

    metadata.requirements.forEach((req, index) => {
      guide += `### ${index + 1}. ${req.name}\n`;
      guide += `**Key:** \`${req.key}\`\n`;
      guide += `**Type:** ${req.type}\n`;
      guide += `**Required:** ${req.required ? 'Yes' : 'No'}\n\n`;
      guide += `**Instructions:**\n${req.instructions}\n\n`;
      
      if (req.setupUrl) {
        guide += `**Setup URL:** ${req.setupUrl}\n\n`;
      }
    });

    return guide;
  }

  // Get all available servers with their setup status
  getAllServersWithSetupStatus(): Array<{
    serverName: string;
    displayName: string;
    description: string;
    category: string;
    needsSetup: boolean;
    missingRequirements: number;
  }> {
    return Array.from(this.setupMetadata.values()).map(metadata => ({
      serverName: metadata.serverName,
      displayName: metadata.displayName,
      description: metadata.description,
      category: metadata.category,
      needsSetup: this.needsSetup(metadata.serverName),
      missingRequirements: this.getMissingRequirements(metadata.serverName).length
    }));
  }
}

// Singleton instance
export const setupManager = new SetupManager();