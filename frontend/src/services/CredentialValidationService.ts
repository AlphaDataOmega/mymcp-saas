// Credential Validation Service - Test user-provided credentials

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  details?: any;
}

export interface SupabaseValidationResult extends ValidationResult {
  permissions?: string[];
  hasRequiredTables?: boolean;
  canCreateTables?: boolean;
}

export class CredentialValidationService {
  
  /**
   * Validate Supabase credentials and permissions via backend
   */
  async validateSupabase(url: string, serviceKey: string): Promise<SupabaseValidationResult> {
    try {
      // Call backend validation endpoint (same approach as AI providers)
      const response = await fetch('/api/validate/supabase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          supabaseUrl: url,
          supabaseServiceKey: serviceKey
        })
      });

      if (response.ok) {
        const result = await response.json();
        return result;
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Validation failed' }));
        return {
          valid: false,
          error: errorData.error || `Validation failed: ${response.status}`
        };
      }
    } catch (error: any) {
      // Fallback: Basic format validation if backend is unavailable
      console.warn('Backend validation endpoint not available, using format validation fallback');
      
      if (!this.isValidSupabaseUrl(url)) {
        return { valid: false, error: 'Invalid Supabase URL format' };
      }
      
      if (!serviceKey || serviceKey.length < 100) {
        return { valid: false, error: 'Invalid Supabase service key format' };
      }
      
      return {
        valid: true,
        permissions: ['Unknown'],
        hasRequiredTables: false,
        canCreateTables: true
      };
    }
  }

  /**
   * Validate AI provider API key
   */
  async validateAIProvider(provider: string, apiKey: string): Promise<ValidationResult> {
    if (provider === 'ollama') {
      // For Ollama, just test connection to the API
      try {
        const response = await fetch('http://localhost:11434/api/tags');
        return { valid: response.ok };
      } catch (error: any) {
        return {
          valid: false,
          error: 'Cannot connect to Ollama. Make sure it is running on localhost:11434'
        };
      }
    }

    return this.validateAPIKey(provider as 'openai' | 'anthropic' | 'openrouter', apiKey);
  }

  /**
   * Validate embedding provider API key
   */
  async validateEmbeddingProvider(provider: string, apiKey: string): Promise<ValidationResult> {
    if (provider === 'ollama') {
      // For Ollama, test if embedding models are available
      try {
        const response = await fetch('http://localhost:11434/api/tags');
        if (response.ok) {
          const data = await response.json();
          const hasEmbeddingModels = data.models?.some((model: any) => 
            model.name.includes('embed') || model.name.includes('nomic')
          );
          
          return { 
            valid: hasEmbeddingModels,
            error: hasEmbeddingModels ? undefined : 'No embedding models found. Try: ollama pull nomic-embed-text'
          };
        }
        return { valid: false, error: 'Cannot connect to Ollama' };
      } catch (error: any) {
        return {
          valid: false,
          error: 'Cannot connect to Ollama. Make sure it is running on localhost:11434'
        };
      }
    }

    if (provider === 'openai') {
      return this.validateAPIKey('openai', apiKey);
    }

    return { valid: false, error: 'Unknown embedding provider' };
  }

  /**
   * Validate API key for specific providers via backend setup-manager
   */
  private async validateAPIKey(provider: 'openai' | 'anthropic' | 'openrouter', apiKey: string): Promise<ValidationResult> {
    try {
      // Call backend validation endpoint that uses setup-manager
      const response = await fetch('/api/validate/ai-provider', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          provider,
          apiKey
        })
      });

      if (response.ok) {
        const result = await response.json();
        return result;
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Validation failed' }));
        return {
          valid: false,
          error: errorData.error || `Validation failed: ${response.status}`
        };
      }
    } catch (error: any) {
      // Fallback: Basic format validation if backend is unavailable
      console.warn('Backend validation endpoint not available, using format validation fallback');
      
      const isValidFormat = this.validateAPIKeyFormat(provider, apiKey);
      
      return {
        valid: isValidFormat,
        error: isValidFormat ? undefined : `Invalid ${provider} API key format`
      };
    }
  }

  /**
   * Basic API key format validation (fallback)
   */
  private validateAPIKeyFormat(provider: string, apiKey: string): boolean {
    if (!apiKey || apiKey.length < 10) return false;
    
    switch (provider) {
      case 'openai':
        return apiKey.startsWith('sk-') && apiKey.length > 40;
      case 'anthropic':
        return apiKey.startsWith('sk-ant-') && apiKey.length > 50;
      case 'openrouter':
        return apiKey.startsWith('sk-or-') && apiKey.length > 40;
      default:
        return false;
    }
  }

  /**
   * Auto-setup required tables in user's Supabase
   */
  async setupRequiredTables(url: string, serviceKey: string): Promise<ValidationResult> {
    try {
      const supabase = createClient(url, serviceKey);

      // SQL for required tables (extracted from original site_pages.sql)
      const tableSetupSQL = `
        -- Create site_pages table for documentation and RAG
        CREATE TABLE IF NOT EXISTS site_pages (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          url TEXT,
          chunk_number INTEGER,
          title TEXT,
          summary TEXT,
          content TEXT,
          metadata JSONB,
          embedding VECTOR(1536),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
        );

        -- Create recording_sessions table
        CREATE TABLE IF NOT EXISTS recording_sessions (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          tenant_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          status TEXT DEFAULT 'recording',
          start_time BIGINT,
          end_time BIGINT,
          actions JSONB DEFAULT '[]',
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
        );

        -- Create generated_tools table
        CREATE TABLE IF NOT EXISTS generated_tools (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          tenant_id TEXT NOT NULL,
          session_id UUID REFERENCES recording_sessions(id),
          name TEXT NOT NULL,
          description TEXT,
          code TEXT NOT NULL,
          language TEXT DEFAULT 'python',
          parameters JSONB DEFAULT '[]',
          execution_count INTEGER DEFAULT 0,
          category TEXT DEFAULT 'browser_automation',
          tags TEXT[] DEFAULT '{}',
          is_public BOOLEAN DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
        );

        -- Create agents table
        CREATE TABLE IF NOT EXISTS agents (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          tenant_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          system_prompt TEXT,
          model TEXT,
          provider TEXT,
          tools TEXT[] DEFAULT '{}',
          status TEXT DEFAULT 'active',
          conversation_count INTEGER DEFAULT 0,
          total_messages INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
        );

        -- Create conversations table
        CREATE TABLE IF NOT EXISTS conversations (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          agent_id UUID REFERENCES agents(id),
          tenant_id TEXT NOT NULL,
          title TEXT,
          messages JSONB DEFAULT '[]',
          status TEXT DEFAULT 'active',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
        );

        -- Create indexes for performance
        CREATE INDEX IF NOT EXISTS idx_recording_sessions_tenant ON recording_sessions(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_generated_tools_tenant ON generated_tools(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_agents_tenant ON agents(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_conversations_tenant ON conversations(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_conversations_agent ON conversations(agent_id);

        -- Enable RLS (Row Level Security) for multi-tenancy
        ALTER TABLE recording_sessions ENABLE ROW LEVEL SECURITY;
        ALTER TABLE generated_tools ENABLE ROW LEVEL SECURITY;
        ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
        ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
      `;

      // Execute the SQL
      const { error } = await supabase.rpc('exec_sql', { sql: tableSetupSQL });

      if (error) {
        // Fallback: Try executing statements one by one
        const statements = tableSetupSQL.split(';').filter(s => s.trim());
        
        for (const statement of statements) {
          if (statement.trim()) {
            const { error: stmtError } = await supabase.rpc('exec_sql', { 
              sql: statement.trim() 
            });
            if (stmtError) {
              console.warn('SQL statement failed:', statement, stmtError);
            }
          }
        }
      }

      // Verify tables were created
      const tablesCreated = await this.checkRequiredTables(supabase);
      
      return {
        valid: tablesCreated,
        details: {
          tablesCreated,
          message: tablesCreated 
            ? 'All required tables created successfully'
            : 'Some tables may need to be created manually'
        }
      };

    } catch (error: any) {
      return {
        valid: false,
        error: `Table setup failed: ${error.message}`
      };
    }
  }

  // Private helper methods

  private isValidSupabaseUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.hostname.includes('supabase') && parsedUrl.protocol === 'https:';
    } catch {
      return false;
    }
  }

}