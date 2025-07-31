// Agent Service - Handles AI agent creation, execution, and management
// Extracted from chat.py, agent_chat.py, and archon_graph.py

import { TenantApiClient } from './TenantApiClient';
import { recordUsageAfterAction } from './BillingService';

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolResult?: any;
  messageId?: string;
}

export interface AgentExecution {
  id: string;
  sessionId: string;
  userId: string;
  agentId?: string;
  messages: AgentMessage[];
  status: 'active' | 'completed' | 'error';
  startTime: number;
  endTime?: number;
  toolsUsed: string[];
  metadata?: Record<string, any>;
}

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  tools: string[];
  modelConfig: {
    provider: 'openai' | 'anthropic' | 'openrouter';
    model: string;
    temperature?: number;
    maxTokens?: number;
  };
  createdAt: string;
  updatedAt: string;
  userId: string;
  isActive: boolean;
}

export interface StreamingResponse {
  type: 'text' | 'tool_execution' | 'error' | 'complete';
  content: string;
  metadata?: any;
}

export interface ToolExecutionRequest {
  toolName: string;
  arguments: Record<string, any>;
  sessionId: string;
}

export interface ToolExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  executionTime: number;
  toolName: string;
}

export class AgentService {
  private apiClient: TenantApiClient;
  private currentExecution?: AgentExecution;

  constructor(tenantId: string) {
    this.apiClient = new TenantApiClient(tenantId);
  }

  /**
   * Create a new AI agent using Archon workflow
   */
  async createAgent(
    name: string,
    description: string,
    requirements: string,
    modelConfig?: Partial<AgentDefinition['modelConfig']>
  ): Promise<AgentDefinition> {
    try {
      // Start Archon agent creation workflow
      const response = await this.apiClient.post('/agents/create', {
        name,
        description,
        requirements,
        modelConfig: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          temperature: 0.7,
          maxTokens: 4000,
          ...modelConfig
        }
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to create agent');
      }

      // Record usage for billing
      await recordUsageAfterAction(this.apiClient.tenantId, 'agentExecutions');

      return response.agent;
    } catch (error) {
      console.error('Failed to create agent:', error);
      throw error;
    }
  }

  /**
   * Start a streaming chat session with an agent
   */
  async startChat(
    userMessage: string,
    agentId?: string,
    sessionId?: string
  ): Promise<{
    sessionId: string;
    stream: AsyncGenerator<StreamingResponse>;
  }> {
    const actualSessionId = sessionId || this.generateSessionId();
    
    // Initialize or get existing execution
    if (!this.currentExecution || this.currentExecution.sessionId !== actualSessionId) {
      this.currentExecution = {
        id: this.generateExecutionId(),
        sessionId: actualSessionId,
        userId: this.apiClient.tenantId,
        agentId,
        messages: [],
        status: 'active',
        startTime: Date.now(),
        toolsUsed: []
      };
    }

    // Add user message
    const userMsg: AgentMessage = {
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
      messageId: this.generateMessageId()
    };
    
    this.currentExecution.messages.push(userMsg);

    // Create streaming generator
    const stream = this.createChatStream(userMessage, actualSessionId, agentId);

    return {
      sessionId: actualSessionId,
      stream
    };
  }

  /**
   * Create streaming response generator for agent chat
   */
  private async *createChatStream(
    userMessage: string,
    sessionId: string,
    agentId?: string
  ): AsyncGenerator<StreamingResponse> {
    try {
      const requestBody = {
        message: userMessage,
        sessionId,
        agentId,
        messageHistory: this.currentExecution?.messages || []
      };

      // Use different endpoints based on whether we have a custom agent
      const endpoint = agentId ? `/agents/${agentId}/chat/stream` : '/agents/archon/stream';
      
      const response = await fetch(`${this.apiClient.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.apiClient.getHeaders()
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body stream available');
      }

      let buffer = '';
      let fullResponse = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim() === '') continue;
            
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              
              if (data === '[DONE]') {
                yield {
                  type: 'complete',
                  content: fullResponse
                };
                break;
              }

              try {
                const parsed = JSON.parse(data);
                
                if (parsed.type === 'text') {
                  fullResponse += parsed.content;
                  yield {
                    type: 'text',
                    content: parsed.content
                  };
                } else if (parsed.type === 'tool_execution') {
                  yield {
                    type: 'tool_execution',
                    content: `Executing tool: ${parsed.toolName}`,
                    metadata: parsed
                  };
                  
                  // Track tool usage
                  if (this.currentExecution && !this.currentExecution.toolsUsed.includes(parsed.toolName)) {
                    this.currentExecution.toolsUsed.push(parsed.toolName);
                  }
                } else if (parsed.type === 'error') {
                  yield {
                    type: 'error',
                    content: parsed.content,
                    metadata: parsed
                  };
                }
              } catch (parseError) {
                // Handle plain text chunks (non-JSON)
                fullResponse += data;
                yield {
                  type: 'text',
                  content: data
                };
              }
            }
          }
        }

        // Add assistant message to execution history
        if (this.currentExecution) {
          const assistantMsg: AgentMessage = {
            role: 'assistant',
            content: fullResponse,
            timestamp: Date.now(),
            messageId: this.generateMessageId()
          };
          
          this.currentExecution.messages.push(assistantMsg);
          this.currentExecution.status = 'completed';
          this.currentExecution.endTime = Date.now();

          // Save execution to backend
          await this.saveExecution(this.currentExecution);
        }

        // Record usage for billing
        await recordUsageAfterAction(this.apiClient.tenantId, 'agentExecutions');

      } finally {
        reader.releaseLock();
      }

    } catch (error) {
      console.error('Chat stream error:', error);
      yield {
        type: 'error',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
      
      if (this.currentExecution) {
        this.currentExecution.status = 'error';
        this.currentExecution.endTime = Date.now();
      }
    }
  }

  /**
   * Execute a tool directly (for agent_chat.py functionality)
   */
  async executeTool(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    
    try {
      const response = await this.apiClient.post(`/tools/${request.toolName}/execute`, {
        arguments: request.arguments,
        sessionId: request.sessionId
      });

      const executionTime = Date.now() - startTime;
      
      const result: ToolExecutionResult = {
        success: response.success,
        result: response.result,
        error: response.error,
        executionTime,
        toolName: request.toolName
      };

      // Track tool usage in current execution
      if (this.currentExecution && !this.currentExecution.toolsUsed.includes(request.toolName)) {
        this.currentExecution.toolsUsed.push(request.toolName);
      }

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime,
        toolName: request.toolName
      };
    }
  }

  /**
   * Parse natural language for tool execution (from agent_chat.py)
   */
  parseToolRequest(message: string): ToolExecutionRequest | null {
    const messageLower = message.toLowerCase();
    
    // Navigate tool
    if (messageLower.includes('navigate') || messageLower.includes('go to')) {
      const words = message.split();
      let url = null;
      
      for (const word of words) {
        if (word.startsWith('http://') || word.startsWith('https://')) {
          url = word;
          break;
        } else if (word.includes('.com') || word.includes('.org') || word.includes('.net')) {
          url = word.startsWith('http') ? word : `https://${word}`;
          break;
        }
      }
      
      if (url) {
        return {
          toolName: 'browser_navigate',
          arguments: { url },
          sessionId: this.currentExecution?.sessionId || this.generateSessionId()
        };
      }
    }
    
    // Screenshot tool
    if (messageLower.includes('screenshot') || messageLower.includes('take a picture')) {
      return {
        toolName: 'browser_screenshot',
        arguments: {},
        sessionId: this.currentExecution?.sessionId || this.generateSessionId()
      };
    }
    
    // Click tool
    if (messageLower.includes('click')) {
      const clickIdx = messageLower.indexOf('click');
      const afterClick = message.slice(clickIdx + 5).trim();
      const element = afterClick.replace(/^on\s+/, '').replace(/^the\s+/, '').trim();
      
      if (element) {
        return {
          toolName: 'browser_click',
          arguments: { element },
          sessionId: this.currentExecution?.sessionId || this.generateSessionId()
        };
      }
    }
    
    // Type tool
    if (messageLower.includes('type') || messageLower.includes('enter')) {
      const typeMatch = message.match(/type\s+"([^"]+)"/i);
      if (typeMatch) {
        const text = typeMatch[1];
        // Try to find field reference
        const fieldMatch = message.match(/(?:in|into)\s+(.+?)(?:\s|$)/i);
        const element = fieldMatch ? fieldMatch[1] : 'input';
        
        return {
          toolName: 'browser_type',
          arguments: { element, text },
          sessionId: this.currentExecution?.sessionId || this.generateSessionId()
        };
      }
    }
    
    // Snapshot tool
    if (messageLower.includes('snapshot') || messageLower.includes('page content')) {
      return {
        toolName: 'browser_snapshot',
        arguments: {},
        sessionId: this.currentExecution?.sessionId || this.generateSessionId()
      };
    }
    
    return null;
  }

  /**
   * Get available tools for agent
   */
  async getAvailableTools(): Promise<Array<{
    name: string;
    description: string;
    inputSchema?: any;
    source: 'backend' | 'agent' | 'recorder';
  }>> {
    try {
      const response = await this.apiClient.get('/tools');
      return response.tools || [];
    } catch (error) {
      console.error('Failed to get available tools:', error);
      return [];
    }
  }

  /**
   * List user's agents
   */
  async listAgents(): Promise<AgentDefinition[]> {
    try {
      const response = await this.apiClient.get('/agents');
      return response.agents || [];
    } catch (error) {
      console.error('Failed to list agents:', error);
      return [];
    }
  }

  /**
   * Get agent by ID
   */
  async getAgent(agentId: string): Promise<AgentDefinition | null> {
    try {
      const response = await this.apiClient.get(`/agents/${agentId}`);
      return response.agent || null;
    } catch (error) {
      console.error('Failed to get agent:', error);
      return null;
    }
  }

  /**
   * Update agent configuration
   */
  async updateAgent(agentId: string, updates: Partial<AgentDefinition>): Promise<AgentDefinition> {
    try {
      const response = await this.apiClient.put(`/agents/${agentId}`, updates);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to update agent');
      }
      
      return response.agent;
    } catch (error) {
      console.error('Failed to update agent:', error);
      throw error;
    }
  }

  /**
   * Delete agent
   */
  async deleteAgent(agentId: string): Promise<void> {
    try {
      const response = await this.apiClient.delete(`/agents/${agentId}`);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete agent');
      }
    } catch (error) {
      console.error('Failed to delete agent:', error);
      throw error;
    }
  }

  /**
   * Get chat history for a session
   */
  async getChatHistory(sessionId: string): Promise<AgentMessage[]> {
    try {
      const response = await this.apiClient.get(`/agents/sessions/${sessionId}/messages`);
      return response.messages || [];
    } catch (error) {
      console.error('Failed to get chat history:', error);
      return [];
    }
  }

  /**
   * Clear chat history for current session
   */
  clearCurrentChat(): void {
    if (this.currentExecution) {
      this.currentExecution.messages = [];
      this.currentExecution.toolsUsed = [];
    }
  }

  /**
   * Get current execution
   */
  getCurrentExecution(): AgentExecution | undefined {
    return this.currentExecution;
  }

  // Private helper methods

  private async saveExecution(execution: AgentExecution): Promise<void> {
    try {
      await this.apiClient.post('/agents/executions', execution);
    } catch (error) {
      console.error('Failed to save execution:', error);
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Helper function to create agent service instance
export function createAgentService(tenantId: string): AgentService {
  return new AgentService(tenantId);
}

// Export types for use in components
export type {
  AgentMessage,
  AgentExecution,
  AgentDefinition,
  StreamingResponse,
  ToolExecutionRequest,
  ToolExecutionResult
};