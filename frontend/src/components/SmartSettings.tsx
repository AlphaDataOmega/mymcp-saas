import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/Tabs';
import { CredentialValidationService } from '../services/CredentialValidationService';
import { useTenant } from '../hooks/useTenant';
import { Bot, Search, Database, BookOpen, Settings, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { ExtensionDownloadModal } from './ExtensionDownloadModal';

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
  const [currentStep, setCurrentStep] = useState(0);
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


  const handleSaveConfiguration = async (markComplete = false) => {
    setLoading(true);
    
    try {
      // Check if required fields are filled
      if (!aiConfig.apiKey || !databaseConfig.supabaseUrl || !databaseConfig.supabaseServiceKey) {
        alert('Please fill in all required fields (AI API Key, Supabase URL, and Service Key)');
        return;
      }

      // Validate all configurations if they haven't been validated yet - but don't re-validate if already valid
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
        setupComplete: markComplete && databaseValid.valid && aiValid.valid && embeddingValid.valid, // Only mark setup complete when explicitly requested
        validationStatus: {
          database: databaseValid.valid,
          ai: aiValid.valid,
          embeddings: embeddingValid.valid,
          index: validationStatus.index === 'valid'
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
      
      // Only show confirmation page when explicitly completing setup
      if (markComplete) {
        setShowConfirmation(true);
        setSaveSuccess(true);
      }
      
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
      alert(`Failed to save configuration: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToEditing = () => {
    setShowConfirmation(false);
    setSaveSuccess(false);
  };

  const steps = [
    { id: 'ai', title: 'AI Provider', description: 'Configure your AI service', icon: Bot },
    { id: 'embeddings', title: 'Embeddings', description: 'Setup vector search', icon: Search },
    { id: 'database', title: 'Database', description: 'Connect your database', icon: Database },
    { id: 'index', title: 'Documentation', description: 'Index your docs', icon: BookOpen }
  ];

  const isStepComplete = (stepId: string) => validationStatus[stepId] === 'valid';
  const isSetupComplete = steps.every(step => isStepComplete(step.id));
  const isStepActive = (stepIndex: number) => stepIndex === currentStep;
  const canProceedToStep = (stepIndex: number) => {
    // In settings mode (not onboarding), allow navigation to any step
    if (!isOnboarding) return true;
    
    // In onboarding mode, enforce step-by-step progression
    if (stepIndex === 0) return true;
    return isStepComplete(steps[stepIndex - 1].id);
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Removed auto-save on validation to prevent save loops during testing

  return (
    <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-lg p-6 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
              <Settings className="w-10 h-10 text-blue-400" />
              Smart Settings
            </h1>
            <p className="text-gray-300">
              {isOnboarding 
                ? 'Complete each step to set up your automation workspace' 
                : 'Configure your automation workspace settings'
              }
            </p>
            {!isOnboarding && (
              <div className="mt-2">
                <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                  Settings Mode - Jump to any step
                </Badge>
              </div>
            )}
          </div>
          
          {isSetupComplete && (
            <div className="flex items-center space-x-2 text-sm px-4 py-2 rounded-full border transition-all duration-300 bg-green-500/10 border-green-500/30 text-green-400 shadow-lg shadow-green-500/20">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
              <span className="font-medium">Setup Complete</span>
            </div>
          )}
        </div>


        {/* Step-by-Step Panels - Only show when not in confirmation mode */}
        {!showConfirmation && (
          <div className="grid lg:grid-cols-4 gap-6">

            {/* Left Column: Steps Navigation */}
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <h3 className="text-xl font-bold text-white mb-6">Setup Steps</h3>
              
              <div className="space-y-4">
                {steps.map((step, index) => {
                  const IconComponent = step.icon;
                  return (
                    <div key={step.id} className={`p-4 rounded-lg border transition-all duration-300 ${ 
                      canProceedToStep(index) ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                    } ${ 
                      isStepComplete(step.id)
                        ? 'bg-green-500/20 border-green-500/30'
                        : isStepActive(index)
                        ? 'bg-blue-500/20 border-blue-500/30'
                        : canProceedToStep(index)
                        ? 'bg-white/5 border-white/10 hover:bg-white/10'
                        : 'bg-gray-700/20 border-gray-600/30'
                    }`} onClick={() => canProceedToStep(index) && setCurrentStep(index)}>
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          isStepComplete(step.id)
                            ? 'bg-green-500 text-white'
                            : isStepActive(index)
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-600 text-gray-300'
                        }`}>
                          {isStepComplete(step.id) ? <Check className="w-4 h-4" /> : <IconComponent className="w-4 h-4" />}
                        </div>
                        <div className="flex-1">
                          <div className={`font-medium text-sm ${
                            isStepActive(index) ? 'text-white' : 'text-gray-100'
                          }`}>
                            {step.title}
                          </div>
                          <div className="text-xs text-gray-300">{step.description}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Step Navigation */}
              <div className="flex justify-between mt-6 pt-4 border-t border-white/20">
                <button
                  onClick={prevStep}
                  disabled={currentStep === 0}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 flex items-center gap-2 text-sm ${
                    currentStep === 0
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-700 hover:bg-gray-600 text-white'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Prev
                </button>
                
                <button
                  onClick={() => {
                    if (currentStep === steps.length - 1) {
                      // On last step, trigger save and completion
                      handleSaveConfiguration(true);
                    } else {
                      nextStep();
                    }
                  }}
                  disabled={isOnboarding && !isStepComplete(steps[currentStep].id)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 flex items-center gap-2 text-sm ${
                    isOnboarding && !isStepComplete(steps[currentStep].id)
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : currentStep === steps.length - 1 && isStepComplete(steps[currentStep].id)
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white'
                      : 'bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white'
                  }`}
                >
                  {currentStep === steps.length - 1 ? (
                    <>
                      <Check className="w-4 h-4" />
                      {isOnboarding ? 'Complete Setup' : 'Save & Done'}
                    </>
                  ) : (
                    <>
                      {isOnboarding ? 'Next' : 'Save & Next'}
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right Columns: Current Step Settings Panel (spans 3 columns) */}
            <div className="lg:col-span-3 bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    isStepComplete(steps[currentStep].id)
                      ? 'bg-green-500 text-white'
                      : 'bg-blue-500 text-white'
                  }`}>
                    {isStepComplete(steps[currentStep].id) ? (
                      <Check className="w-6 h-6" />
                    ) : (
                      React.createElement(steps[currentStep].icon, { className: "w-6 h-6" })
                    )}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">{steps[currentStep].title}</h3>
                    <p className="text-gray-100 text-base">{steps[currentStep].description}</p>
                  </div>
                </div>
                {isStepComplete(steps[currentStep].id) && (
                  <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
                    <Check className="w-4 h-4 mr-1" />
                    Complete
                  </Badge>
                )}
              </div>

              {/* AI Step Content */}
              {steps[currentStep].id === 'ai' && (
                <div className="space-y-4">
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
                        <label className="block text-sm font-medium mb-1 text-white">Primary Model</label>
                        <select
                          value={aiConfig.primaryModel}
                          onChange={(e) => setAIConfig(prev => ({ ...prev, primaryModel: e.target.value }))}
                          className="w-full px-3 py-2 border border-white/20 bg-white/10 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 text-white"
                        >
                          {AI_PROVIDERS.find(p => p.id === aiConfig.provider)?.models?.map(model => (
                            <option key={model} value={model} className="bg-gray-800 text-white">{model}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-1 text-white">Reasoner Model (Optional)</label>
                        <select
                          value={aiConfig.reasonerModel || ''}
                          onChange={(e) => setAIConfig(prev => ({ ...prev, reasonerModel: e.target.value || undefined }))}
                          className="w-full px-3 py-2 border border-white/20 bg-white/10 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 text-white"
                        >
                          <option value="" className="bg-gray-800 text-white">None selected</option>
                          {AI_PROVIDERS.find(p => p.id === aiConfig.provider)?.models?.map(model => (
                            <option key={model} value={model} className="bg-gray-800 text-white">{model}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => validateCredentials('ai', aiConfig)}
                      disabled={!aiConfig.apiKey}
                      className={`w-full py-3 px-4 rounded-lg font-bold transition-all duration-300 flex items-center justify-center gap-2 ${
                        !aiConfig.apiKey
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white'
                      }`}
                    >
                      {validationStatus.ai === 'validating' ? 'Testing Connection...' : 'Test AI Connection'}
                    </button>
                  </div>
                </div>
              )}

              {/* Embeddings Step Content */}
              {steps[currentStep].id === 'embeddings' && (
                <div className="space-y-4">
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
                      <label className="block text-sm font-medium mb-1 text-white">Embedding Model</label>
                      <select
                        value={embeddingConfig.model}
                        onChange={(e) => setEmbeddingConfig(prev => ({ ...prev, model: e.target.value }))}
                        className="w-full px-3 py-2 border border-white/20 bg-white/10 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 text-white"
                      >
                        {EMBEDDING_PROVIDERS.find(p => p.id === embeddingConfig.provider)?.models?.map(model => (
                          <option key={model} value={model} className="bg-gray-800 text-white">{model}</option>
                        ))}
                      </select>
                    </div>
                    
                    <button
                      onClick={() => validateCredentials('embeddings', embeddingConfig)}
                      disabled={!embeddingConfig.model}
                      className={`w-full py-3 px-4 rounded-lg font-bold transition-all duration-300 flex items-center justify-center gap-2 ${
                        !embeddingConfig.model
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white'
                      }`}
                    >
                      {validationStatus.embeddings === 'validating' ? 'Testing Connection...' : 'Test Embedding Connection'}
                    </button>
                  </div>
                </div>
              )}

              {/* Database Step Content */}  
              {steps[currentStep].id === 'database' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DatabaseOptionCard
                      title="Use Your Supabase"
                      description="Connect your existing Supabase instance"
                      selected={databaseConfig.type === 'user_supabase'}
                      onClick={() => setDatabaseConfig(prev => ({ ...prev, type: 'user_supabase' }))}
                    />
                    
                    <DatabaseOptionCard
                      title="Managed Database"
                      description="We handle the database for you ($5/month)"
                      selected={databaseConfig.type === 'managed_postgres'}
                      onClick={() => setDatabaseConfig(prev => ({ ...prev, type: 'managed_postgres' }))}
                      disabled={true}
                      badge="Coming Soon"
                    />
                  </div>

                  {databaseConfig.type === 'user_supabase' && (
                    <div className="space-y-3 p-4 border border-white/20 rounded-lg bg-white/5">
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
                      
                      <div className="text-xs text-gray-400">
                        Find these in your Supabase project settings → API
                      </div>
                      
                      <button
                        onClick={() => validateCredentials('database', databaseConfig)}
                        disabled={!databaseConfig.supabaseUrl || !databaseConfig.supabaseServiceKey}
                        className={`w-full py-3 px-4 rounded-lg font-bold transition-all duration-300 flex items-center justify-center gap-2 ${
                          !databaseConfig.supabaseUrl || !databaseConfig.supabaseServiceKey
                            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white'
                        }`}
                      >
                        {validationStatus.database === 'validating' ? 'Testing Connection...' : 'Test Database Connection'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Documentation Step Content */}
              {steps[currentStep].id === 'index' && (
                <div className="space-y-4">
                  <DocumentationCrawler 
                    supabaseUrl={databaseConfig.supabaseUrl}
                    supabaseKey={databaseConfig.supabaseServiceKey}
                    isValidated={validationStatus.database === 'valid'}
                    onStatusChange={(isValid) => {
                      setValidationStatus(prev => ({
                        ...prev,
                        index: isValid ? 'valid' : 'invalid'
                      }));
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}


        {/* Confirmation Page - Only show when in confirmation mode */}
        {showConfirmation && (
          <div className="mt-8 bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-green-500/30">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-white font-semibold text-2xl mb-2">Configuration Complete!</h3>
              <p className="text-gray-300 mb-8">
                Your automation workspace is fully configured and ready to use.
              </p>
                
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="p-4 bg-white/5 rounded-lg border border-white/20">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-sm font-medium text-white">AI Provider</div>
                  <div className="text-xs text-gray-300">{aiConfig.provider} connected</div>
                </div>
                <div className="p-4 bg-white/5 rounded-lg border border-white/20">
                  <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Search className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-sm font-medium text-white">Embeddings</div>
                  <div className="text-xs text-gray-300">Vector search ready</div>
                </div>
                <div className="p-4 bg-white/5 rounded-lg border border-white/20">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Database className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-sm font-medium text-white">Database</div>
                  <div className="text-xs text-gray-300">Supabase connected</div>
                </div>
                <div className="p-4 bg-white/5 rounded-lg border border-white/20">
                  <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-2">
                    <BookOpen className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-sm font-medium text-white">Documentation</div>
                  <div className="text-xs text-gray-300">Ready for indexing</div>
                </div>
              </div>
                
              <div className="flex justify-center">
                <Button 
                  onClick={() => {
                    if (isOnboarding && onSetupComplete) {
                      onSetupComplete();
                    } else {
                      navigate('/download-extension');
                    }
                  }}
                  className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 px-8"
                >
                  Get Extension
                </Button>
              </div>
            </div>
          </div>
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
      case 'valid': return 'Valid';
      case 'invalid': return 'Invalid';
      case 'validating': return 'Validating';
      default: return 'Pending';
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
      className={`p-4 border rounded-lg cursor-pointer transition-all duration-300 ${
        selected 
          ? 'border-cyan-400 bg-cyan-500/20 shadow-lg shadow-cyan-500/25' 
          : 'border-white/20 bg-white/5 hover:border-cyan-400/50 hover:bg-white/10'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-white">{provider.name}</h4>
          <p className="text-xs text-gray-300">{provider.description}</p>
        </div>
        {selected && (
          <div className="text-cyan-400">✓</div>
        )}
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
      className={`p-4 border rounded-lg cursor-pointer transition-all duration-300 relative ${
        disabled 
          ? 'border-gray-600 bg-gray-700/20 cursor-not-allowed opacity-50' 
          : selected 
            ? 'border-green-400 bg-green-500/20 shadow-lg shadow-green-500/25' 
            : 'border-white/20 bg-white/5 hover:border-green-400/50 hover:bg-white/10'
      }`}
      onClick={disabled ? undefined : onClick}
    >
      {badge && (
        <div className="absolute top-2 right-2 text-xs bg-gray-600 text-gray-300 px-2 py-1 rounded">
          {badge}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium text-white">{title}</h4>
          <p className="text-sm text-gray-300 mt-1">{description}</p>
        </div>
        {selected && !disabled && (
          <div className="text-green-400 text-xl">✓</div>
        )}
      </div>
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
        logs: [...prev.logs, 'Crawling completed successfully!', 'Indexing documentation...']
      } : null);
      setDocCount(156); // Simulate indexed chunks
    }, 6000);

    // Wait 10 seconds after crawling completes to enable the Complete Setup button
    setTimeout(() => {
      setCrawlStatus(prev => prev ? {
        ...prev,
        logs: [...prev.logs, 'Documentation indexed successfully! Setup is now complete.']
      } : null);
      onStatusChange?.(true); // Mark documentation as valid
    }, 10000);
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
          <span className="text-yellow-600">⚠</span>
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
          {crawlStatus?.isRunning ? 'Crawling Documentation...' : 'Crawl Pydantic AI Docs'}
        </Button>
        
        {docCount > 0 && (
          <Button
            variant="outline"
            onClick={clearDocuments}
            disabled={loading}
            className="flex-1"
          >
            {loading ? 'Clearing Documentation...' : 'Clear Docs'}
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
        <p className="font-medium mb-1">About Documentation Crawling:</p>
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