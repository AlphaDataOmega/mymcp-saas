import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Components
import { Dashboard } from './components/Dashboard';
import { RecorderStudio } from './components/RecorderStudio';
import { ToolManager } from './components/ToolManager';
import { Marketplace } from './components/Marketplace';
import { SmartSettings } from './components/SmartSettings';
import { PaymentGate } from './components/PaymentGate';
import { PluginDownload } from './components/PluginDownload';
import { OnboardingComplete } from './components/OnboardingComplete';

// Providers and Hooks
import { TenantProvider } from './providers/TenantProvider';
import { ThemeProvider } from './providers/ThemeProvider';
import { NavigationSidebar } from './components/NavigationSidebar';
import { Header } from './components/Header';

// Types
import { Tenant, OnboardingStep, PricingPlan } from './types/tenant';

// Styles
import './styles/globals.css';

function AppContent() {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('landing');
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Check if user has an existing tenant setup
      const savedTenant = localStorage.getItem('mymcp_tenant');
      if (savedTenant) {
        const tenantData = JSON.parse(savedTenant);
        setTenant(tenantData);
        
        // Determine current step based on tenant state
        if (tenantData.status === 'active' && tenantData.settings?.setupComplete) {
          setCurrentStep('complete');
        } else if (tenantData.settings?.credentialsConfigured) {
          setCurrentStep('plugin');
        } else if (tenantData.settings?.paymentComplete) {
          setCurrentStep('credentials');
        } else {
          setCurrentStep('payment');
        }
      } else {
        // New user, start from landing
        setCurrentStep('landing');
      }
    } catch (error) {
      console.error('Failed to initialize app:', error);
      setCurrentStep('landing');
    } finally {
      setLoading(false);
    }
  };

  const handleOnboardingStepComplete = (step: OnboardingStep, data?: any) => {
    switch (step) {
      case 'landing':
        // User entered username, provision tenant and show payment
        provisionTenant(data.username).then(() => {
          setCurrentStep('payment');
        });
        break;
        
      case 'payment':
        // Payment completed, update tenant and show credentials
        updateTenantSettings({ paymentComplete: true, plan: data.plan });
        setCurrentStep('credentials');
        break;
        
      case 'credentials':
        // Credentials configured, show plugin download
        updateTenantSettings({ credentialsConfigured: true });
        setCurrentStep('plugin');
        break;
        
      case 'plugin':
        // Plugin installed, show completion
        updateTenantSettings({ pluginInstalled: true });
        setCurrentStep('complete');
        break;
        
      case 'complete':
        // Setup complete, redirect to main app
        updateTenantSettings({ setupComplete: true });
        redirectToAction(data.action);
        break;
    }
  };

  const provisionTenant = async (username: string) => {
    try {
      const newTenant: Tenant = {
        id: generateTenantId(),
        userId: generateUserId(),
        subdomain: username,
        status: 'provisioning',
        instance: {
          subdomain: `${username}.mymcp.me`,
          backendUrl: `https://${username}-api.mymcp.me`,
          frontendUrl: `https://${username}.mymcp.me`,
          status: 'provisioning'
        },
        settings: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      setTenant(newTenant);
      localStorage.setItem('mymcp_tenant', JSON.stringify(newTenant));
      
      // Simulate backend provisioning
      setTimeout(() => {
        updateTenantSettings({ 
          status: 'active',
          instance: { ...newTenant.instance, status: 'running' }
        });
      }, 2000);
      
    } catch (error) {
      console.error('Failed to provision tenant:', error);
    }
  };

  const updateTenantSettings = (updates: any) => {
    if (tenant) {
      const updatedTenant = {
        ...tenant,
        ...updates,
        settings: { ...tenant.settings, ...updates },
        updatedAt: new Date().toISOString()
      };
      setTenant(updatedTenant);
      localStorage.setItem('mymcp_tenant', JSON.stringify(updatedTenant));
    }
  };

  const redirectToAction = (action: string) => {
    const routes = {
      'start-recording': '/recorder',
      'create-agent': '/agents',
      'browse-tools': '/tools'
    };
    
    window.location.href = routes[action as keyof typeof routes] || '/dashboard';
  };

  const generateTenantId = () => `tenant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const generateUserId = () => `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show onboarding flow if not complete
  console.log('App check - currentStep:', currentStep, 'setupComplete:', tenant?.settings?.setupComplete, 'tenant:', tenant);
  
  if (currentStep !== 'complete' || !tenant?.settings?.setupComplete) {
    return (
      <div className="min-h-screen bg-background">
        <OnboardingFlow 
          currentStep={currentStep}
          tenant={tenant}
          onStepComplete={handleOnboardingStepComplete}
        />
      </div>
    );
  }

  // Show main application
  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Sidebar Navigation */}
        <NavigationSidebar />
        
        {/* Main Content */}
        <div className="flex-1 ml-64">
          {/* Header */}
          <Header tenant={tenant} connectionStatus="disconnected" />
          
          {/* Page Content */}
          <main className="p-8 min-h-[calc(100vh-4rem)]">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/recorder" element={<RecorderStudio />} />
              <Route path="/tools" element={<ToolManager />} />
              <Route path="/marketplace" element={<Marketplace />} />
              <Route path="/settings" element={<SmartSettings />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
}

// Onboarding Flow Component
function OnboardingFlow({ 
  currentStep, 
  tenant, 
  onStepComplete 
}: { 
  currentStep: OnboardingStep;
  tenant: Tenant | null;
  onStepComplete: (step: OnboardingStep, data?: any) => void;
}) {
  const handlePlanSelected = (plan: PricingPlan, skipped: boolean = false) => {
    onStepComplete('payment', { plan, skipped });
  };

  const handleCredentialsComplete = () => {
    onStepComplete('credentials');
  };

  const handlePluginInstalled = () => {
    onStepComplete('plugin');
  };

  const handleActionSelected = (action: string) => {
    onStepComplete('complete', { action });
  };

  switch (currentStep) {
    case 'landing':
      return (
        <LandingPage 
          onUsernameSubmit={(username) => onStepComplete('landing', { username })}
        />
      );
      
    case 'payment':
      return (
        <PaymentGate 
          onPlanSelected={handlePlanSelected}
        />
      );
      
    case 'credentials':
      return (
        <SmartSettings 
          onSetupComplete={handleCredentialsComplete}
          isOnboarding={true}
        />
      );
      
    case 'plugin':
      return (
        <PluginDownload 
          tenant={tenant}
          onPluginInstalled={handlePluginInstalled}
        />
      );
      
    case 'complete':
      return (
        <OnboardingComplete 
          tenant={tenant}
          onActionSelected={handleActionSelected}
        />
      );
      
    default:
      return <div>Loading...</div>;
  }
}

// Landing Page Component
function LandingPage({ 
  onUsernameSubmit 
}: { 
  onUsernameSubmit: (username: string) => void; 
}) {
  const [username, setUsername] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim()) return;
    
    setIsValidating(true);
    
    // Simulate validation
    setTimeout(() => {
      onUsernameSubmit(username.toLowerCase().replace(/[^a-z0-9]/g, ''));
      setIsValidating(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          {/* Logo and Title */}
          <div className="mb-12">
            <h1 className="text-6xl font-bold bg-gradient-to-r from-indigo-600 to-cyan-600 bg-clip-text text-transparent mb-6">
              MyMCP.me
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Your personal automation workspace powered by AI
            </p>
            <p className="text-gray-500">
              Record browser actions → Generate tools → Create intelligent agents
            </p>
          </div>

          {/* Username Form */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
            <h2 className="text-2xl font-semibold mb-6">Choose your workspace</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <div className="flex items-center space-x-2 text-lg">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="your-username"
                    className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-center font-mono"
                    pattern="[a-zA-Z0-9-]+"
                    maxLength={20}
                    required
                  />
                  <span className="text-gray-500">.mymcp.me</span>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Only letters, numbers, and hyphens allowed
                </p>
              </div>
              
              <button
                type="submit"
                disabled={!username.trim() || isValidating}
                className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-indigo-700 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isValidating ? '🔄 Creating workspace...' : '🚀 Create My Workspace'}
              </button>
            </form>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="bg-white rounded-lg p-6 shadow-lg">
              <div className="text-3xl mb-3">🎬</div>
              <h3 className="font-semibold mb-2">Record Actions</h3>
              <p className="text-gray-600 text-sm">
                Capture browser interactions and automatically generate reusable tools
              </p>
            </div>
            
            <div className="bg-white rounded-lg p-6 shadow-lg">
              <div className="text-3xl mb-3">🤖</div>
              <h3 className="font-semibold mb-2">AI Agents</h3>
              <p className="text-gray-600 text-sm">
                Create intelligent agents that can execute complex workflows using your tools
              </p>
            </div>
            
            <div className="bg-white rounded-lg p-6 shadow-lg">
              <div className="text-3xl mb-3">🔧</div>
              <h3 className="font-semibold mb-2">Tool Marketplace</h3>
              <p className="text-gray-600 text-sm">
                Discover and install tools created by the community
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main App Component with Providers
export function App() {
  return (
    <ThemeProvider>
      <TenantProvider>
        <Router>
          <AppContent />
        </Router>
      </TenantProvider>
    </ThemeProvider>
  );
}

export default App;