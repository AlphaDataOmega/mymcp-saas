import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useTheme } from '../providers/ThemeProvider';
import { Tenant } from '../types/tenant';

interface HeaderProps {
  tenant: Tenant | null;
  connectionStatus?: 'connected' | 'disconnected' | 'error' | 'connecting';
  onShowExtensionModal?: () => void;
}

export function Header({ tenant, connectionStatus = 'connected', onShowExtensionModal }: HeaderProps) {
  const { theme, setTheme, actualTheme } = useTheme();
  const navigate = useNavigate();

  const toggleTheme = () => {
    setTheme(actualTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className="h-16 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-between h-full px-6">
        {/* Page Info */}
        <div className="flex items-center space-x-4">
          {tenant && (
            <div>
              <h1 className="text-lg font-semibold">{tenant.subdomain}.mymcp.me</h1>
              <p className="text-sm text-muted-foreground">
                Automation Workspace
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-3">
          {/* Connection Status - Only show when connected or connecting */}
          {connectionStatus !== 'error' && connectionStatus !== 'disconnected' && (
            <div className={`flex items-center space-x-2 text-sm px-4 py-2 rounded-full border transition-all duration-300 ${
              connectionStatus === 'connected' 
                ? 'bg-green-500/10 border-green-500/30 text-green-400 shadow-lg shadow-green-500/20' 
                : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400 shadow-lg shadow-yellow-500/20'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-400 animate-pulse' : 'bg-yellow-400 animate-pulse'
              }`}></div>
              <span className="font-medium">
                {connectionStatus === 'connected' ? 'Connected' : 'Connecting...'}
              </span>
            </div>
          )}

          {/* Download Extension Button */}
          {(connectionStatus === 'error' || connectionStatus === 'disconnected') ? (
            // Primary download button when disconnected
            <Button
              onClick={onShowExtensionModal}
              className="bg-transparent hover:bg-white/10 text-white text-sm border border-white/30 hover:border-white/50"
              size="sm"
              variant="outline"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download Extension
            </Button>
          ) : connectionStatus === 'connected' ? (
            // Secondary download button when connected
            <Button
              onClick={onShowExtensionModal}
              variant="ghost"
              size="sm"
              className="w-9 h-9 p-0"
              title="Download Extension"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </Button>
          ) : null}

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="w-9 h-9 p-0"
          >
            {actualTheme === 'dark' ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            )}
          </Button>

          {/* Settings */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/settings')}
            className="w-9 h-9 p-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Button>

          {/* Help */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/documentation')}
            className="w-9 h-9 p-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </Button>
        </div>
      </div>
    </header>
  );
}