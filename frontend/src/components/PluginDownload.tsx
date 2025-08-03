// Plugin Download Component - User downloads and installs browser extension

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '../hooks/useTenant';
import { ExtensionDownloadModal } from './ExtensionDownloadModal';

export function PluginDownload() {
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const [showExtensionModal, setShowExtensionModal] = useState(false);

  const handleDownload = () => {
    setShowExtensionModal(true);
  };

  const handleModalClose = () => {
    setShowExtensionModal(false);
  };

  const handleDownloadStarted = () => {
    setShowExtensionModal(false);
    // Navigate to recorder page with getting-started parameter after download
    navigate('/recorder?getting-started=true');
  };

  const installationSteps = [
    {
      step: 1,
      title: 'Download Extension',
      description: 'Click the download button to get the MyMCP browser extension',
      status: 'current'
    },
    {
      step: 2,
      title: 'Extract Files',
      description: 'Unzip the downloaded file to any folder on your computer',
      status: 'pending'
    },
    {
      step: 3,
      title: 'Install in Browser',
      description: 'Open Chrome/Edge extensions, enable Developer mode, click "Load unpacked"',
      status: 'pending'
    },
    {
      step: 4,
      title: 'Connect Extension',
      description: 'Click the extension icon and connect to your workspace',
      status: 'pending'
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
      case 'completed': return 'text-green-600';
      case 'current': return 'text-cyan-600';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="w-20 h-20 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl">🔌</span>
        </div>
        <h1 className="text-4xl font-bold text-foreground mb-4">
          Install Browser Extension
        </h1>
        <p className="text-xl text-muted-foreground mb-2">
          Connect your browser to{' '}
          <span className="text-cyan-400 font-mono">
            {tenant?.subdomain}.mymcp.me
          </span>
        </p>
        <p className="text-muted-foreground">
          The extension enables browser automation and recording capabilities
        </p>
      </div>

        {/* Main Content - Single Column */}
        <div className="max-w-lg mx-auto space-y-8">
          {/* Download Section */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 text-center">
            <h3 className="text-2xl font-bold text-foreground mb-6">
              📦 MyMCP Browser Extension
            </h3>

            <button
              onClick={handleDownload}
              className="w-full max-w-md bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300"
            >
              📥 Download Extension
            </button>
          </div>

          {/* Installation Steps */}
          <div className="space-y-6">
            <h3 className="text-2xl font-bold text-foreground mb-6 text-center">
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
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-6">
              <h4 className="text-blue-300 font-semibold mb-3">📝 Installation Instructions</h4>
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

      {/* Extension Download Modal */}
      <ExtensionDownloadModal
        isOpen={showExtensionModal}
        onClose={handleModalClose}
        backendUrl={tenant?.instance.backendUrl || 'http://localhost:8100'}
        onShowDemo={handleDownloadStarted}
      />
    </div>
  );
}