// Plugin Download Component - User downloads and installs browser extension

import React, { useState, useEffect } from 'react';
import { useTenant } from '../hooks/useTenant';

interface PluginDownloadProps {
  onPluginInstalled: () => void;
}

export function PluginDownload({ onPluginInstalled }: PluginDownloadProps) {
  const { tenant } = useTenant();
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connected' | 'checking'>('disconnected');

  // Check for plugin connection every 3 seconds after download
  useEffect(() => {
    if (!downloadStarted) return;

    const checkConnection = async () => {
      setConnectionStatus('checking');
      try {
        const response = await fetch(`${tenant?.instance.backendUrl}/recorder/connection-status`);
        const data = await response.json();
        
        if (data.connected) {
          setConnectionStatus('connected');
          setTimeout(() => {
            onPluginInstalled();
          }, 2000); // Give user time to see success message
        } else {
          setConnectionStatus('disconnected');
        }
      } catch (error) {
        setConnectionStatus('disconnected');
      }
    };

    const interval = setInterval(checkConnection, 3000);
    checkConnection();

    return () => clearInterval(interval);
  }, [downloadStarted, tenant, onPluginInstalled]);

  const handleDownload = () => {
    setDownloadStarted(true);
    setCheckingConnection(true);
    
    // Create download link for the extension
    const link = document.createElement('a');
    link.href = '/assets/mymcp-browser-extension.zip'; // Will be served from CDN
    link.download = 'mymcp-browser-extension.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const installationSteps = [
    {
      step: 1,
      title: 'Download Extension',
      description: 'Click the download button to get the MyMCP browser extension',
      status: downloadStarted ? 'completed' : 'current'
    },
    {
      step: 2,
      title: 'Extract Files',
      description: 'Unzip the downloaded file to any folder on your computer',
      status: downloadStarted ? 'current' : 'pending'
    },
    {
      step: 3,
      title: 'Install in Browser',
      description: 'Open Chrome/Edge extensions, enable Developer mode, click "Load unpacked"',
      status: downloadStarted ? 'current' : 'pending'
    },
    {
      step: 4,
      title: 'Connect Extension',
      description: 'Click the extension icon and connect to your workspace',
      status: connectionStatus === 'connected' ? 'completed' : (downloadStarted ? 'current' : 'pending')
    }
  ];

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✅';
      case 'current': return '🔄';
      default: return '⏳';
    }
  };

  const getStepColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400';
      case 'current': return 'text-cyan-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">🔌</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Install Browser Extension
          </h1>
          <p className="text-xl text-gray-300 mb-2">
            Connect your browser to{' '}
            <span className="text-cyan-400 font-mono">
              {tenant?.subdomain}.mymcp.me
            </span>
          </p>
          <p className="text-gray-400">
            The extension enables browser automation and recording capabilities
          </p>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-2 gap-12">
          {/* Left Side: Download */}
          <div className="space-y-8">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
              <h3 className="text-2xl font-bold text-white mb-6">
                📦 MyMCP Browser Extension
              </h3>
              
              <div className="space-y-4 mb-8">
                <div className="flex items-center">
                  <span className="text-green-400 mr-3">✓</span>
                  <span className="text-gray-300">Records browser actions automatically</span>
                </div>
                <div className="flex items-center">
                  <span className="text-green-400 mr-3">✓</span>
                  <span className="text-gray-300">Executes automation tools in real-time</span>
                </div>
                <div className="flex items-center">
                  <span className="text-green-400 mr-3">✓</span>
                  <span className="text-gray-300">Secure connection to your workspace</span>
                </div>
                <div className="flex items-center">
                  <span className="text-green-400 mr-3">✓</span>
                  <span className="text-gray-300">Works with Chrome, Edge, and Chromium browsers</span>
                </div>
              </div>

              {!downloadStarted ? (
                <button
                  onClick={handleDownload}
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300"
                >
                  📥 Download Extension
                </button>
              ) : (
                <div className="text-center">
                  <div className="mb-4">
                    <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                      <span className="text-2xl">📥</span>
                    </div>
                    <p className="text-green-400 font-medium">Download Started!</p>
                    <p className="text-gray-300 text-sm">Check your downloads folder</p>
                  </div>
                </div>
              )}
            </div>

            {/* Connection Status */}
            {downloadStarted && (
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <h4 className="text-lg font-semibold text-white mb-4">🔗 Connection Status</h4>
                
                {connectionStatus === 'checking' && (
                  <div className="flex items-center">
                    <div className="animate-spin w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full mr-3"></div>
                    <span className="text-cyan-300">Waiting for extension connection...</span>
                  </div>
                )}
                
                {connectionStatus === 'disconnected' && downloadStarted && (
                  <div className="flex items-center">
                    <span className="text-yellow-400 mr-3">⏳</span>
                    <span className="text-yellow-300">Extension not connected yet</span>
                  </div>
                )}
                
                {connectionStatus === 'connected' && (
                  <div className="text-center">
                    <div className="mb-4">
                      <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                        <span className="text-2xl">✅</span>
                      </div>
                      <p className="text-green-400 font-medium">Successfully Connected!</p>
                      <p className="text-gray-300 text-sm">Redirecting to your workspace...</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Side: Installation Steps */}
          <div className="space-y-6">
            <h3 className="text-2xl font-bold text-white mb-6">
              📋 Installation Steps
            </h3>

            {installationSteps.map((step) => (
              <div
                key={step.step}
                className={`bg-white/5 backdrop-blur rounded-xl p-6 border transition-all duration-300 ${
                  step.status === 'current' ? 'border-cyan-400/50 bg-cyan-400/10' : 'border-white/10'
                }`}
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-4 ${
                      step.status === 'completed' ? 'bg-green-500/20' : 
                      step.status === 'current' ? 'bg-cyan-500/20' : 'bg-gray-500/20'
                    }`}>
                      <span className="text-lg">{getStepIcon(step.status)}</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h4 className={`font-semibold mb-2 ${getStepColor(step.status)}`}>
                      Step {step.step}: {step.title}
                    </h4>
                    <p className="text-gray-300 text-sm">
                      {step.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {/* Detailed Instructions */}
            {downloadStarted && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-6">
                <h4 className="text-blue-300 font-semibold mb-3">📝 Detailed Instructions</h4>
                <div className="space-y-2 text-sm text-gray-300">
                  <p><strong>For Chrome/Edge:</strong></p>
                  <p>1. Open chrome://extensions/ or edge://extensions/</p>
                  <p>2. Turn on "Developer mode" (top right toggle)</p>
                  <p>3. Click "Load unpacked" button</p>
                  <p>4. Select the extracted extension folder</p>
                  <p>5. Click the extension icon in your toolbar</p>
                  <p>6. Click "🔗 Connect to MyMCP.me"</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-12 text-center">
          <p className="text-gray-400 text-sm mb-4">
            Having trouble? We're here to help!
          </p>
          <div className="flex justify-center space-x-6 text-sm">
            <a href="#" className="text-cyan-400 hover:text-cyan-300 transition-colors">
              📖 Installation Guide
            </a>
            <a href="#" className="text-cyan-400 hover:text-cyan-300 transition-colors">
              🎥 Video Tutorial
            </a>
            <a href="#" className="text-cyan-400 hover:text-cyan-300 transition-colors">
              💬 Get Support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}