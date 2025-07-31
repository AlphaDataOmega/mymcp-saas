import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../utils/cn';

interface NavItem {
  name: string;
  href: string;
  icon: string;
  description: string;
}

const navigation: NavItem[] = [
  {
    name: 'Maestro',
    href: '/dashboard',
    icon: '🤖',
    description: 'Tool Orchestrator'
  },
  {
    name: 'Recorder',
    href: '/recorder',
    icon: '🎬',
    description: 'Record browser actions'
  },
  {
    name: 'Tools',
    href: '/tools',
    icon: '🔧',
    description: 'Manage your tools'
  },
  {
    name: 'Marketplace',
    href: '/marketplace',
    icon: '🏪',
    description: 'Discover & install tools'
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: '⚙️',
    description: 'Configuration'
  }
];

export function NavigationSidebar() {
  const location = useLocation();

  return (
    <div className="fixed inset-y-0 left-0 w-64 bg-card border-r border-border">
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="flex items-center px-6 py-4 border-b border-border">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-indigo-600 to-cyan-600 rounded-lg flex items-center justify-center text-white font-bold">
              M
            </div>
            <span className="text-lg font-semibold">MyMCP.me</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center px-4 py-3 rounded-lg transition-colors group",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <span className="text-lg mr-3">{item.icon}</span>
                <div className="flex-1">
                  <div className="font-medium">{item.name}</div>
                  <div className={cn(
                    "text-xs",
                    isActive 
                      ? "text-primary-foreground/80" 
                      : "text-muted-foreground group-hover:text-accent-foreground/80"
                  )}>
                    {item.description}
                  </div>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-border">
          <div className="text-xs text-muted-foreground text-center">
            Powered by MCP Protocol
          </div>
        </div>
      </div>
    </div>
  );
}