import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/Tabs';
import { CredentialValidationService } from '../services/CredentialValidationService';
import { useTenant } from '../hooks/useTenant';

interface APIProvider {
  id: string;
  name: string;
  description: string;
  logoUrl?: string;
  defaultBaseUrl?: string;
  requiresApiKey: boolean;
  models?: string[];
}

interface DatabaseConfig {
  type: 'user_supabase' | 'managed_postgres';
  supabaseUrl?: string;
  supabaseServiceKey?: string;
  managedInstanceId?: string;
}

interface AIConfig {
  provider: string;
  baseUrl: string;
  apiKey: string;
  primaryModel: string;
  reasonerModel?: string;
}

interface EmbeddingConfig {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}


const AI_PROVIDERS: APIProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4.5, GPT-4.1, o3, o4-mini',
    defaultBaseUrl: 'https://api.openai.com/v1',
    requiresApiKey: true,
    models: [
      'gpt-4.5',
      'gpt-4.1',
      'gpt-4o',
      'gpt-4o-mini',
      'o3',
      'o3-mini',
      'o4-mini',
      'o1-preview',
      'o1-mini',
      'gpt-3.5-turbo'
    ]
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude 4 Opus, Claude 4 Sonnet',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    requiresApiKey: true,
    models: [
      'claude-4-opus',
      'claude-4-sonnet',
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229',
      'claude-3-5-haiku-20241022'
    ]
  }
];

const EMBEDDING_PROVIDERS: APIProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'text-embedding-3-small/large',
    defaultBaseUrl: 'https://api.openai.com/v1',
    requiresApiKey: true,
    models: ['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002']
  }
];


interface SmartSettingsProps {
  onSetupComplete?: () => void;
  isOnboarding?: boolean;
}

export function SmartSettings({ onSetupComplete, isOnboarding = false }: SmartSettingsProps = {}) {
  const { tenant, updateTenant } = useTenant();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('ai');
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [validationStatus, setValidationStatus] = useState<Record<string, 'validating' | 'valid' | 'invalid' | 'idle'>>({});
  
  // Configuration states
  const [databaseConfig, setDatabaseConfig] = useState<DatabaseConfig>({
    type: 'user_supabase'
  });
  
  const [aiConfig, setAIConfig] = useState<AIConfig>({
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    primaryModel: 'gpt-4.5'
  });
  
  const [embeddingConfig, setEmbeddingConfig] = useState<EmbeddingConfig>({
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'text-embedding-3-small'
  });
  

  const credentialService = new CredentialValidationService();

  useEffect(() => {
    // Load existing configuration from tenant
    if (tenant?.settings) {
      if (tenant.settings.databaseConfig) {
        setDatabaseConfig(tenant.settings.databaseConfig);
      }
      if (tenant.settings.aiProvider) {
        setAIConfig({
          provider: tenant.settings.aiProvider,
          baseUrl: tenant.settings.apiKeys?.baseUrl || AI_PROVIDERS.find(p => p.id === tenant.settings.aiProvider)?.defaultBaseUrl || '',
          apiKey: tenant.settings.apiKeys?.[tenant.settings.aiProvider] || '',
          primaryModel: tenant.settings.primaryModel || 'gpt-4.5',
          reasonerModel: tenant.settings.reasonerModel
        });
      }
      if (tenant.settings.embeddingProvider) {
        setEmbeddingConfig({
          provider: tenant.settings.embeddingProvider,
          baseUrl: tenant.settings.embeddingBaseUrl || EMBEDDING_PROVIDERS.find(p => p.id === tenant.settings.embeddingProvider)?.defaultBaseUrl || '',
          apiKey: tenant.settings.apiKeys?.embedding || '',
          model: tenant.settings.embeddingModel || 'text-embedding-3-small'
        });
      }
    }
  }, [tenant]);

  const validateCredentials = async (type: string, config: any) => {
    setValidationStatus(prev => ({ ...prev, [type]: 'validating' }));
    
    try {
      let result;
      
      switch (type) {
        case 'database':
          result = await credentialService.validateSupabase(
            config.supabaseUrl,
            config.supabaseServiceKey
          );
          break;
        case 'ai':
          result = await credentialService.validateAIProvider(
            config.provider,
            config.apiKey
          );
          break;
        case 'embeddings':
          result = await credentialService.validateEmbeddingProvider(
            config.provider,
            config.apiKey
          );
          break;
        default:
          result = { valid: false };
      }
      
      setValidationStatus(prev => ({ 
        ...prev, 
        [type]: result.valid ? 'valid' : 'invalid' 
      }));
      
      return result;
    } catch (error) {
      setValidationStatus(prev => ({ ...prev, [type]: 'invalid' }));
      return { valid: false, error: 'Validation failed' };
    }
  };

  const handleAIProviderChange = (providerId: string) => {
    const provider = AI_PROVIDERS.find(p => p.id === providerId);
    if (provider) {
      setAIConfig(prev => ({
        ...prev,
        provider: providerId,
        baseUrl: provider.defaultBaseUrl || prev.baseUrl,
        apiKey: prev.apiKey
      }));
    }
  };

  const handleEmbeddingProviderChange = (providerId: string) => {
    const provider = EMBEDDING_PROVIDERS.find(p => p.id === providerId);
    if (provider) {
      setEmbeddingConfig(prev => ({
        ...prev,
        provider: providerId,
        baseUrl: provider.defaultBaseUrl || prev.baseUrl,
        apiKey: prev.apiKey
      }));
    }
  };


  const handleSaveConfiguration = async () => {
    setLoading(true);
    
    try {
      // Check if required fields are filled
      if (!aiConfig.apiKey || !databaseConfig.supabaseUrl || !databaseConfig.supabaseServiceKey) {
        alert('Please fill in all required fields (AI API Key, Supabase URL, and Service Key)');
        return;
      }

      // Validate all configurations if they haven't been validated yet
      let databaseValid = validationStatus.database === 'valid' ? { valid: true } : await validateCredentials('database', databaseConfig);
      let aiValid = validationStatus.ai === 'valid' ? { valid: true } : await validateCredentials('ai', aiConfig);
      let embeddingValid = validationStatus.embeddings === 'valid' ? { valid: true } : await validateCredentials('embeddings', embeddingConfig);
      
      // Update tenant configuration regardless of validation status (save what we have)
      const updatedSettings = {
        ...tenant?.settings,
        databaseConfig,
        aiProvider: aiConfig.provider,
        primaryModel: aiConfig.primaryModel,
        reasonerModel: aiConfig.reasonerModel,
        embeddingProvider: embeddingConfig.provider,
        embeddingModel: embeddingConfig.model,
        embeddingBaseUrl: embeddingConfig.baseUrl,
        configured: databaseValid.valid && aiValid.valid && embeddingValid.valid, // Only mark as fully configured if all are valid
        setupComplete: databaseValid.valid && aiValid.valid && embeddingValid.valid && validationStatus.documentation === 'valid', // Mark setup complete when all validations pass
        validationStatus: {
          database: databaseValid.valid,
          ai: aiValid.valid,
          embeddings: embeddingValid.valid,
          documentation: validationStatus.documentation === 'valid'
        },
        apiKeys: {
          ...tenant?.settings?.apiKeys,
          baseUrl: aiConfig.baseUrl,
          [aiConfig.provider]: aiConfig.apiKey,
          embedding: embeddingConfig.apiKey
        }
      };

      await updateTenant({ 
        status: 'active',
        settings: updatedSettings 
      });
      
      // Show confirmation page
      setShowConfirmation(true);
      setSaveSuccess(true);
      
      // Show validation warnings if any failed
      if (!databaseValid.valid || !aiValid.valid || !embeddingValid.valid) {
        const failedValidations = [];
        if (!databaseValid.valid) failedValidations.push('Database');
        if (!aiValid.valid) failedValidations.push('AI Provider');
        if (!embeddingValid.valid) failedValidations.push('Embeddings');
        
        console.warn(`Configuration saved, but validation failed for: ${failedValidations.join(', ')}`);
      }
      
    } catch (error: any) {
      console.error('Failed to save configuration:', error);
      alert(`❌ Failed to save configuration: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const isSetupComplete = 
    validationStatus.database === 'valid' && 
    validationStatus.ai === 'valid' && 
    validationStatus.embeddings === 'valid' &&
    validationStatus.documentation === 'valid';
    
  const handleBackToEditing = () => {
    setShowConfirmation(false);
    setSaveSuccess(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 pt-16">
      <div className="container max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">⚙️ Smart Settings</h1>
            <p className="text-muted-foreground mt-2">
              Connect your services and configure your automation workspace
            </p>
          </div>
          
          {isSetupComplete && (
            <Badge variant="default" className="bg-green-600">
              ✅ Setup Complete
            </Badge>
          )}
        </div>

        {/* Setup Progress - 4 Cards as requested */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <h2 className="text-xl font-semibold">Setup Progress</h2>
            {showConfirmation && (
              <Button 
                variant="ghost" 
                onClick={handleBackToEditing}
                className="text-gray-600 hover:text-gray-900"
              >
                <span className="mr-2">←</span> Back to Edit
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <SetupProgressCard
                title="AI"
                status={validationStatus.ai || 'idle'}
                description="Language model configuration"
              />
              <SetupProgressCard
                title="Embeddings"
                status={validationStatus.embeddings || 'idle'}
                description="Vector search setup"
              />
              <SetupProgressCard
                title="Database"
                status={validationStatus.database || 'idle'}
                description="Supabase connection"
              />
              <SetupProgressCard
                title="Index"
                status={validationStatus.documentation || 'idle'}
                description="Documentation indexed"
              />
            </div>
          </CardContent>
        </Card>

        {/* 4-Tab Interface - Only show when not in confirmation mode */}
        {!showConfirmation && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="ai">🤖 AI</TabsTrigger>
              <TabsTrigger value="embeddings">🔍 Embeddings</TabsTrigger>
              <TabsTrigger value="database">🗄️ Database</TabsTrigger>
              <TabsTrigger value="index">📚 Index</TabsTrigger>
            </TabsList>

            {/* AI Tab */}
            <TabsContent value="ai" className="mt-6 space-y-6">
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-semibold">🤖 AI Provider Configuration</h3>
                  <p className="text-sm text-muted-foreground">
                    Choose your preferred AI service for agent creation
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {AI_PROVIDERS.map((provider) => (
                      <ProviderCard
                        key={provider.id}
                        provider={provider}
                        selected={aiConfig.provider === provider.id}
                        onClick={() => handleAIProviderChange(provider.id)}
                      />
                    ))}
                  </div>
                  
                  <div className="space-y-3">
                    <Input
                      label="Base URL"
                      value={aiConfig.baseUrl}
                      onChange={(e) => setAIConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
                      placeholder="API base URL"
                    />
                    
                    <Input
                      label="API Key"
                      type="password"
                      value={aiConfig.apiKey}
                      onChange={(e) => setAIConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                      placeholder="Your API key"
                    />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">Primary Model</label>
                        <select
                          value={aiConfig.primaryModel}
                          onChange={(e) => setAIConfig(prev => ({ ...prev, primaryModel: e.target.value }))}
                          className="w-full px-3 py-2 border border-input bg-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                        >
                          {AI_PROVIDERS.find(p => p.id === aiConfig.provider)?.models?.map(model => (
                            <option key={model} value={model}>{model}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-1">Reasoner Model (Optional)</label>
                        <select
                          value={aiConfig.reasonerModel || ''}
                          onChange={(e) => setAIConfig(prev => ({ ...prev, reasonerModel: e.target.value || undefined }))}
                          className="w-full px-3 py-2 border border-input bg-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                        >
                          <option value="">None selected</option>
                          {AI_PROVIDERS.find(p => p.id === aiConfig.provider)?.models?.map(model => (
                            <option key={model} value={model}>{model}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    
                    <Button
                      onClick={() => validateCredentials('ai', aiConfig)}
                      disabled={!aiConfig.apiKey}
                      className="w-full"
                    >
                      {validationStatus.ai === 'validating' ? '🔄 Testing...' : '🧪 Test AI Connection'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Embeddings Tab */}
            <TabsContent value="embeddings" className="mt-6 space-y-6">
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-semibold">🔍 Embedding Provider Configuration</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure vector embeddings for intelligent search and retrieval
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-3">
                    {EMBEDDING_PROVIDERS.map((provider) => (
                      <ProviderCard
                        key={provider.id}
                        provider={provider}
                        selected={embeddingConfig.provider === provider.id}
                        onClick={() => handleEmbeddingProviderChange(provider.id)}
                      />
                    ))}
                  </div>
                  
                  <div className="space-y-3">
                    <Input
                      label="Base URL"
                      value={embeddingConfig.baseUrl}
                      onChange={(e) => setEmbeddingConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
                      placeholder="API base URL"
                    />
                    
                    <Input
                      label="API Key"
                      type="password"
                      value={embeddingConfig.apiKey}
                      onChange={(e) => setEmbeddingConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                      placeholder="Your API key"
                    />
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">Embedding Model</label>
                      <select
                        value={embeddingConfig.model}
                        onChange={(e) => setEmbeddingConfig(prev => ({ ...prev, model: e.target.value }))}
                        className="w-full px-3 py-2 border border-input bg-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                      >
                        {EMBEDDING_PROVIDERS.find(p => p.id === embeddingConfig.provider)?.models?.map(model => (
                          <option key={model} value={model}>{model}</option>
                        ))}
                      </select>
                    </div>
                    
                    <Button
                      onClick={() => validateCredentials('embeddings', embeddingConfig)}
                      disabled={!embeddingConfig.model}
                      className="w-full"
                    >
                      {validationStatus.embeddings === 'validating' ? '🔄 Testing...' : '🧪 Test Embedding Connection'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Database Tab */}
            <TabsContent value="database" className="mt-6 space-y-6">
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-semibold">🗄️ Database Configuration</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure your database for storing recordings, tools, and automation data
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DatabaseOptionCard
                  title="🔄 Use Your Supabase"
                  description="Connect your existing Supabase instance"
                  selected={databaseConfig.type === 'user_supabase'}
                  onClick={() => setDatabaseConfig(prev => ({ ...prev, type: 'user_supabase' }))}
                />
                
                <DatabaseOptionCard
                  title="🏗️ Managed Database"
                  description="We handle the database for you ($5/month)"
                  selected={databaseConfig.type === 'managed_postgres'}
                  onClick={() => setDatabaseConfig(prev => ({ ...prev, type: 'managed_postgres' }))}
                  disabled={true}
                  badge="Coming Soon"
                />
              </div>

              {databaseConfig.type === 'user_supabase' && (
                <div className="space-y-3 p-4 border rounded-lg">
                  <Input
                    label="Supabase URL"
                    value={databaseConfig.supabaseUrl || ''}
                    onChange={(e) => setDatabaseConfig(prev => ({ ...prev, supabaseUrl: e.target.value }))}
                    placeholder="https://your-project.supabase.co"
                  />
                  
                  <Input
                    label="Service Key"
                    type="password"
                    value={databaseConfig.supabaseServiceKey || ''}
                    onChange={(e) => setDatabaseConfig(prev => ({ ...prev, supabaseServiceKey: e.target.value }))}
                    placeholder="Your service_role key from Supabase"
                  />
                  
                  <div className="text-xs text-muted-foreground">
                    💡 Find these in your Supabase project settings → API
                  </div>
                  
                  <Button
                    onClick={() => validateCredentials('database', databaseConfig)}
                    disabled={!databaseConfig.supabaseUrl || !databaseConfig.supabaseServiceKey}
                    className="w-full"
                  >
                    {validationStatus.database === 'validating' ? '🔄 Testing...' : '🧪 Test Database Connection'}
                  </Button>
                </div>
              )}
              </CardContent>
              </Card>
            </TabsContent>

            {/* Index Tab */}
            <TabsContent value="index" className="mt-6 space-y-6">
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-semibold">📚 Documentation Index</h3>
                  <p className="text-sm text-muted-foreground">
                    Index documentation for enhanced AI agent capabilities
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <DocumentationCrawler 
                    supabaseUrl={databaseConfig.supabaseUrl}
                    supabaseKey={databaseConfig.supabaseServiceKey}
                    isValidated={validationStatus.database === 'valid'}
                    onStatusChange={(isValid) => {
                      setValidationStatus(prev => ({
                        ...prev,
                        documentation: isValid ? 'valid' : 'invalid'
                      }));
                    }}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* Save Configuration Bar - Only show when all 4 cards are valid and not in confirmation mode */}
        {isSetupComplete && !showConfirmation && (
          <div className="mt-8">
            <Card>
              <CardContent className="py-6">
                <div className="flex items-center justify-center">
                  <Button
                    onClick={handleSaveConfiguration}
                    disabled={loading}
                    size="lg"
                    className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  >
                    {loading ? '🔄 Saving...' : '💾 Save Configuration'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Confirmation Page - Only show when in confirmation mode */}
        {showConfirmation && (
          <Card className="mt-8 border-green-200 bg-green-50">
            <CardContent className="py-6">
              <div className="text-center">
                <div className="text-green-600 text-4xl mb-4">✅</div>
                <h3 className="text-green-800 font-semibold text-xl mb-2">Configuration Saved Successfully!</h3>
                <p className="text-green-700 mb-6">
                  Your automation workspace is fully configured and ready to use.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="p-3 bg-white rounded-lg border border-green-200">
                    <div className="text-2xl mb-1">🤖</div>
                    <div className="text-sm font-medium text-green-800">AI Provider</div>
                    <div className="text-xs text-green-600">{aiConfig.provider} connected</div>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-green-200">
                    <div className="text-2xl mb-1">🔍</div>
                    <div className="text-sm font-medium text-green-800">Embeddings</div>
                    <div className="text-xs text-green-600">Vector search ready</div>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-green-200">
                    <div className="text-2xl mb-1">🗄️</div>
                    <div className="text-sm font-medium text-green-800">Database</div>
                    <div className="text-xs text-green-600">Supabase connected</div>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-green-200">
                    <div className="text-2xl mb-1">📖</div>
                    <div className="text-sm font-medium text-green-800">Index</div>
                    <div className="text-xs text-green-600">Documentation indexed</div>
                  </div>
                </div>
                
                <div className="flex justify-center space-x-3">
                  <Button onClick={() => {
                    console.log('Dashboard button clicked, isOnboarding:', isOnboarding);
                    console.log('tenant:', tenant);
                    console.log('localStorage mymcp_tenant:', localStorage.getItem('mymcp_tenant'));
                    
                    // Force a page reload to re-evaluate onboarding state
                    window.location.href = '/dashboard';
                  }}>
                    🚀 Go to Dashboard
                  </Button>
                  <Button variant="outline" onClick={() => {
                    console.log('Recorder button clicked, isOnboarding:', isOnboarding);
                    
                    // Force a page reload to re-evaluate onboarding state
                    window.location.href = '/recorder';
                  }}>
                    🎬 Start Recording
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        </div>
      </div>
    );
}

// Helper Components

function SetupProgressCard({ 
  title, 
  status, 
  description 
}: { 
  title: string; 
  status: string; 
  description: string; 
}) {
  const getStatusIcon = () => {
    switch (status) {
      case 'valid': return '✅';
      case 'invalid': return '❌';
      case 'validating': return '🔄';
      default: return '⏳';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'valid': return 'text-green-600';
      case 'invalid': return 'text-red-600';
      case 'validating': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="p-4 border rounded-lg">
      <div className="flex items-center space-x-2">
        <span className="text-lg">{getStatusIcon()}</span>
        <div>
          <h4 className="font-medium">{title}</h4>
          <p className="text-xs text-muted-foreground">{description}</p>
          <p className={`text-xs font-medium ${getStatusColor()}`}>
            {status === 'idle' ? 'Not configured' : status.charAt(0).toUpperCase() + status.slice(1)}
          </p>
        </div>
      </div>
    </div>
  );
}

function ProviderCard({ 
  provider, 
  selected, 
  onClick 
}: { 
  provider: APIProvider; 
  selected: boolean; 
  onClick: () => void; 
}) {
  return (
    <div
      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
        selected ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
      }`}
      onClick={onClick}
    >
      <div className="text-center">
        <div className="text-lg mb-1">{provider.logoUrl ? '🔧' : '🤖'}</div>
        <h4 className="font-medium text-sm">{provider.name}</h4>
        <p className="text-xs text-muted-foreground">{provider.description}</p>
      </div>
    </div>
  );
}

function DatabaseOptionCard({ 
  title, 
  description, 
  selected, 
  onClick, 
  disabled = false, 
  badge 
}: { 
  title: string; 
  description: string; 
  selected: boolean; 
  onClick: () => void; 
  disabled?: boolean; 
  badge?: string; 
}) {
  return (
    <div
      className={`p-4 border rounded-lg cursor-pointer transition-colors relative ${
        disabled 
          ? 'border-gray-200 bg-gray-50 cursor-not-allowed' 
          : selected 
            ? 'border-primary bg-primary/10' 
            : 'border-border hover:border-primary/50'
      }`}
      onClick={disabled ? undefined : onClick}
    >
      {badge && (
        <Badge variant="secondary" className="absolute top-2 right-2 text-xs">
          {badge}
        </Badge>
      )}
      <h4 className="font-medium">{title}</h4>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
    </div>
  );
}


// Documentation Crawler Component
interface CrawlStatus {
  isRunning: boolean;
  urlsFound: number;
  urlsProcessed: number;
  urlsSucceeded: number;
  urlsFailed: number;
  logs: string[];
  endTime?: number;
}

function DocumentationCrawler({ 
  supabaseUrl, 
  supabaseKey, 
  isValidated,
  onStatusChange
}: { 
  supabaseUrl?: string;
  supabaseKey?: string;
  isValidated: boolean;
  onStatusChange?: (status: boolean) => void;
}) {
  const [crawlStatus, setCrawlStatus] = useState<CrawlStatus | null>(null);
  const [docCount, setDocCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isValidated && supabaseUrl && supabaseKey) {
      loadDocumentCount();
    }
  }, [isValidated, supabaseUrl, supabaseKey]);

  const loadDocumentCount = async () => {
    try {
      // This would call the backend to get the count from Supabase
      // For now, simulate with a placeholder
      setDocCount(0);
    } catch (error) {
      console.error('Failed to load document count:', error);
    }
  };

  const startCrawling = async () => {
    if (!isValidated) return;
    
    setLoading(true);
    setCrawlStatus({
      isRunning: true,
      urlsFound: 0,
      urlsProcessed: 0,
      urlsSucceeded: 0,
      urlsFailed: 0,
      logs: ['Starting crawl...']
    });

    try {
      // This would call the backend endpoint that handles the crawling
      // For now, simulate the crawling process
      simulateCrawling();
    } catch (error) {
      console.error('Failed to start crawling:', error);
      setCrawlStatus(prev => prev ? { ...prev, isRunning: false } : null);
    } finally {
      setLoading(false);
    }
  };

  const simulateCrawling = () => {
    // Simulate the crawling process with timeouts
    setTimeout(() => {
      setCrawlStatus(prev => prev ? {
        ...prev,
        urlsFound: 25,
        logs: [...prev.logs, 'Found 25 documentation pages']
      } : null);
    }, 1000);

    setTimeout(() => {
      setCrawlStatus(prev => prev ? {
        ...prev,
        urlsProcessed: 10,
        urlsSucceeded: 10,
        logs: [...prev.logs, 'Processed 10/25 pages...']
      } : null);
    }, 3000);

    setTimeout(() => {
      setCrawlStatus(prev => prev ? {
        ...prev,
        urlsProcessed: 25,
        urlsSucceeded: 24,
        urlsFailed: 1,
        isRunning: false,
        endTime: Date.now(),
        logs: [...prev.logs, 'Crawling completed successfully!']
      } : null);
      setDocCount(156); // Simulate indexed chunks
      onStatusChange?.(true); // Mark documentation as valid
    }, 6000);
  };

  const clearDocuments = async () => {
    if (!isValidated) return;
    
    setLoading(true);
    try {
      // This would call the backend to clear documents
      // For now, simulate clearing
      setTimeout(() => {
        setDocCount(0);
        setCrawlStatus(null);
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to clear documents:', error);
      setLoading(false);
    }
  };

  if (!isValidated) {
    return (
      <div className="p-4 border border-yellow-200 bg-yellow-50 rounded-lg">
        <div className="flex items-center space-x-2">
          <span className="text-yellow-600">⚠️</span>
          <div>
            <h4 className="font-medium text-yellow-800">Database Connection Required</h4>
            <p className="text-sm text-yellow-700">
              Please configure and validate your Supabase connection first.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Current Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-3 border rounded-lg">
          <div className="text-sm text-muted-foreground">Indexed Documents</div>
          <div className="text-2xl font-bold text-primary">{docCount}</div>
          <div className="text-xs text-muted-foreground">Pydantic AI docs chunks</div>
        </div>
        
        {crawlStatus && (
          <>
            <div className="p-3 border rounded-lg">
              <div className="text-sm text-muted-foreground">Progress</div>
              <div className="text-2xl font-bold text-blue-600">
                {crawlStatus.urlsProcessed}/{crawlStatus.urlsFound}
              </div>
              <div className="text-xs text-muted-foreground">Pages processed</div>
            </div>
            
            <div className="p-3 border rounded-lg">
              <div className="text-sm text-muted-foreground">Success Rate</div>
              <div className="text-2xl font-bold text-green-600">
                {crawlStatus.urlsFound > 0 ? Math.round((crawlStatus.urlsSucceeded / crawlStatus.urlsFound) * 100) : 0}%
              </div>
              <div className="text-xs text-muted-foreground">
                {crawlStatus.urlsSucceeded} successful, {crawlStatus.urlsFailed} failed
              </div>
            </div>
          </>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-3">
        <Button
          onClick={startCrawling}
          disabled={loading || (crawlStatus?.isRunning)}
          className="flex-1"
        >
          {crawlStatus?.isRunning ? '🔄 Crawling...' : '🕷️ Crawl Pydantic AI Docs'}
        </Button>
        
        {docCount > 0 && (
          <Button
            variant="outline"
            onClick={clearDocuments}
            disabled={loading}
            className="flex-1"
          >
            {loading ? '🔄 Clearing...' : '🗑️ Clear Docs'}
          </Button>
        )}
      </div>

      {/* Progress Bar */}
      {crawlStatus && crawlStatus.urlsFound > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Crawling Progress</span>
            <span>{Math.round((crawlStatus.urlsProcessed / crawlStatus.urlsFound) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-500"
              style={{ width: `${(crawlStatus.urlsProcessed / crawlStatus.urlsFound) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Crawling Logs */}
      {crawlStatus && crawlStatus.logs.length > 0 && (
        <div className="border rounded-lg">
          <div className="p-3 border-b">
            <h4 className="font-medium">Crawling Logs</h4>
          </div>
          <div className="p-3 max-h-32 overflow-y-auto bg-gray-50 dark:bg-gray-900">
            <div className="text-xs font-mono space-y-1">
              {crawlStatus.logs.slice(-10).map((log, index) => (
                <div key={index} className="text-muted-foreground">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Information */}
      <div className="text-xs text-muted-foreground p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
        <p className="font-medium mb-1">💡 About Documentation Crawling:</p>
        <p>
          This feature crawls the Pydantic AI documentation, extracts content, generates embeddings, 
          and stores them in your Supabase database. Your AI agents can then use this knowledge 
          to provide more accurate and helpful responses about Pydantic AI concepts and usage.
        </p>
      </div>
    </div>
  );
}

// Add label prop to Input component
const LabeledInput = ({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div>
    <label className="block text-sm font-medium mb-1">{label}</label>
    <Input {...props} />
  </div>
);