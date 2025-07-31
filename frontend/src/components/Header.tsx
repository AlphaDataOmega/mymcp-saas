import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useTheme } from '../providers/ThemeProvider';
import { Tenant } from '../types/tenant';

interface HeaderProps {
  tenant: Tenant | null;
  connectionStatus?: 'connected' | 'disconnected' | 'error';
}

export function Header({ tenant, connectionStatus = 'connected' }: HeaderProps) {
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
            <>
              <div>
                <h1 className="text-lg font-semibold">{tenant.subdomain}.mymcp.me</h1>
                <p className="text-sm text-muted-foreground">
                  Automation Workspace
                </p>
              </div>
              <Badge variant={tenant.status === 'active' ? 'default' : 'secondary'}>
                {tenant.status}
              </Badge>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-3">
          {/* Connection Status or Download Extension Button */}
          {connectionStatus === 'disconnected' ? (
            <Button
              onClick={() => navigate('/settings')}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-semibold text-sm"
              size="sm"
            >
              📥 Download Extension
            </Button>
          ) : (
            <div className="flex items-center space-x-2 text-sm">
              <div className={`w-2 h-2 rounded-full animate-pulse ${
                connectionStatus === 'connected' ? 'bg-green-500' : 
                connectionStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500'
              }`}></div>
              <span className="text-muted-foreground">
                {connectionStatus === 'connected' ? 'Connected' : 
                 connectionStatus === 'error' ? 'Error' : 'Checking...'}
              </span>
            </div>
          )}

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="w-9 h-9 p-0"
          >
            {actualTheme === 'dark' ? '🌙' : '☀️'}
          </Button>

          {/* Settings */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.location.href = '/settings'}
            className="w-9 h-9 p-0"
          >
            ⚙️
          </Button>

          {/* Help */}
          <Button
            variant="ghost"
            size="sm"
            className="w-9 h-9 p-0"
          >
            ❓
          </Button>
        </div>
      </div>
    </header>
  );
}