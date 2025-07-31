// Agent Playground - Modern chat interface for AI agents with tool execution
// Modern replacement for chat.py and agent_chat.py with visual tool execution

import React, { useState, useEffect, useRef } from 'react';
import { useTenant } from '../hooks/useTenant';
import { AgentService, AgentMessage, StreamingResponse, ToolExecutionResult } from '../services/AgentService';
import { ToolService, MCPTool } from '../services/ToolService';

interface AgentPlaygroundProps {
  onNavigateToRecorder?: () => void;
  onNavigateToTools?: () => void;
}

export function AgentPlayground({ onNavigateToRecorder, onNavigateToTools }: AgentPlaygroundProps) {
  const { tenant } = useTenant();
  const [agentService] = useState(() => new AgentService(tenant?.id || ''));
  const [toolService] = useState(() => new ToolService(tenant?.id || ''));
  
  // Chat state
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStreamContent, setCurrentStreamContent] = useState('');
  
  // Tools state
  const [availableTools, setAvailableTools] = useState<MCPTool[]>([]);
  const [executingTool, setExecutingTool] = useState<string | null>(null);
  const [toolResults, setToolResults] = useState<Record<string, ToolExecutionResult>>({});
  
  // UI state
  const [showToolPanel, setShowToolPanel] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connected' | 'error'>('disconnected');
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const streamingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadAvailableTools();
    checkConnectionStatus();
    focusInput();
    
    // Load any existing chat history
    loadChatHistory();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentStreamContent]);

  const loadAvailableTools = async () => {
    try {
      const toolsData = await toolService.getAllTools();
      const allTools = [
        ...toolsData.backendTools,
        ...toolsData.agentTools,
        ...toolsData.recorderTools.map(rt => ({
          name: rt.name,
          description: rt.description,
          source: rt.source as 'backend' | 'agent' | 'recorder' | 'marketplace'
        }))
      ];
      setAvailableTools(allTools);
    } catch (error) {
      console.error('Failed to load tools:', error);
    }
  };

  const checkConnectionStatus = async () => {
    try {
      const result = await toolService.testMCPConnection();
      setConnectionStatus(result.connected ? 'connected' : 'disconnected');
    } catch (error) {
      setConnectionStatus('error');
    }
  };

  const loadChatHistory = async () => {
    // For now, start with a welcome message
    const welcomeMessage: AgentMessage = {
      role: 'assistant',
      content: `👋 Welcome to your AI Agent Playground! 

I have access to ${availableTools.length} tools including browser automation, MCP servers, and your recorded automations.

**Try asking me to:**
• "Navigate to google.com and take a screenshot"
• "Create an automation for logging into Gmail"
• "Search for MCP tools in the marketplace"
• "Show me my recorded browser actions"

What would you like to automate today?`,
      timestamp: Date.now()
    };
    
    setMessages([welcomeMessage]);
  };

  const focusInput = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isStreaming) return;

    const userMessage: AgentMessage = {
      role: 'user',
      content: inputMessage.trim(),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsStreaming(true);
    setCurrentStreamContent('');

    try {
      // Check if this is a simple tool execution request
      const toolRequest = agentService.parseToolRequest(inputMessage);
      
      if (toolRequest) {
        // Direct tool execution
        await executeToolDirectly(toolRequest.toolName, toolRequest.arguments);
      } else {
        // Full agent chat with streaming
        const { stream } = await agentService.startChat(inputMessage);
        await processStreamingResponse(stream);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: AgentMessage = {
        role: 'assistant',
        content: `❌ Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsStreaming(false);
      setCurrentStreamContent('');
      focusInput();
    }
  };

  const executeToolDirectly = async (toolName: string, args: Record<string, any>) => {
    setExecutingTool(toolName);
    
    const executionMessage: AgentMessage = {
      role: 'assistant',
      content: `🔧 Executing tool: **${toolName}**`,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, executionMessage]);

    try {
      const result = await toolService.executeTool(toolName, args);
      setToolResults(prev => ({ ...prev, [toolName]: result }));

      const resultMessage: AgentMessage = {
        role: 'assistant',
        content: result.success 
          ? `✅ Successfully executed **${toolName}**!\n\n${result.output || 'Tool executed successfully.'}`
          : `❌ Failed to execute **${toolName}**: ${result.error}`,
        timestamp: Date.now(),
        toolResult: result
      };
      
      setMessages(prev => [...prev, resultMessage]);
    } catch (error) {
      const errorMessage: AgentMessage = {
        role: 'assistant',
        content: `❌ Error executing **${toolName}**: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setExecutingTool(null);
    }
  };

  const processStreamingResponse = async (stream: AsyncGenerator<StreamingResponse>) => {
    let fullContent = '';
    
    try {
      for await (const chunk of stream) {
        if (chunk.type === 'text') {
          fullContent += chunk.content;
          setCurrentStreamContent(fullContent);
        } else if (chunk.type === 'tool_execution') {
          setExecutingTool(chunk.metadata?.toolName || 'unknown');
          
          // Add tool execution indicator
          const toolMessage: AgentMessage = {
            role: 'assistant',
            content: `🔄 ${chunk.content}`,
            timestamp: Date.now()
          };
          setMessages(prev => [...prev, toolMessage]);
        } else if (chunk.type === 'error') {
          fullContent += `\n\n❌ Error: ${chunk.content}`;
          setCurrentStreamContent(fullContent);
        } else if (chunk.type === 'complete') {
          // Final message
          const assistantMessage: AgentMessage = {
            role: 'assistant',
            content: fullContent || chunk.content,
            timestamp: Date.now()
          };
          setMessages(prev => [...prev, assistantMessage]);
          setCurrentStreamContent('');
          setExecutingTool(null);
          break;
        }
      }
    } catch (error) {
      console.error('Streaming error:', error);
      const errorMessage: AgentMessage = {
        role: 'assistant',
        content: `❌ Streaming error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setCurrentStreamContent('');
    setToolResults({});
    agentService.clearCurrentChat();
    
    // Re-add welcome message
    setTimeout(() => {
      loadChatHistory();
    }, 100);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getToolIcon = (toolName: string) => {
    if (toolName.includes('navigate') || toolName.includes('browser')) return '🧭';
    if (toolName.includes('click')) return '🖱️';
    if (toolName.includes('type')) return '⌨️';
    if (toolName.includes('screenshot')) return '📸';
    if (toolName.includes('agent')) return '🤖';
    return '🔧';
  };

  const getConnectionDisplay = () => {
    switch (connectionStatus) {
      case 'connected':
        return <span className="text-green-400">🟢 Connected</span>;
      case 'disconnected':
        return <span className="text-yellow-400">🟡 Disconnected</span>;
      case 'error':
        return <span className="text-red-400">🔴 Error</span>;
      default:
        return <span className="text-gray-400">🔄 Checking...</span>;
    }
  };

  const getToolsBySource = () => {
    const grouped = availableTools.reduce((acc, tool) => {
      const source = tool.source || 'unknown';
      if (!acc[source]) acc[source] = [];
      acc[source].push(tool);
      return acc;
    }, {} as Record<string, MCPTool[]>);
    return grouped;
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-lg p-6 min-h-full">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">
                🤖 Agent Playground
              </h1>
              <p className="text-gray-300">
                Chat with your AI agent that has access to all your automation tools
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-gray-400">Agent Status</p>
                {getConnectionDisplay()}
              </div>
              <button
                onClick={() => setShowToolPanel(!showToolPanel)}
                className="bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 py-2 rounded-lg transition-all duration-300"
              >
                🔧 Tools ({availableTools.length})
              </button>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Main Chat Area */}
          <div className="lg:col-span-3">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 h-[600px] flex flex-col">
              {/* Chat Header */}
              <div className="p-4 border-b border-white/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-xl">🤖</span>
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">AI Agent</h3>
                      <p className="text-gray-400 text-sm">
                        {executingTool ? `Executing ${executingTool}...` : 'Ready to help'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={clearChat}
                      className="bg-gray-600/50 hover:bg-gray-600 text-white px-3 py-1 rounded-lg text-sm transition-all duration-300"
                    >
                      Clear Chat
                    </button>
                  </div>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={`${message.timestamp}-${index}`}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-4 ${
                        message.role === 'user'
                          ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
                          : 'bg-white/10 text-white border border-white/20'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{message.content}</div>
                      
                      {/* Tool Execution Results */}
                      {message.toolResult && (
                        <div className="mt-3 p-3 bg-black/20 rounded-lg border border-white/10">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-gray-400">Tool Execution Result</span>
                            <span className="text-xs text-gray-400">
                              {message.toolResult.executionTime}ms
                            </span>
                          </div>
                          {message.toolResult.result && (
                            <pre className="text-xs text-green-400 whitespace-pre-wrap">
                              {JSON.stringify(message.toolResult.result, null, 2)}
                            </pre>
                          )}
                        </div>
                      )}
                      
                      <div className="text-xs text-gray-400 mt-2">
                        {formatTimestamp(message.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Streaming Message */}
                {currentStreamContent && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] bg-white/10 text-white border border-white/20 rounded-lg p-4">
                      <div className="whitespace-pre-wrap">{currentStreamContent}</div>
                      <div className="flex items-center mt-2">
                        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse mr-2"></div>
                        <span className="text-xs text-gray-400">Streaming...</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Tool Execution Indicator */}
                {executingTool && (
                  <div className="flex justify-start">
                    <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-4">
                      <div className="flex items-center">
                        <div className="animate-spin w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full mr-3"></div>
                        <span className="text-yellow-300">
                          Executing tool: <strong>{executingTool}</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-4 border-t border-white/20">
                <div className="flex space-x-3">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask me to automate something... (e.g., 'Navigate to google.com and take a screenshot')"
                    disabled={isStreaming}
                    className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 disabled:opacity-50"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!inputMessage.trim() || isStreaming}
                    className={`px-6 py-3 rounded-lg font-bold transition-all duration-300 ${
                      inputMessage.trim() && !isStreaming
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white'
                        : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {isStreaming ? '🔄' : '🚀'} Send
                  </button>
                </div>
                
                {/* Quick Actions */}
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    onClick={() => setInputMessage('Take a screenshot of the current page')}
                    className="bg-white/5 hover:bg-white/10 border border-white/20 text-gray-300 px-3 py-1 rounded-lg text-sm transition-all duration-300"
                  >
                    📸 Screenshot
                  </button>
                  <button
                    onClick={() => setInputMessage('Navigate to google.com')}
                    className="bg-white/5 hover:bg-white/10 border border-white/20 text-gray-300 px-3 py-1 rounded-lg text-sm transition-all duration-300"
                  >
                    🧭 Navigate
                  </button>
                  <button
                    onClick={() => setInputMessage('Show me my recorded automations')}
                    className="bg-white/5 hover:bg-white/10 border border-white/20 text-gray-300 px-3 py-1 rounded-lg text-sm transition-all duration-300"
                  >
                    🎬 My Tools
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Tools Panel */}
          {showToolPanel && (
            <div className="lg:col-span-1">
              <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-4">
                <h3 className="text-lg font-bold text-white mb-4">Available Tools</h3>
                
                <div className="space-y-4 max-h-[500px] overflow-y-auto">
                  {Object.entries(getToolsBySource()).map(([source, tools]) => (
                    <div key={source}>
                      <h4 className="text-sm font-semibold text-gray-300 mb-2">
                        {source === 'backend' ? '🖥️ Backend' :
                         source === 'agent' ? '🤖 Agents' :
                         source === 'recorder' ? '🎬 Recorded' : 
                         `📦 ${source}`} ({tools.length})
                      </h4>
                      <div className="space-y-2">
                        {tools.slice(0, 5).map((tool) => (
                          <div
                            key={tool.name}
                            className="bg-white/5 rounded-lg p-3 border border-white/10 hover:bg-white/10 transition-all duration-300 cursor-pointer"
                            onClick={() => setInputMessage(`Use the ${tool.name} tool`)}
                          >
                            <div className="flex items-center">
                              <span className="text-lg mr-2">{getToolIcon(tool.name)}</span>
                              <div className="flex-1">
                                <h5 className="text-white text-sm font-medium">
                                  {tool.name.replace(/_/g, ' ')}
                                </h5>
                                <p className="text-gray-400 text-xs">
                                  {tool.description?.slice(0, 50)}...
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                        {tools.length > 5 && (
                          <p className="text-gray-500 text-xs text-center">
                            +{tools.length - 5} more tools
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick Navigation */}
                <div className="mt-6 space-y-2">
                  {onNavigateToRecorder && (
                    <button
                      onClick={onNavigateToRecorder}
                      className="w-full bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 text-sm"
                    >
                      🎬 Record New Tool
                    </button>
                  )}
                  {onNavigateToTools && (
                    <button
                      onClick={onNavigateToTools}
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 text-sm"
                    >
                      🔧 Manage Tools
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}