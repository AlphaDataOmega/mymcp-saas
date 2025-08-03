import React, { useState, useEffect } from 'react';
import { X, Download, ExternalLink } from 'lucide-react';

interface ExtensionVersion {
  filename: string;
  version: string;
  description: string;
  size?: string;
  uploadDate?: string;
}

interface ExtensionDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  backendUrl: string;
  onShowDemo?: () => void;
}

export function ExtensionDownloadModal({ isOpen, onClose, backendUrl, onShowDemo }: ExtensionDownloadModalProps) {
  const [extensions, setExtensions] = useState<ExtensionVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchExtensions();
      setShowInstructions(false); // Reset instructions when modal opens
    }
  }, [isOpen]);

  const handleClose = () => {
    setShowInstructions(false);
    onClose();
  };

  const fetchExtensions = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${backendUrl}/extension/versions`);
      if (!response.ok) {
        throw new Error('Failed to fetch extension versions');
      }
      
      const data = await response.json();
      setExtensions(data.versions || []);
    } catch (err) {
      console.error('Error fetching extensions:', err);
      setError('Failed to load extension versions');
      // Fallback to default versions
      setExtensions([
        {
          filename: 'MyMCP_Extension_v1.0.tar.gz',
          version: 'v1.0',
          description: 'Latest stable version with bidirectional recording sync, BrowserMCP playback capabilities, and improved connection stability.'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (filename: string) => {
    const downloadUrl = `${backendUrl}/extension/download/${filename}`;
    window.open(downloadUrl, '_blank');
    // Show installation instructions after download
    setTimeout(() => {
      setShowInstructions(true);
      // Auto-scroll to top when showing instructions
      setTimeout(() => {
        const modalContent = document.querySelector('.overflow-y-auto');
        if (modalContent) {
          modalContent.scrollTop = 0;
        }
      }, 100);
    }, 1000);
  };

  const handleDownloadLatest = () => {
    const latestUrl = `${backendUrl}/extension/download`;
    window.open(latestUrl, '_blank');
    // Show installation instructions after download
    setTimeout(() => {
      setShowInstructions(true);
      // Auto-scroll to top when showing instructions
      setTimeout(() => {
        const modalContent = document.querySelector('.overflow-y-auto');
        if (modalContent) {
          modalContent.scrollTop = 0;
        }
      }, 100);
    }, 1000);
  };

  // Find the latest version (highest version number or marked as "Latest")
  const getLatestExtension = () => {
    if (extensions.length === 0) return null;
    
    // Look for extension marked as "Latest" first
    const latestMarked = extensions.find(ext => 
      ext.version.toLowerCase().includes('latest') || 
      ext.description.toLowerCase().includes('latest')
    );
    
    if (latestMarked) return latestMarked;
    
    // Otherwise, return the first extension (assuming sorted)
    return extensions[0];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold">
              {showInstructions ? 'Installation Instructions' : 'Download Browser Extension'}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {showInstructions 
                ? 'Follow these steps to install the extension' 
                : 'Choose from available extension versions'
              }
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
          {showInstructions ? (
            /* Installation Instructions */
            <div className="space-y-6">
              {/* Success Message */}
              <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-lg p-6 text-center">
                <div className="text-4xl mb-3">🎉</div>
                <h3 className="text-lg font-semibold text-green-400 mb-2">Download Started!</h3>
                <p className="text-sm text-muted-foreground">
                  Your extension file should be downloading now. Follow the steps below to install it.
                </p>
              </div>

              {/* Installation Steps */}
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 border border-border rounded-lg">
                  <div className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                    1
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Open Chrome Extensions</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Navigate to <code className="bg-muted px-2 py-1 rounded text-xs">chrome://extensions/</code> in your browser
                    </p>
                    <div className="text-xs text-blue-400">
                      💡 Tip: You can also click the 3-dot menu → Extensions → Manage Extensions
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 border border-border rounded-lg">
                  <div className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                    2
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Enable Developer Mode</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Toggle the "Developer mode" switch in the top-right corner
                    </p>
                    <div className="text-xs text-blue-400">
                      💡 This allows you to install extensions from ZIP files
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 border border-border rounded-lg">
                  <div className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                    3
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Extract and Load Extension</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      1. Extract the downloaded ZIP file to a folder<br />
                      2. Click "Load unpacked" button<br />
                      3. Select the extracted extension folder
                    </p>
                    <div className="text-xs text-blue-400">
                      💡 The extension will appear in your extensions list once loaded
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 border border-border rounded-lg">
                  <div className="bg-green-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                    4
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Test Your Extension</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      1. Look for the MyMCP.me extension icon in your browser toolbar<br />
                      2. Click it to open the popup and connect to your workspace<br />
                      3. Start recording your first automation!
                    </p>
                    <div className="text-xs text-green-400">
                      🚀 You're ready to start automating!
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-4 border-t border-border">
                <button
                  onClick={() => setShowInstructions(false)}
                  className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                >
                  ← Back to Downloads
                </button>
                <button
                  onClick={handleClose}
                  className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-6 py-2 rounded-lg font-medium transition-all duration-200"
                >
                  Got it, thanks!
                </button>
              </div>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-3 text-muted-foreground">Loading extensions...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <div className="text-red-500 mb-2">⚠️ {error}</div>
              <button
                onClick={fetchExtensions}
                className="text-primary hover:underline text-sm"
              >
                Try again
              </button>
            </div>
          ) : extensions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No extension versions available
            </div>
          ) : (
            <div className="space-y-6">
              {/* Download Latest Section */}
              <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-blue-400">Latest Version</h3>
                      <span className="bg-blue-500/20 text-blue-300 text-xs px-2 py-1 rounded-full font-medium">
                        Recommended
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Get the newest version with latest features and bug fixes. Perfect for new users.
                    </p>
                    {getLatestExtension() && (
                      <div className="text-xs text-muted-foreground">
                        Latest: {getLatestExtension()?.version} • {getLatestExtension()?.size || 'Ready to download'}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleDownloadLatest}
                    className="ml-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-6 py-3 rounded-lg flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl font-medium"
                  >
                    <Download className="w-5 h-5" />
                    Download Latest
                  </button>
                </div>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-border"></div>
                <span className="text-xs text-muted-foreground font-medium">OR CHOOSE SPECIFIC VERSION</span>
                <div className="flex-1 h-px bg-border"></div>
              </div>

              {/* All Versions List */}
              <div className="space-y-4">
                {extensions.map((ext, index) => (
                <div
                  key={index}
                  className="border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <code className="bg-muted px-3 py-1 rounded text-sm font-mono border">
                          {ext.filename}
                        </code>
                        <span className="text-xs text-muted-foreground bg-primary/10 px-2 py-1 rounded">
                          {ext.version}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                        {ext.description}
                      </p>
                      {(ext.size || ext.uploadDate) && (
                        <div className="text-xs text-muted-foreground space-x-4">
                          {ext.size && <span>Size: {ext.size}</span>}
                          {ext.uploadDate && <span>Updated: {ext.uploadDate}</span>}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDownload(ext.filename)}
                      className="ml-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-200 shadow-md hover:shadow-lg font-medium"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!showInstructions && (
          <div className="border-t border-border p-6 bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Need help installing the extension?
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    handleClose();
                    onShowDemo?.();
                  }}
                  className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 text-sm"
                >
                  Try Demo
                </button>
                <a
                  href="/documentation"
                  className="text-primary hover:underline flex items-center gap-1 text-sm"
                >
                  View Documentation
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        )}
        {showInstructions && (
          <div className="border-t border-border p-6 bg-muted/20">
            <div className="flex items-center justify-between text-sm">
              <div className="text-muted-foreground">
                Need help installing the extension?
              </div>
              <a
                href="/documentation"
                className="text-primary hover:underline flex items-center gap-1"
              >
                View Documentation
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}