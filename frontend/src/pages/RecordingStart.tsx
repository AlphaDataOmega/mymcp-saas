import React, { useState, useEffect } from 'react';
import { ArrowRight, MousePointer, Keyboard, Eye, Info, Play } from 'lucide-react';
import { RecordingService } from '../services/RecordingService';

export function RecordingStart() {
  const [url, setUrl] = useState('');
  const [isNavigating, setIsNavigating] = useState(false);
  const [recordingService] = useState(() => new RecordingService('default'));

  useEffect(() => {
    // Update title to show recording is ready to start
    document.title = '🔴 Ready to Record - MyMCP.me';
    console.log('📋 Recording start page loaded - ready to begin recording');
  }, []);

  const handleNavigate = async () => {
    if (!url.trim()) return;

    setIsNavigating(true);
    
    // Ensure URL has protocol
    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }

    try {
      console.log('🎬 Starting complete recording flow...');
      
      // STEP 1: Force stop any existing recordings, then create new session
      console.log('🛑 Ensuring no previous recordings are active...');
      await recordingService.forceStopRecording();
      
      const sessionName = `Recording_${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}`;
      console.log('📝 Creating backend session:', sessionName);
      
      const session = await recordingService.startRecording(sessionName, '');
      console.log('✅ Backend session created:', session.id);
      
      // STEP 2: Start extension recording with the session ID
      console.log('📡 Starting extension recording for session:', session.id);
      
      try {
        // Use window postMessage instead of chrome.runtime.sendMessage
        // This is more reliable for webpage-to-extension communication
        console.log('📡 Sending message to extension via window.postMessage');
        
        const message = {
          type: 'MYMCP_START_RECORDING',
          sessionId: session.id,
          options: {
            trackMouse: true,
            addRandomMovement: false
          }
        };

        // Send message and wait for response
        const response = await new Promise((resolve) => {
          const handleResponse = (event: MessageEvent) => {
            if (event.data?.type === 'MYMCP_START_RECORDING_RESPONSE') {
              window.removeEventListener('message', handleResponse);
              resolve(event.data);
            }
          };
          
          window.addEventListener('message', handleResponse);
          window.postMessage(message, '*');
          
          // Timeout after 5 seconds
          setTimeout(() => {
            window.removeEventListener('message', handleResponse);
            resolve({ success: false, error: 'Extension communication timeout' });
          }, 5000);
        });
        
        if (response?.success) {
          console.log('✅ Extension recording started successfully');
          
          console.log('✅ Extension confirmed recording started successfully');
          console.log('📋 Recording state should now persist across tab navigation');
          
        } else {
          throw new Error(response?.error || 'Extension failed to start recording');
        }
        
      } catch (extensionError) {
        console.error('❌ Failed to start extension recording:', extensionError);
        throw extensionError; // Don't continue if extension recording failed
      }

      // STEP 3: Small delay to ensure everything is set, then navigate
      console.log('⏳ Brief delay to ensure recording state is fully established...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('🌐 Navigating to target URL:', finalUrl);
      window.location.href = finalUrl;
      
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      alert('Failed to start recording. Please try again.');
      setIsNavigating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNavigate();
    }
  };

  const quickStartUrls = [
    { name: 'Google', url: 'https://google.com' },
    { name: 'GitHub', url: 'https://github.com' },
    { name: 'Amazon', url: 'https://amazon.com' },
    { name: 'YouTube', url: 'https://youtube.com' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-purple-950 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
            <h1 className="text-3xl font-bold">Recording Mode Active</h1>
            <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
          </div>
          <p className="text-lg text-blue-200 mb-2">
            Choose a website to start recording your automation workflow
          </p>
          <p className="text-sm text-yellow-300">
            🔄 Recording session is active - actions will be captured once you navigate to your target site
          </p>
        </div>

        {/* URL Input Section */}
        <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/20 rounded-xl p-8 mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Play className="w-5 h-5 text-green-400" />
            Start Recording On Any Website
          </h2>
          
          <div className="flex gap-3 mb-6">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter website URL (e.g., google.com, github.com, amazon.com)"
              className="flex-1 px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isNavigating}
            />
            <button
              onClick={handleNavigate}
              disabled={!url.trim() || isNavigating}
              className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-gray-500 disabled:to-gray-600 text-white rounded-lg font-medium transition-all duration-200 flex items-center gap-2 disabled:cursor-not-allowed"
            >
              {isNavigating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Navigating...
                </>
              ) : (
                <>
                  Go & Start Recording
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {/* Quick Start Options */}
          <div className="border-t border-slate-600 pt-4">
            <p className="text-sm text-slate-300 mb-3">Quick Start Options:</p>
            <div className="flex flex-wrap gap-2">
              {quickStartUrls.map((site) => (
                <button
                  key={site.name}
                  onClick={() => setUrl(site.url)}
                  className="px-3 py-1 bg-slate-700/50 hover:bg-slate-600/50 text-slate-200 rounded-md text-sm transition-colors"
                >
                  {site.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Recording Tips */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          
          {/* Shift+Click Tip */}
          <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-500/20 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-3">
              <MousePointer className="w-6 h-6 text-purple-400" />
              <h3 className="font-semibold">Smart Click Detection</h3>
            </div>
            <p className="text-sm text-slate-300 mb-3">
              Use <kbd className="bg-slate-700 px-2 py-1 rounded text-xs">Shift + Left Click</kbd> for precise element selection
            </p>
            <p className="text-xs text-slate-400">
              Perfect for buttons, links, and interactive elements
            </p>
          </div>

          {/* Text Input Tip */}
          <div className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 border border-blue-500/20 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-3">
              <Keyboard className="w-6 h-6 text-blue-400" />
              <h3 className="font-semibold">Text Input Capture</h3>
            </div>
            <p className="text-sm text-slate-300 mb-3">
              Type in any input field - we'll capture the text automatically
            </p>
            <p className="text-xs text-slate-400">
              Search boxes, forms, and text areas are all recorded
            </p>
          </div>

          {/* Visual Feedback Tip */}
          <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-500/20 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-3">
              <Eye className="w-6 h-6 text-green-400" />
              <h3 className="font-semibold">Visual Feedback</h3>
            </div>
            <p className="text-sm text-slate-300 mb-3">
              Watch for the red recording indicator in your extension popup
            </p>
            <p className="text-xs text-slate-400">
              Click the extension icon anytime to stop recording
            </p>
          </div>
        </div>

        {/* Important Notes */}
        <div className="bg-gradient-to-r from-yellow-900/20 to-orange-900/20 border border-yellow-500/30 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-yellow-400 mb-2">Recording Tips</h3>
              <ul className="text-sm text-slate-300 space-y-1">
                <li>• Navigate naturally - page changes are automatically captured</li>
                <li>• Avoid private information - recordings may contain sensitive data</li>
                <li>• Use descriptive actions - clear workflows create better tools</li>
                <li>• Stop recording via the extension popup when finished</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-slate-400 text-sm">
          <p>
            Need help? Check the{' '}
            <a href="/documentation" className="text-blue-400 hover:underline">
              documentation
            </a>{' '}
            or return to the{' '}
            <a href="/recorder" className="text-blue-400 hover:underline">
              Recording Studio
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}