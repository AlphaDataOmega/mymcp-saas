// Onboarding Complete - User chooses their first action after plugin installation

import React, { useState, useEffect } from 'react';
import { useTenant } from '../hooks/useTenant';

interface OnboardingCompleteProps {
  onActionSelected: (action: 'create-agent' | 'browse-tools' | 'start-recording') => void;
}

export function OnboardingComplete({ onActionSelected }: OnboardingCompleteProps) {
  const { tenant } = useTenant();
  const [pluginConnected, setPluginConnected] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(true);

  // Check plugin connection status
  useEffect(() => {
    const checkPluginConnection = async () => {
      try {
        // Check if browser extension is connected
        const response = await fetch(`${tenant?.instance.backendUrl}/recorder/connection-status`);
        const data = await response.json();
        setPluginConnected(data.connected || false);
      } catch (error) {
        setPluginConnected(false);
      } finally {
        setCheckingConnection(false);
      }
    };

    const interval = setInterval(checkPluginConnection, 2000);
    checkPluginConnection();

    return () => clearInterval(interval);
  }, [tenant]);

  const actionCards = [
    {
      id: 'start-recording',
      title: '🎬 Start Recording',
      description: 'Record your browser actions to create automation tools',
      features: [
        'Visual recording interface',
        'Live action preview',
        'Auto-generate Python tools',
        'One-click deployment'
      ],
      buttonText: 'Start Recording',
      buttonColor: 'from-red-500 to-pink-600',
      icon: '🎬',
      recommended: true
    },
    {
      id: 'create-agent',
      title: '🤖 Create Agent',
      description: 'Build an AI agent using available tools and integrations',
      features: [
        'Natural language interface',
        'Access to all your tools',
        'Multi-step workflows',
        'Conversation history'
      ],
      buttonText: 'Create Agent',
      buttonColor: 'from-blue-500 to-cyan-600',
      icon: '🤖'
    },
    {
      id: 'browse-tools',
      title: '🔧 Browse Tools',
      description: 'Explore and install tools from the marketplace',
      features: [
        'Curated tool library',
        'One-click installation',
        'OAuth integrations',
        'Community contributions'
      ],
      buttonText: 'Browse Tools',
      buttonColor: 'from-green-500 to-emerald-600',
      icon: '🔧'
    }
  ];

  const PluginConnectionStatus = () => {
    if (checkingConnection) {
      return (
        <div className="mb-8 p-4 bg-blue-500/20 rounded-lg border border-blue-500/30">
          <div className="flex items-center">
            <div className="animate-spin w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full mr-3"></div>
            <span className="text-blue-300">Checking browser extension connection...</span>
          </div>
        </div>
      );
    }

    if (!pluginConnected) {
      return (
        <div className="mb-8 p-6 bg-yellow-500/20 rounded-lg border border-yellow-500/30">
          <div className="text-center">
            <h3 className="text-yellow-300 font-semibold mb-2">🔌 Browser Extension Not Connected</h3>
            <p className="text-yellow-200 mb-4">
              Please make sure you've installed and activated the MyMCP browser extension.
            </p>
            <div className="space-y-2 text-sm text-yellow-200">
              <p>1. Click the extension icon in your browser toolbar</p>
              <p>2. Click "Connect to MyMCP.me"</p>
              <p>3. Wait for the green connection indicator</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="mb-8 p-4 bg-green-500/20 rounded-lg border border-green-500/30">
        <div className="flex items-center justify-center">
          <div className="w-3 h-3 bg-green-400 rounded-full mr-3 animate-pulse"></div>
          <span className="text-green-300 font-medium">✅ Browser extension connected successfully!</span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-6xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="mb-6">
            <div className="w-20 h-20 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🎉</span>
            </div>
            <h1 className="text-4xl font-bold text-white mb-4">
              Welcome to Your Automation Workspace!
            </h1>
            <p className="text-xl text-gray-300">
              Your personal instance is ready at{' '}
              <span className="text-cyan-400 font-mono">
                {tenant?.instance.frontendUrl}
              </span>
            </p>
          </div>

          {/* Plugin Connection Status */}
          <PluginConnectionStatus />

          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">
              What would you like to do first?
            </h2>
            <p className="text-gray-300">
              Choose your starting point to begin automating your workflows
            </p>
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {actionCards.map((action) => (
            <div
              key={action.id}
              className={`relative bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 hover:border-white/40 hover:bg-white/15 transition-all duration-300 cursor-pointer group ${
                action.recommended ? 'ring-2 ring-cyan-400' : ''
              }`}
              onClick={() => pluginConnected && onActionSelected(action.id as any)}
            >
              {action.recommended && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-to-r from-cyan-400 to-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                    Recommended First
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                <div className="text-4xl mb-4">{action.icon}</div>
                <h3 className="text-2xl font-bold text-white mb-2">{action.title}</h3>
                <p className="text-gray-300">{action.description}</p>
              </div>

              <div className="space-y-3 mb-8">
                {action.features.map((feature, index) => (
                  <div key={index} className="flex items-center text-sm">
                    <span className="text-green-400 mr-2">✓</span>
                    <span className="text-gray-300">{feature}</span>
                  </div>
                ))}
              </div>

              <button
                disabled={!pluginConnected}
                className={`w-full bg-gradient-to-r ${action.buttonColor} hover:opacity-90 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group-hover:scale-105`}
              >
                {action.buttonText}
              </button>
            </div>
          ))}
        </div>

        {/* Setup Summary */}
        <div className="bg-white/5 backdrop-blur rounded-xl p-6 mb-8">
          <h3 className="text-white font-semibold mb-4">🎯 Your Setup Summary</h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center">
              <span className="text-green-400 mr-2">✅</span>
              <span className="text-gray-300">Workspace: {tenant?.subdomain}.mymcp.me</span>
            </div>
            <div className="flex items-center">
              <span className="text-green-400 mr-2">✅</span>
              <span className="text-gray-300">Database: Connected</span>
            </div>
            <div className="flex items-center">
              <span className="text-green-400 mr-2">✅</span>
              <span className="text-gray-300">AI Provider: Configured</span>
            </div>
            <div className="flex items-center">
              <span className={pluginConnected ? 'text-green-400' : 'text-yellow-400'}>
                {pluginConnected ? '✅' : '⏳'}
              </span>
              <span className="text-gray-300 ml-2">
                Browser Extension: {pluginConnected ? 'Connected' : 'Pending'}
              </span>
            </div>
            <div className="flex items-center">
              <span className="text-green-400 mr-2">✅</span>
              <span className="text-gray-300">Plan: {tenant?.tier?.toUpperCase()}</span>
            </div>
            <div className="flex items-center">
              <span className="text-green-400 mr-2">✅</span>
              <span className="text-gray-300">Ready to Automate</span>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="text-center">
          <p className="text-gray-400 text-sm mb-4">
            Need help getting started? Check out these resources:
          </p>
          <div className="flex justify-center space-x-6 text-sm">
            <a href="#" className="text-cyan-400 hover:text-cyan-300 transition-colors">
              📖 Documentation
            </a>
            <a href="#" className="text-cyan-400 hover:text-cyan-300 transition-colors">
              🎥 Video Tutorials
            </a>
            <a href="#" className="text-cyan-400 hover:text-cyan-300 transition-colors">
              💬 Community Forum
            </a>
            <a href="#" className="text-cyan-400 hover:text-cyan-300 transition-colors">
              ⚙️ Settings
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}