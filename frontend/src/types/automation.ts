// Core automation types extracted from Streamlit functionality

export interface RecordingSession {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  status: 'recording' | 'stopped' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
  duration?: number;
  actions: RecordedAction[];
  actionsCount?: number; // Count of actions (returned by sessions list endpoint)
  metadata?: {
    browserInfo: BrowserInfo;
    userAgent: string;
    screenResolution: string;
  };
}

export interface RecordedAction {
  id: string;
  type: 'navigate' | 'click' | 'type' | 'select' | 'wait' | 'screenshot' | 'scroll';
  timestamp: number;
  description: string;
  
  // Action-specific data
  url?: string;
  selector?: string;
  text?: string;
  coordinates?: { x: number; y: number };
  screenshot?: string; // Base64 or URL
  metadata?: Record<string, any>;
}

export interface BrowserInfo {
  name: string;
  version: string;
  platform: string;
  userAgent: string;
}

export interface GeneratedTool {
  id: string;
  sessionId: string;
  tenantId: string;
  name: string;
  description: string;
  code: string;
  language: 'python' | 'javascript' | 'typescript';
  parameters: ToolParameter[];
  createdAt: string;
  updatedAt: string;
  
  // Usage stats
  executionCount: number;
  lastUsed?: string;
  
  // Tool metadata
  category: string;
  tags: string[];
  isPublic: boolean;
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  defaultValue?: any;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: any[];
  };
}

export interface Agent {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  systemPrompt: string;
  
  // Agent configuration
  model: string;
  provider: 'openai' | 'anthropic' | 'openrouter' | 'ollama';
  tools: string[]; // Tool IDs
  
  // Agent state
  status: 'active' | 'inactive' | 'error';
  createdAt: string;
  updatedAt: string;
  
  // Usage stats
  conversationCount: number;
  totalMessages: number;
  lastUsed?: string;
}

export interface Conversation {
  id: string;
  agentId: string;
  tenantId: string;
  title: string;
  messages: ConversationMessage[];
  status: 'active' | 'completed' | 'error';
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  
  // Tool execution data
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  
  // Message metadata
  metadata?: {
    model?: string;
    tokens?: number;
    duration?: number;
  };
}

export interface ToolCall {
  id: string;
  toolId: string;
  toolName: string;
  parameters: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
}

export interface ToolResult {
  toolCallId: string;
  status: 'success' | 'error';
  data?: any;
  error?: string;
  screenshots?: string[];
  logs?: string[];
}

// Browser automation types
export interface BrowserConnection {
  id: string;
  tenantId: string;
  status: 'connected' | 'disconnected' | 'error';
  browserInfo: BrowserInfo;
  extensionVersion: string;
  lastHeartbeat: number;
  capabilities: BrowserCapability[];
}

export interface BrowserCapability {
  name: string;
  supported: boolean;
  version?: string;
}

// Marketplace types (extracted from marketplace.py functionality)
export interface MarketplaceServer {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  author: string;
  version: string;
  
  // Installation info
  repositoryUrl: string;
  installCommand?: string;
  dockerImage?: string;
  
  // Server metadata
  tools: MarketplaceTool[];
  tags: string[];
  featured: boolean;
  verified: boolean;
  
  // Stats
  downloadCount: number;
  rating: number;
  reviewCount: number;
  
  // Requirements
  requirements: ServerRequirement[];
  
  createdAt: string;
  updatedAt: string;
}

export interface MarketplaceTool {
  name: string;
  description: string;
  parameters?: ToolParameter[];
  examples?: string[];
}

export interface ServerRequirement {
  key: string;
  name: string;
  type: 'api_key' | 'token' | 'oauth' | 'url' | 'string';
  description: string;
  required: boolean;
  instructions?: string;
  setupUrl?: string;
}

export interface ServerInstallation {
  id: string;
  tenantId: string;
  serverId: string;
  status: 'installing' | 'installed' | 'running' | 'stopped' | 'error';
  config: Record<string, any>;
  installedAt: string;
  lastStarted?: string;
  
  // Runtime info
  processId?: string;
  port?: number;
  logs?: string[];
}