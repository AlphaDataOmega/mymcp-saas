import express from "express";
import cors from "cors";
import { appConfig } from "./shared/config.js";
import { createServerWithTools } from "./server.js";
import * as common from "./tools/common.js";
import * as custom from "./tools/custom.js";
import * as snapshot from "./tools/snapshot.js";
import type { Tool } from "./tools/tool.js";
import { localToolManager } from "./local-tool-manager.js";
import { browserRecorder } from "./recorder.js";
import { agentRegistry } from "./agent-registry.js";
import { serverManager } from "./server-manager.js";
import { customToolManager } from "./custom-tool-manager.js";
import { setupManager } from "./setup-manager.js";

const app = express();
app.use(cors());
app.use(express.json());

// Initialize tools
const commonTools: Tool[] = [common.pressKey, common.wait];
const customTools: Tool[] = [custom.getConsoleLogs, custom.screenshot];
const snapshotTools: Tool[] = [
  common.navigate(true),
  common.goBack(true),
  common.goForward(true),
  snapshot.snapshot,
  snapshot.click,
  snapshot.hover,
  snapshot.type,
  snapshot.selectOption,
  ...commonTools,
  ...customTools,
];

let mcpServer: any = null;
let serverContext: any = null;

// Initialize MCP server
async function initializeMCPServer() {
  if (!mcpServer) {
    console.log("🚀 Initializing MCP server with WebSocket support...");
    mcpServer = await createServerWithTools({
      name: appConfig.name,
      version: "1.0.0",
      tools: snapshotTools,
      resources: [],
    });
    
    // Store the context for API access
    serverContext = mcpServer.context;
    console.log("✅ MCP server initialized with WebSocket on port", appConfig.wsPort);
  }
  return mcpServer;
}

// Get the server context for tool execution
function getServerContext() {
  return serverContext;
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "MyMCP.me Backend API" });
});


// Track WebSocket connections
// Track extension connections separately
let httpConnected = false;

// Extension connection status endpoint
app.get("/extension/status", (req, res) => {
  const context = getServerContext();
  const wsReady = context && context.hasWs();
  
  res.json({ 
    connected: httpConnected,
    websocketReady: wsReady,
    timestamp: new Date().toISOString(),
    message: httpConnected ? "Extension HTTP connected" : "Extension not connected"
  });
});

// WebSocket connection tracking endpoints (for extension to notify connection status)
app.post("/extension/connect", (req, res) => {
  httpConnected = true;
  console.log("🔗 Browser extension HTTP connected");
  res.json({ success: true, message: "Extension HTTP connection registered" });
});

app.post("/extension/disconnect", (req, res) => {
  httpConnected = false;
  console.log("🔌 Browser extension HTTP disconnected");
  res.json({ success: true, message: "Extension HTTP disconnection registered" });
});

// Get available tools
app.get("/tools", async (req, res) => {
  try {
    await initializeMCPServer();
    
    // Get registered agent tools (now includes Browser Automation Server)
    const registeredAgents = agentRegistry.getAllAgents();
    const agentTools = registeredAgents.map(agent => {
      const agentTool = agentRegistry.generateMCPTool(agent.id);
      return {
        name: agentTool.schema.name,
        description: agentTool.schema.description,
        inputSchema: agentTool.schema.inputSchema
      };
    });
    
    // Get custom tools (that use marketplace servers)
    const customTools = customToolManager.getReadyTools().map(tool => {
      const customTool = customToolManager.generateMCPTool(tool.id);
      return {
        name: customTool.schema.name,
        description: customTool.schema.description,
        inputSchema: customTool.schema.inputSchema
      };
    });
    
    // Local tools are no longer included in main tools endpoint
    // They remain available through their own management system
    
    console.log(`📋 Serving ${agentTools.length} agent tools + ${customTools.length} custom tools`);
    
    res.json({ tools: [...agentTools, ...customTools] });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Execute a tool
app.post("/tools/:toolName/execute", async (req, res) => {
  try {
    await initializeMCPServer();
    const { toolName } = req.params;
    const { arguments: toolArgs = {} } = req.body;

    const tool = snapshotTools.find(t => t.schema.name === toolName);
    if (!tool) {
      return res.status(404).json({ error: `Tool "${toolName}" not found` });
    }

    // Get the context from the MCP server's WebSocket connections
    // We need to access the context that was created in server.ts
    const context = getServerContext();
    
    console.log(`🔍 Debug: context exists = ${!!context}`);
    console.log(`🔍 Debug: context.hasWs() = ${context ? context.hasWs() : 'N/A'}`);
    
    if (!context || !context.hasWs()) {
      return res.status(400).json({ 
        error: "No browser extension connected. Please connect the browser extension first.",
        connected: false
      });
    }

    // Execute the tool using the actual context
    try {
      const result = await tool.handle(context, toolArgs);
      
      // Convert MCP result format to REST API format
      let responseData = {
        success: true,
        message: `Tool ${toolName} executed successfully`,
        arguments: toolArgs
      };

      // Extract text content from MCP result
      if (result && result.content) {
        const textContent = result.content
          .filter(item => item.type === 'text')
          .map(item => item.text)
          .join('\n');
        
        if (textContent) {
          responseData.result = textContent;
        }
      }

      res.json(responseData);
    } catch (toolError) {
      console.error(`Tool execution error for ${toolName}:`, toolError);
      res.status(500).json({ 
        error: `Tool execution failed: ${String(toolError)}`,
        tool: toolName,
        arguments: toolArgs
      });
    }
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Chat endpoint for agent interactions
app.post("/chat", async (req, res) => {
  try {
    const { message, sessionId, tools = [] } = req.body;
    
    // This endpoint will be used to integrate with the chat system
    // and execute browser automation tools as part of agent conversations
    
    res.json({
      success: true,
      response: `Received message: "${message}" for session ${sessionId}`,
      availableTools: tools.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// === BROWSER RECORDER ENDPOINTS ===
// These endpoints handle communication with browser extension for recording

// Start a new recording session
app.post("/recorder/start", async (req, res) => {
  try {
    const { sessionName, description = "" } = req.body;
    
    if (!sessionName) {
      return res.status(400).json({ error: "sessionName is required" });
    }

    const sessionId = await browserRecorder.startRecording(sessionName, description);
    
    res.json({
      success: true,
      sessionId,
      message: `Started recording session: ${sessionName}`
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Stop the current recording session
app.post("/recorder/stop", async (req, res) => {
  try {
    const session = await browserRecorder.stopRecording();
    
    if (!session) {
      return res.status(400).json({ error: "No active recording session" });
    }

    res.json({
      success: true,
      session: {
        id: session.id,
        name: session.name,
        description: session.description,
        actionsCount: session.actions.length,
        duration: session.endTime ? session.endTime - session.startTime : 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Get all recording sessions
app.get("/recorder/sessions", async (req, res) => {
  try {
    const sessions = browserRecorder.getAllSessions();
    res.json({
      success: true,
      sessions: sessions.map(session => ({
        id: session.id,
        name: session.name,
        description: session.description,
        status: session.status,
        actionsCount: session.actions.length,
        startTime: session.startTime,
        endTime: session.endTime,
        duration: session.endTime ? session.endTime - session.startTime : Date.now() - session.startTime
      }))
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Get a specific recording session
app.get("/recorder/sessions/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = browserRecorder.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    res.json({
      success: true,
      session
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Generate tool code from a recording session
app.post("/recorder/sessions/:sessionId/generate-tool", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const toolCode = browserRecorder.generateToolFromSession(sessionId);
    
    res.json({
      success: true,
      toolCode,
      message: "Tool code generated successfully"
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Record an action from content script
app.post("/recorder/action", async (req, res) => {
  try {
    const { sessionId, action, selector, url, text, value, timestamp, description } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
    }
    
    if (!action) {
      return res.status(400).json({ error: "Action type is required" });
    }

    // Create action object for recorder
    const actionData = {
      type: action,
      selector,
      url,
      text: text || value, // Use either text or value
      timestamp: timestamp || Date.now(),
      description: description || `${action} action`
    };

    // Record action via session-aware method
    browserRecorder.recordActionFromCDP(sessionId, actionData);

    res.json({
      success: true,
      message: `Recorded ${action} action successfully`
    });
  } catch (error) {
    console.error('Error recording action:', error);
    res.status(500).json({ error: String(error) });
  }
});

// Delete a recording session
app.delete("/recorder/sessions/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const deleted = await browserRecorder.deleteSession(sessionId);
    
    if (!deleted) {
      return res.status(404).json({ error: "Session not found" });
    }

    res.json({
      success: true,
      message: "Session deleted successfully"
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Update tool enabled/disabled status for servers
app.post("/servers/:serverId/toggle-tool", async (req, res) => {
  try {
    const { serverId } = req.params;
    const { toolName, enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: "enabled parameter must be a boolean" });
    }
    
    if (!toolName || typeof toolName !== 'string') {
      return res.status(400).json({ error: "toolName parameter is required" });
    }

    const success = await serverManager.updateToolStatus(serverId, toolName, enabled);
    
    if (success) {
      res.json({
        success: true,
        message: `Tool "${toolName}" ${enabled ? 'enabled' : 'disabled'} successfully`
      });
    } else {
      res.status(500).json({
        success: false,
        error: "Failed to update tool status"
      });
    }
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// === AGENT REGISTRY ENDPOINTS ===
// These endpoints handle registration and management of Archon-generated agents

// Register a new agent
app.post("/agents/register", async (req, res) => {
  try {
    const { name, description, code, tools = [], metadata = {} } = req.body;
    
    if (!name || !description || !code) {
      return res.status(400).json({ 
        error: "name, description, and code are required fields" 
      });
    }

    const agentId = await agentRegistry.registerAgent({
      name,
      description,
      code,
      tools,
      metadata
    });
    
    res.json({
      success: true,
      agentId,
      message: `Agent "${name}" registered successfully`
    });
  } catch (error) {
    res.status(500).json({ 
      error: String(error),
      message: "Failed to register agent"
    });
  }
});

// Get all registered agents
app.get("/agents", async (req, res) => {
  try {
    const agents = agentRegistry.getAllAgents();
    res.json({
      success: true,
      agents: agents.map(agent => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        tools: agent.tools,
        created_at: agent.created_at,
        updated_at: agent.updated_at,
        metadata: agent.metadata
      }))
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Get a specific agent
app.get("/agents/:agentId", async (req, res) => {
  try {
    const { agentId } = req.params;
    const agent = agentRegistry.getAgent(agentId);
    
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    res.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        code: agent.code,
        tools: agent.tools,
        created_at: agent.created_at,
        updated_at: agent.updated_at,
        metadata: agent.metadata
      }
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Update an agent
app.put("/agents/:agentId", async (req, res) => {
  try {
    const { agentId } = req.params;
    const updates = req.body;
    
    const success = await agentRegistry.updateAgent(agentId, updates);
    
    if (!success) {
      return res.status(404).json({ error: "Agent not found" });
    }

    res.json({
      success: true,
      message: `Agent updated successfully`
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Execute an agent
app.post("/agents/:agentId/execute", async (req, res) => {
  try {
    const { agentId } = req.params;
    const { params = {} } = req.body;
    
    const result = await agentRegistry.executeAgent(agentId, params);
    
    res.json({
      success: result.success,
      result: result.result,
      error: result.error,
      logs: result.logs
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Unregister an agent
app.delete("/agents/:agentId", async (req, res) => {
  try {
    const { agentId } = req.params;
    const success = await agentRegistry.unregisterAgent(agentId);
    
    if (!success) {
      return res.status(404).json({ error: "Agent not found" });
    }

    res.json({
      success: true,
      message: "Agent unregistered successfully"
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// === SERVER MANAGEMENT ENDPOINTS ===
// These endpoints handle installation and management of marketplace MCP servers

// Install a marketplace server
app.post("/servers/install", async (req, res) => {
  try {
    const { serverName, config } = req.body;
    
    if (!serverName) {
      return res.status(400).json({ error: "serverName is required" });
    }

    let serverId: string;
    
    if (config) {
      // Install with custom config
      serverId = await serverManager.installServer(config);
    } else {
      // Quick install with predefined config
      serverId = await serverManager.quickInstall(serverName);
    }
    
    res.json({
      success: true,
      serverId,
      message: `Server "${serverName}" installed successfully`
    });
  } catch (error) {
    res.status(500).json({ 
      error: String(error),
      message: "Failed to install server"
    });
  }
});

// Start a server
app.post("/servers/:serverId/start", async (req, res) => {
  try {
    const { serverId } = req.params;
    const success = await serverManager.startServer(serverId);
    
    if (success) {
      res.json({
        success: true,
        message: "Server started successfully"
      });
    } else {
      res.status(500).json({
        success: false,
        error: "Failed to start server"
      });
    }
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Stop a server
app.post("/servers/:serverId/stop", async (req, res) => {
  try {
    const { serverId } = req.params;
    const success = await serverManager.stopServer(serverId);
    
    if (success) {
      res.json({
        success: true,
        message: "Server stopped successfully"
      });
    } else {
      res.status(500).json({
        success: false,
        error: "Failed to stop server"
      });
    }
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Get all installed servers
app.get("/servers", async (req, res) => {
  try {
    const servers = serverManager.getAllServers();
    res.json({
      success: true,
      servers: servers.map(server => ({
        id: server.id,
        name: server.name,
        status: server.status,
        tools: server.tools,
        disabledTools: server.disabledTools || [],
        installedAt: server.installedAt,
        lastError: server.lastError
      }))
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Get server details
app.get("/servers/:serverId", async (req, res) => {
  try {
    const { serverId } = req.params;
    const server = serverManager.getServer(serverId);
    
    if (!server) {
      return res.status(404).json({ error: "Server not found" });
    }

    res.json({
      success: true,
      server: {
        id: server.id,
        name: server.name,
        command: server.command,
        args: server.args,
        status: server.status,
        tools: server.tools,
        installedAt: server.installedAt,
        lastError: server.lastError
      }
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});


// Uninstall a server
app.delete("/servers/:serverId", async (req, res) => {
  try {
    const { serverId } = req.params;
    const success = await serverManager.uninstallServer(serverId);
    
    if (!success) {
      return res.status(404).json({ error: "Server not found" });
    }

    res.json({
      success: true,
      message: "Server uninstalled successfully"
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// === CUSTOM TOOL ENDPOINTS ===
// These endpoints handle creation and management of custom tools that wrap marketplace servers

// Create a custom tool
app.post("/tools/custom", async (req, res) => {
  try {
    const { name, description, functionality, requiredServers, inputParameters } = req.body;
    
    if (!name || !description || !functionality || !requiredServers) {
      return res.status(400).json({ 
        error: "name, description, functionality, and requiredServers are required" 
      });
    }

    const toolId = await customToolManager.createCustomTool({
      name,
      description,
      functionality,
      requiredServers,
      inputParameters
    });
    
    res.json({
      success: true,
      toolId,
      message: `Custom tool "${name}" created successfully`
    });
  } catch (error) {
    res.status(500).json({ 
      error: String(error),
      message: "Failed to create custom tool"
    });
  }
});

// Get all custom tools
app.get("/tools/custom", async (req, res) => {
  try {
    const tools = customToolManager.getAllTools();
    res.json({
      success: true,
      tools: tools.map(tool => ({
        id: tool.id,
        name: tool.name,
        description: tool.description,
        marketplaceServers: tool.marketplaceServers,
        createdAt: tool.createdAt,
        createdBy: tool.createdBy
      }))
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Get ready custom tools (with all required servers running)
app.get("/tools/custom/ready", async (req, res) => {
  try {
    const tools = customToolManager.getReadyTools();
    res.json({
      success: true,
      tools: tools.map(tool => ({
        id: tool.id,
        name: tool.name,
        description: tool.description,
        marketplaceServers: tool.marketplaceServers,
        createdAt: tool.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Delete a custom tool
app.delete("/tools/custom/:toolId", async (req, res) => {
  try {
    const { toolId } = req.params;
    const success = await customToolManager.deleteTool(toolId);
    
    if (!success) {
      return res.status(404).json({ error: "Custom tool not found" });
    }

    res.json({
      success: true,
      message: "Custom tool deleted successfully"
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// === LOCAL TOOLS MANAGEMENT ENDPOINTS ===
// These endpoints handle enabling/disabling local tools

// Get local tools with their status
app.get("/local-tools", async (req, res) => {
  try {
    const allTools = localToolManager.getAllTools();
    const disabledTools = localToolManager.getDisabledTools();
    
    const toolsWithStatus = allTools.map(tool => ({
      ...tool,
      enabled: !disabledTools.includes(tool.id)
    }));
    
    res.json({
      success: true,
      systemEnabled: localToolManager.isEnabled(),
      tools: toolsWithStatus,
      totalCount: allTools.length,
      enabledCount: allTools.length - disabledTools.length
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Toggle individual local tool on/off
app.post("/local-tools/:toolId/toggle", async (req, res) => {
  try {
    const { toolId } = req.params;
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: "enabled parameter must be a boolean" });
    }
    
    const success = localToolManager.toggleTool(toolId, enabled);
    
    if (!success) {
      return res.status(404).json({ error: "Tool not found or local tools system disabled" });
    }
    
    res.json({
      success: true,
      toolId,
      enabled: localToolManager.isToolEnabled(toolId),
      message: `Local tool "${toolId}" ${enabled ? 'enabled' : 'disabled'}`
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Global toggle for local tools system
app.post("/local-tools/toggle", async (req, res) => {
  try {
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: "enabled parameter must be a boolean" });
    }
    
    localToolManager.setEnabled(enabled);
    
    res.json({
      success: true,
      enabled: localToolManager.isEnabled(),
      toolsCount: localToolManager.getAllTools().length,
      message: `Local tools system ${enabled ? 'enabled' : 'disabled'}`
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// === SETUP MANAGEMENT ENDPOINTS ===
// These endpoints handle intelligent API key setup for marketplace servers

// Get setup requirements for a server
app.get("/setup/:serverName", async (req, res) => {
  try {
    const { serverName } = req.params;
    const requirements = setupManager.getSetupRequirements(serverName);
    
    if (!requirements) {
      return res.status(404).json({ error: `No setup information available for ${serverName}` });
    }

    res.json({
      success: true,
      setup: requirements,
      needsSetup: setupManager.needsSetup(serverName),
      missingRequirements: setupManager.getMissingRequirements(serverName)
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Get setup guide for a server
app.get("/setup/:serverName/guide", async (req, res) => {
  try {
    const { serverName } = req.params;
    const guide = setupManager.generateSetupGuide(serverName);
    
    res.json({
      success: true,
      guide: guide
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Test API key validity
app.post("/setup/:serverName/test", async (req, res) => {
  try {
    const { serverName } = req.params;
    const { key, value } = req.body;
    
    if (!key || !value) {
      return res.status(400).json({ error: "key and value are required" });
    }

    // Validate format
    const isValidFormat = setupManager.validateApiKey(serverName, key, value);
    if (!isValidFormat) {
      return res.json({
        success: false,
        valid: false,
        error: "Invalid API key format"
      });
    }

    // Test actual API
    const testResult = await setupManager.testApiKey(serverName, key, value);
    
    res.json({
      success: true,
      valid: testResult.valid,
      error: testResult.error
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Get all servers with setup status
app.get("/setup", async (req, res) => {
  try {
    const servers = setupManager.getAllServersWithSetupStatus();
    
    res.json({
      success: true,
      servers: servers
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// MCP Server endpoint
app.get("/mcp", async (req, res) => {
  try {
    await initializeMCPServer();
    // This endpoint will handle MCP protocol requests
    // For now, return server info
    res.json({
      name: appConfig.name,
      version: "1.0.0",
      protocol: "mcp/1.0",
      capabilities: {
        tools: {},
        resources: {}
      },
      tools: snapshotTools.map(tool => ({
        name: tool.schema.name,
        description: tool.schema.description,
        inputSchema: tool.schema.inputSchema
      }))
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Create browser automation server agent
async function createBrowserAutomationAgent() {
  try {
    // Check if browser automation agent already exists
    const existingAgents = agentRegistry.getAllAgents();
    const existingBrowserAgent = existingAgents.find(agent => 
      agent.metadata?.type === 'browser_automation_server'
    );

    if (existingBrowserAgent) {
      console.log("🤖 Browser Automation Server agent already exists");
      return;
    }

    const browserToolNames = snapshotTools.map(tool => tool.schema.name);
    const browserToolsList = browserToolNames.map(name => 
      name.replace('browser_', '').replace('_', ' ')
    );

    const agentCode = `"""
Browser Automation Server Agent
Provides access to all core browser automation tools through a unified interface.

Available tools: ${browserToolNames.join(', ')}
"""

import asyncio
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIModel

# Initialize the browser automation agent
browser_agent = Agent(
    model=OpenAIModel("gpt-4o-mini"),
    system_prompt="""You are a Browser Automation Server that provides access to ${browserToolNames.length} core browser automation tools.
    
    Available tools:
    ${browserToolsList.map((tool, i) => `- ${browserToolNames[i]}: ${tool}`).join('\n    ')}
    
    You can execute any browser automation task using these tools.
    """
)

${browserToolNames.map(toolName => `
@browser_agent.tool
async def ${toolName.replace('-', '_')}(**kwargs) -> str:
    """${toolName} - Browser automation tool"""
    try:
        import requests
        
        # Call the actual backend tool
        response = requests.post(
            f"http://localhost:${appConfig.apiPort}/tools/${toolName}/execute",
            json={"arguments": kwargs},
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            return result.get('result', f"✅ {toolName} executed successfully")
        else:
            error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
            return f"❌ Error executing ${toolName}: {error_data.get('error', response.text)}"
            
    except Exception as e:
        return f"❌ Error calling ${toolName}: {str(e)}"
`).join('')}

# Main execution function
async def run_agent(params: dict = None):
    """Main function to run the Browser Automation Server"""
    try:
        tool_name = params.get('tool_name') if params else None
        
        if tool_name and hasattr(globals(), tool_name.replace('-', '_')):
            # Call the specific tool function
            tool_func = globals()[tool_name.replace('-', '_')]
            result = await tool_func(**(params.get('tool_params', {})))
        else:
            # General browser automation interaction
            user_query = params.get('query', 'Show available browser automation tools') if params else 'Show available browser automation tools'
            result = await browser_agent.run(user_query)
            result = result.data
            
        return {
            "success": True,
            "result": result,
            "type": "browser_automation_server",
            "available_tools": [${browserToolNames.map(name => `"${name}"`).join(', ')}]
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "type": "browser_automation_server"
        }

# For backward compatibility
def execute_agent():
    """Legacy function name"""
    return asyncio.run(run_agent())
`;

    const agentId = await agentRegistry.registerAgent({
      name: "Browser Automation Server",
      description: `Core browser automation server with ${browserToolNames.length} tools: ${browserToolsList.join(', ')}`,
      code: agentCode,
      tools: browserToolNames,
      metadata: {
        type: 'browser_automation_server',
        created_at: new Date().toISOString(),
        tool_count: browserToolNames.length
      }
    });

    console.log(`🤖 Created Browser Automation Server agent (ID: ${agentId})`);
  } catch (error) {
    console.error("❌ Failed to create Browser Automation Server agent:", error);
  }
}

// AI provider validation endpoint using setup-manager
app.post("/validate/ai-provider", async (req, res) => {
  try {
    const { provider, apiKey } = req.body;
    
    if (!provider || !apiKey) {
      return res.status(400).json({ 
        valid: false, 
        error: "Provider and API key are required" 
      });
    }

    // Map provider names to setup-manager keys
    const providerKeyMap: Record<string, string> = {
      'openai': 'OPENAI_API_KEY',
      'anthropic': 'ANTHROPIC_API_KEY'
    };

    const keyName = providerKeyMap[provider];
    if (!keyName) {
      return res.status(400).json({ 
        valid: false, 
        error: `Unsupported provider: ${provider}` 
      });
    }

    // Validate format first
    const isValidFormat = setupManager.validateApiKey(provider, keyName, apiKey);
    if (!isValidFormat) {
      return res.json({
        valid: false,
        error: `Invalid ${provider} API key format`
      });
    }

    // Test actual API connection
    const testResult = await setupManager.testApiKey(provider, keyName, apiKey);
    
    res.json({
      valid: testResult.valid,
      error: testResult.error
    });
  } catch (error) {
    console.error('AI provider validation error:', error);
    res.status(500).json({ 
      valid: false, 
      error: 'Internal validation error' 
    });
  }
});

// Supabase validation endpoint (mimics original Streamlit approach)
app.post("/validate/supabase", async (req, res) => {
  try {
    const { supabaseUrl, supabaseServiceKey } = req.body;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(400).json({ 
        valid: false, 
        error: "Both Supabase URL and service key are required" 
      });
    }

    // Basic URL format validation
    if (!supabaseUrl.includes('supabase') || !supabaseUrl.startsWith('https://')) {
      return res.json({
        valid: false,
        error: 'Invalid Supabase URL format'
      });
    }

    // Import createClient here to avoid issues
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Simple connection test - just verify we can make a basic REST API call
    try {
      console.log(`Testing Supabase connection to: ${supabaseUrl}`);
      
      // Make a simple REST API call to verify the connection and auth
      const testUrl = `${supabaseUrl}/rest/v1/`;
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'apikey': supabaseServiceKey,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Supabase REST API response:', response.status, response.statusText);
      
      if (response.ok) {
        // Connection successful
        console.log('Supabase validation successful');
        res.json({
          valid: true,
          permissions: ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE'],
          hasRequiredTables: false, // We don't know without querying
          canCreateTables: true
        });
      } else if (response.status === 401 || response.status === 403) {
        res.json({
          valid: false,
          error: 'Invalid API key or insufficient permissions',
          details: {
            statusCode: response.status,
            suggestion: 'Please ensure you are using the service_role key from Supabase Settings > API'
          }
        });
      } else {
        const errorText = await response.text().catch(() => 'Unknown error');
        res.json({
          valid: false,
          error: `Connection failed: ${response.status} ${response.statusText}`,
          details: {
            statusCode: response.status,
            errorText,
            suggestion: 'Check your Supabase URL and service key'
          }
        });
      }
    } catch (connectionError: any) {
      console.error('Supabase connection error:', connectionError);
      res.json({
        valid: false,
        error: `Connection failed: ${connectionError.message || 'Unknown error'}`,
        details: {
          suggestion: 'Check your Supabase URL format and service key'
        }
      });
    }
  } catch (error: any) {
    console.error('Supabase validation error:', error);
    res.status(500).json({ 
      valid: false, 
      error: 'Internal validation error' 
    });
  }
});

// Start the API server

const port = appConfig.apiPort;
app.listen(port, async () => {
  console.log(`MyMCP.me API server running on port ${port}`);
  console.log(`WebSocket server will run on port ${appConfig.wsPort}`);
  console.log(`MCP server available at: http://localhost:${port}/mcp`);
  
  // Initialize MCP server immediately on startup
  try {
    await initializeMCPServer();
    console.log("🎯 MCP server ready for connections");
    
    // Create browser automation server agent
    await createBrowserAutomationAgent();
  } catch (error) {
    console.error("❌ Failed to initialize MCP server:", error);
  }
});

export default app;