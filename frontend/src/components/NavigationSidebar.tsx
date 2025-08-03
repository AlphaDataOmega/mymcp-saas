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
            <svg width="32" height="32" viewBox="0 0 320 320" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="g-sidebar" x1="32" y1="288" x2="288" y2="32" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#291B4B"/><stop offset=".55" stopColor="#511D7D"/><stop offset="1" stopColor="#401D67"/>
                </linearGradient>
                <filter id="capGlow-sidebar" x="-60%" y="-60%" width="220%" height="220%">
                  <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#511D7D" floodOpacity="0.55"/>
                </filter>
                <filter id="dotGlow-sidebar" x="-200%" y="-200%" width="500%" height="500%">
                  <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="currentColor" floodOpacity=".65"/>
                </filter>
              </defs>
              <rect x="20" y="20" width="280" height="280" rx="48" fill="url(#g-sidebar)" filter="url(#capGlow-sidebar)"/>
              <path d="M88 224 V104 L160 176 L232 104 V224"
                    stroke="white" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" opacity="0.95"/>
              <path d="M88 224 L88 104 L160 176 L232 104 L232 224"
                    stroke="#3F85E5" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="88"  cy="224" r="14" fill="white"/>
              <circle cx="88"  cy="224" r="8"  fill="#3F85E5" filter="url(#dotGlow-sidebar)"/>
              <circle cx="88"  cy="104" r="14" fill="white"/>
              <circle cx="88"  cy="104" r="8"  fill="#F72585" filter="url(#dotGlow-sidebar)"/>
              <circle cx="160" cy="176" r="14" fill="white"/>
              <circle cx="160" cy="176" r="8"  fill="#FFD60A" filter="url(#dotGlow-sidebar)"/>
              <circle cx="232" cy="104" r="14" fill="white"/>
              <circle cx="232" cy="104" r="8"  fill="#23C55E" filter="url(#dotGlow-sidebar)"/>
              <circle cx="232" cy="224" r="14" fill="white"/>
              <circle cx="232" cy="224" r="8"  fill="#FF8A00" filter="url(#dotGlow-sidebar)"/>
            </svg>
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">MyMCP</span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-3">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center px-4 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden",
                  isActive
                    ? "bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-sm border border-white/20 text-white shadow-lg shadow-cyan-500/25"
                    : "text-foreground hover:border hover:border-white/20 hover:text-accent-foreground"
                )}
                style={isActive ? {
                  boxShadow: '0 0 20px rgba(6, 182, 212, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                } : {}}
              >
                <span className="text-lg mr-3">{item.icon}</span>
                <div className="flex-1">
                  <div className="font-medium">{item.name}</div>
                  <div className={cn(
                    "text-xs",
                    isActive 
                      ? "text-cyan-400" 
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
            Powered by AlphaDataOmega
          </div>
        </div>
      </div>
    </div>
  );
}