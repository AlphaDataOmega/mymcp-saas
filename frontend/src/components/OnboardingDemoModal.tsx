import React, { useState } from 'react';
import { X, Play, ArrowRight, Sparkles, TestTube } from 'lucide-react';

interface OnboardingDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoToRecorder: () => void;
  backendUrl: string;
}

export function OnboardingDemoModal({ isOpen, onClose, onGoToRecorder, backendUrl }: OnboardingDemoModalProps) {
  const [isRunningDemo, setIsRunningDemo] = useState(false);
  const [demoResult, setDemoResult] = useState<string | null>(null);
  const [demoError, setDemoError] = useState<string | null>(null);

  const handleClose = () => {
    setIsRunningDemo(false);
    setDemoResult(null);
    setDemoError(null);
    onClose();
  };

  const runBigFootDemo = async () => {
    setIsRunningDemo(true);
    setDemoResult(null);
    setDemoError(null);

    try {
      // Check if extension is connected
      const statusResponse = await fetch(`${backendUrl}/extension/status`);
      const statusData = await statusResponse.json();
      
      if (!statusData.connected) {
        throw new Error('Browser extension not connected. Please install and connect the extension first.');
      }

      // Run the BigFoot TikTok search demo
      const response = await fetch(`${backendUrl}/demo/bigfoot-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          demo: 'bigfoot_tiktok_search',
          steps: [
            { action: 'navigate', url: 'https://www.tiktok.com' },
            { action: 'wait', time: 2 },
            { action: 'click', selector: '[data-e2e="search-box"]' },
            { action: 'type', text: 'BigFoot sightings' },
            { action: 'press_key', key: 'Enter' },
            { action: 'wait', time: 3 },
            { action: 'screenshot' }
          ]
        })
      });

      if (!response.ok) {
        throw new Error('Demo execution failed');
      }

      const result = await response.json();
      setDemoResult('✅ Demo completed! Your browser was successfully controlled to search for BigFoot on TikTok.');
      
    } catch (error) {
      console.error('Demo error:', error);
      setDemoError(error instanceof Error ? error.message : 'Demo failed to run');
    } finally {
      setIsRunningDemo(false);
    }
  };

  const handleGoToRecorder = () => {
    handleClose();
    onGoToRecorder();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold">Welcome to MyMCP.me!</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Watch our demo and test browser automation
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid lg:grid-cols-2 gap-6">
            
            {/* Left Column: Demo Video */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-500" />
                How MyMCP.me Works
              </h3>
              
              {/* Video Placeholder - Replace with actual video */}
              <div className="aspect-video bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <Play className="w-12 h-12 text-blue-400 mx-auto mb-3" />
                  <p className="text-blue-300 font-medium">Demo Video</p>
                  <p className="text-sm text-muted-foreground">
                    Browser automation in action
                  </p>
                </div>
              </div>
              
              {/* Key Features */}
              <div className="space-y-3">
                <div className="flex items-start gap-3 text-sm">
                  <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <strong className="text-green-400">Record Actions:</strong> Click, type, and navigate - we capture everything
                  </div>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <strong className="text-blue-400">Generate Tools:</strong> Turn recordings into reusable automation tools
                  </div>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <strong className="text-purple-400">AI-Powered:</strong> Smart selectors that adapt to page changes
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Interactive Demo */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <TestTube className="w-5 h-5 text-green-500" />
                Try It Now
              </h3>
              
              {/* Demo Section */}
              <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-lg p-6">
                <div className="text-center mb-4">
                  <div className="text-4xl mb-3">🦍</div>
                  <h4 className="text-lg font-semibold text-green-400 mb-2">BigFoot Search Demo</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Watch us automatically search for BigFoot on TikTok using browser automation
                  </p>
                </div>

                {/* Demo Button */}
                <button
                  onClick={runBigFootDemo}
                  disabled={isRunningDemo}
                  className={`w-full py-3 px-6 rounded-lg font-medium transition-all duration-200 ${
                    isRunningDemo
                      ? 'bg-yellow-500/20 text-yellow-300 cursor-not-allowed'
                      : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg hover:shadow-xl'
                  }`}
                >
                  {isRunningDemo ? (
                    <>
                      <div className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                      Running Demo...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 inline mr-2" />
                      Start BigFoot Demo
                    </>
                  )}
                </button>

                {/* Demo Results */}
                {demoResult && (
                  <div className="mt-4 p-3 bg-green-500/20 border border-green-500/30 rounded-lg">
                    <p className="text-green-300 text-sm">{demoResult}</p>
                  </div>
                )}

                {demoError && (
                  <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                    <p className="text-red-300 text-sm">❌ {demoError}</p>
                  </div>
                )}

                {/* Demo Steps Preview */}
                <div className="mt-6 space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Demo Steps:</p>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>1. Navigate to TikTok</div>
                    <div>2. Click search box</div>
                    <div>3. Type "BigFoot sightings"</div>
                    <div>4. Press Enter to search</div>
                    <div>5. Take screenshot</div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border p-4 bg-muted/20">
          <div className="flex items-center justify-center">
            <button
              onClick={handleGoToRecorder}
              className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-6 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2"
            >
              Go to Recording Studio
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}