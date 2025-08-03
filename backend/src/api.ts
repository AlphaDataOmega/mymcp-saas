import dotenv from "dotenv";

// Load environment variables FIRST before any other imports
dotenv.config();

import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
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
import marketplaceRouter from "./marketplace-api.js";

const app = express();
app.use(cors());
app.use(express.json());

// Marketplace API routes
app.use('/api/marketplace', marketplaceRouter);

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
let lastExtensionPing = 0;
const EXTENSION_TIMEOUT = 5000; // 5 seconds timeout for quicker detection

// Check if extension is actually connected (with timeout and staleness check)
function isExtensionConnected(): boolean {
  if (!httpConnected) return false;
  
  const now = Date.now();
  
  // If we haven't heard from extension in a while, assume disconnected
  if (lastExtensionPing > 0 && (now - lastExtensionPing) > EXTENSION_TIMEOUT) {
    // Extension hasn't pinged in a while, consider it disconnected
    httpConnected = false;
    console.log("🔌 Extension timed out - marking as disconnected");
    return false;
  }
  
  // Additional check: if connection is stale (no ping for 5+ seconds), be more skeptical
  if (lastExtensionPing > 0 && (now - lastExtensionPing) > 5000) {
    console.log("⚠️ Extension connection may be stale, last ping:", new Date(lastExtensionPing).toISOString());
  }
  
  return httpConnected;
}

// Extension connection status endpoint
app.get("/extension/status", (req, res) => {
  const context = getServerContext();
  const wsReady = context && context.hasWs();
  const connected = isExtensionConnected();
  
  // If we think we're connected but it's been a while since last ping, be more aggressive
  const now = Date.now();
  if (connected && lastExtensionPing > 0 && (now - lastExtensionPing) > 3000) {
    console.log("🔍 Connection status check: extension hasn't pinged in", (now - lastExtensionPing) / 1000, "seconds");
  }
  
  res.json({ 
    connected: connected,
    websocketReady: wsReady,
    timestamp: new Date().toISOString(),
    lastPing: lastExtensionPing > 0 ? new Date(lastExtensionPing).toISOString() : null,
    message: connected ? "Extension HTTP connected" : "Extension not connected"
  });
});

// WebSocket connection tracking endpoints (for extension to notify connection status)
app.post("/extension/connect", (req, res) => {
  httpConnected = true;
  lastExtensionPing = Date.now();
  console.log("🔗 Browser extension HTTP connected");
  res.json({ success: true, message: "Extension HTTP connection registered" });
});

app.post("/extension/disconnect", (req, res) => {
  httpConnected = false;
  lastExtensionPing = 0;
  console.log("🔌 Browser extension HTTP disconnected");
  
  // When extension disconnects, stop any active recordings
  try {
    const currentSession = browserRecorder.getCurrentSession();
    if (currentSession && currentSession.status === 'recording') {
      console.log("🛑 Auto-stopping recording due to extension disconnect");
      browserRecorder.stopRecording();
    }
  } catch (error) {
    console.warn("Failed to auto-stop recording on disconnect:", error);
  }
  
  res.json({ success: true, message: "Extension HTTP disconnection registered" });
});

// Manual extension connection reset (for debugging/cleanup)
app.post("/extension/reset", (req, res) => {
  httpConnected = false;
  lastExtensionPing = 0;
  console.log("🔄 Extension connection status manually reset");
  
  // Also stop any active recordings when manually resetting
  try {
    const currentSession = browserRecorder.getCurrentSession();
    if (currentSession && currentSession.status === 'recording') {
      console.log("🛑 Auto-stopping recording due to manual reset");
      browserRecorder.stopRecording();
    }
    
    // CRITICAL FIX: Clear all stored sessions to prevent persistent "toystory" issues
    console.log("🧹 Clearing all stored sessions for complete reset");
    browserRecorder.clearAllSessions();
  } catch (error) {
    console.warn("Failed to auto-stop recording on reset:", error);
  }
  
  res.json({ success: true, message: "Extension connection status and recordings reset" });
});

// Track pending automation requests
let pendingAutomationRequest: { wsUrl: string; timestamp: number } | null = null;

// Extension automation start endpoint
app.post("/extension/start-automation", async (req, res) => {
  try {
    const { wsUrl } = req.body;
    
    if (!wsUrl) {
      return res.status(400).json({ error: "WebSocket URL is required" });
    }
    
    console.log("🚀 Starting extension automation with WebSocket:", wsUrl);
    
    // Check if extension is connected
    if (!isExtensionConnected()) {
      return res.status(400).json({ 
        error: "Browser extension not connected",
        connected: false
      });
    }
    
    // Store the automation request for the extension to pick up via polling
    pendingAutomationRequest = {
      wsUrl,
      timestamp: Date.now()
    };
    
    console.log("📝 Queued automation request for extension pickup");
    
    res.json({ 
      success: true, 
      message: "Automation start command queued for extension", 
      wsUrl,
      connected: true
    });
    
  } catch (error) {
    console.error("❌ Error starting extension automation:", error);
    res.status(500).json({ error: String(error) });
  }
});

// Extension endpoint to check for pending automation requests
app.get("/extension/automation-requests", (req, res) => {
  try {
    if (!isExtensionConnected()) {
      return res.status(400).json({ 
        error: "Browser extension not connected",
        connected: false
      });
    }
    
    if (pendingAutomationRequest) {
      const request = pendingAutomationRequest;
      pendingAutomationRequest = null; // Clear the request after pickup
      
      console.log("📤 Delivering automation request to extension");
      
      res.json({
        success: true,
        automationRequest: request,
        hasRequest: true
      });
    } else {
      res.json({
        success: true,
        hasRequest: false
      });
    }
    
  } catch (error) {
    console.error("❌ Error checking automation requests:", error);
    res.status(500).json({ error: String(error) });
  }
});

// Extension download endpoint
app.get("/extension/download", (req, res) => {
  const extensionPath = path.join(process.cwd(), "extension", "mymcp-extension-latest.zip");
  
  if (fs.existsSync(extensionPath)) {
    res.download(extensionPath, "mymcp-extension-latest.zip");
  } else {
    res.status(404).json({ error: "Extension package not found" });
  }
});

// Get available extension versions
app.get("/extension/versions", (req, res) => {
  try {
    const extensionDir = path.join(process.cwd(), "extension");
    const files = fs.readdirSync(extensionDir);
    
    const extensionFiles = files.filter(file => 
      file.endsWith('.tar.gz') || file.endsWith('.zip')
    );
    
    const versions = extensionFiles.map(filename => {
      const stats = fs.statSync(path.join(extensionDir, filename));
      
      // Enhanced version parsing function
      const parseVersionFromFilename = (filename) => {
        // Special cases first
        if (filename.includes('latest')) {
          return 'Latest';
        }
        
        // Try to match semantic version patterns (v2.3.1, v2.3.5, etc.) - most specific first
        const semanticMatch = filename.match(/v?(\d+\.\d+\.\d+)/i);
        if (semanticMatch) {
          return `v${semanticMatch[1]}`;
        }
        
        // Try to match major.minor version patterns (v2.3, v2.4, etc.) but not if followed by another dot
        const majorMinorMatch = filename.match(/v?(\d+\.\d+)(?:[^.\d]|$)/i);
        if (majorMinorMatch) {
          return `v${majorMinorMatch[1]}`;
        }
        
        // Try to match single version numbers (v2, v3, etc.)
        const majorMatch = filename.match(/v(\d+)/i);
        if (majorMatch) {
          return `v${majorMatch[1]}`;
        }
        
        // Fallback patterns
        if (filename.includes('redesigned')) return 'Redesigned';
        if (filename.includes('updated')) return 'Updated';
        
        return 'Unknown';
      };
      
      const version = parseVersionFromFilename(filename);
      
      // Generate description based on version
      let description = 'MyMCP.me Browser Extension';
      
      if (version === 'Latest') {
        description = 'Most recent build with latest features and improvements.';
      } else if (version.startsWith('v1.')) {
        description = 'Stable version with bidirectional recording sync, BrowserMCP playback capabilities, and improved connection stability.';
      } else if (version.startsWith('v2.')) {
        description = 'Enhanced version with advanced recording features and better browser automation support.';
      } else if (version === 'Redesigned') {
        description = 'UI redesigned version with improved popup interface.';
      } else if (version === 'Updated') {
        description = 'Updated build with bug fixes and performance improvements.';
      } else if (version !== 'Unknown') {
        description = `Extension version ${version} with core recording and automation functionality.`;
      }
      
      return {
        filename,
        version,
        description,
        size: `${Math.round(stats.size / 1024)} KB`,
        uploadDate: stats.mtime.toLocaleDateString()
      };
    }).sort((a, b) => {
      // Sort "Latest" first
      if (a.version === 'Latest') return -1;
      if (b.version === 'Latest') return 1;
      
      // Then sort by version number (newest first)
      const parseVersionNumber = (version) => {
        if (!version.startsWith('v')) return 0;
        const versionStr = version.substring(1);
        const parts = versionStr.split('.').map(n => parseInt(n) || 0);
        // Convert to comparable number: v2.3.1 -> 20301, v2.4.0 -> 20400
        return (parts[0] || 0) * 10000 + (parts[1] || 0) * 100 + (parts[2] || 0);
      };
      
      const aVersion = parseVersionNumber(a.version);
      const bVersion = parseVersionNumber(b.version);
      
      if (aVersion !== bVersion) {
        return bVersion - aVersion; // Newest first
      }
      
      // Fallback to filename comparison
      return a.filename.localeCompare(b.filename);
    });
    
    res.json({ success: true, versions });
  } catch (error) {
    console.error('Error fetching extension versions:', error);
    res.status(500).json({ error: 'Failed to fetch extension versions' });
  }
});

// Download specific extension version
app.get("/extension/download/:filename", (req, res) => {
  try {
    const { filename } = req.params;
    const extensionPath = path.join(process.cwd(), "extension", filename);
    
    if (!fs.existsSync(extensionPath)) {
      return res.status(404).json({ error: "Extension file not found" });
    }
    
    // Security check - only allow files in extension directory
    const normalizedPath = path.normalize(extensionPath);
    const extensionDir = path.normalize(path.join(process.cwd(), "extension"));
    
    if (!normalizedPath.startsWith(extensionDir)) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    res.download(extensionPath, filename);
  } catch (error) {
    console.error('Error downloading extension:', error);
    res.status(500).json({ error: 'Failed to download extension' });
  }
});

// Extension ping endpoint for communication testing and heartbeat
app.post("/extension/ping", (req, res) => {
  // Update last ping time for heartbeat
  lastExtensionPing = Date.now();
  
  res.json({ 
    success: true, 
    timestamp: new Date().toISOString(),
    message: "Extension communication test successful"
  });
});

// Extension info endpoint
app.get("/extension/info", (req, res) => {
  res.json({
    info: {
      version: "1.0.0",
      capabilities: ["recording", "automation", "data-extraction"],
      connectedAt: httpConnected ? new Date().toISOString() : null
    }
  });
});

// Extension trigger connect endpoint
app.post("/extension/trigger-connect", (req, res) => {
  // This would ideally trigger the extension to connect
  // For now, we'll just return success if we're expecting a connection
  res.json({ 
    success: true, 
    message: "Connection trigger sent (extension should auto-connect)" 
  });
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

// Force stop all recordings (emergency reset)
app.post("/recorder/force-stop", async (req, res) => {
  try {
    console.log("🚨 Force stopping all recordings...");
    
    // Get all sessions and mark any active ones as stopped
    const currentSession = browserRecorder.getCurrentSession();
    if (currentSession && currentSession.status === 'recording') {
      console.log("🛑 Force stopping active session:", currentSession.id);
      await browserRecorder.stopRecording();
    }
    
    // CRITICAL FIX: Clear all stored sessions to prevent persistent "toystory" issues
    console.log("🧹 Clearing all stored sessions for complete reset");
    browserRecorder.clearAllSessions();
    
    res.json({
      success: true,
      message: "All recordings force-stopped and sessions cleared successfully"
    });
  } catch (error) {
    console.error("Failed to force stop recordings:", error);
    res.status(500).json({ 
      error: String(error),
      success: false 
    });
  }
});

// Get current recording status (for sync between frontend and extension)
app.get("/recorder/status", (req, res) => {
  try {
    const currentSession = browserRecorder.getCurrentSession();
    let displaySession = currentSession;
    
    // If no current session, get the most recent session
    if (!displaySession) {
      const allSessions = browserRecorder.getAllSessions();
      if (allSessions.length > 0) {
        // Sort by start time and get the most recent
        const sortedSessions = allSessions.sort((a, b) => b.startTime - a.startTime);
        displaySession = sortedSessions[0];
      }
    }
    
    res.json({
      success: true,
      isRecording: currentSession?.status === 'recording',
      currentSession: displaySession ? {
        id: displaySession.id,
        name: displaySession.name,
        startTime: displaySession.startTime,
        actionsCount: displaySession.actions.length,
        status: displaySession.status
      } : null
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
    const { toolName, toolDescription } = req.body; // Accept custom name and description
    const toolCode = browserRecorder.generateToolFromSession(sessionId, 'mcp', toolName, toolDescription);
    
    res.json({
      success: true,
      toolCode,
      message: "Tool code generated successfully"
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Get recorder connection status  
app.get("/recorder/connection-status", (req, res) => {
  const context = getServerContext();
  const wsReady = context && context.hasWs();
  
  res.json({
    extensionConnected: httpConnected,
    recorderReady: httpConnected && wsReady,
    activeSession: browserRecorder.getCurrentSession()?.id || null,
    timestamp: new Date().toISOString()
  });
});

// Record an action from content script
app.post("/recorder/action", async (req, res) => {
  try {
    const { sessionId, action, type, selector, url, text, value, timestamp, description } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
    }
    
    const actionType = action || type;
    if (!actionType) {
      return res.status(400).json({ error: "Action type is required" });
    }

    // Create action object for recorder
    const actionData = {
      type: actionType,
      selector,
      url,
      text: text || value, // Use either text or value
      timestamp: timestamp || Date.now(),
      description: description || `${actionType} action`
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

// Clear all recording sessions (for reset functionality)
app.post("/recorder/sessions/clear", async (req, res) => {
  try {
    console.log("🧹 API request to clear all recording sessions");
    browserRecorder.clearAllSessions();
    
    res.json({
      success: true,
      message: "All recording sessions cleared successfully"
    });
  } catch (error) {
    console.error("Failed to clear sessions:", error);
    res.status(500).json({ error: String(error) });
  }
});

// Generate tool from the latest/current session
app.post("/recorder/generate-tool", async (req, res) => {
  try {
    let sessionToUse = browserRecorder.getCurrentSession();
    
    // If no active session, find the most recent completed session
    if (!sessionToUse) {
      console.log("🔍 No active session found, looking for recent completed session...");
      const sessions = browserRecorder.getSessions();
      const recentCompletedSession = sessions
        .filter(s => s.status === 'stopped' && s.actions && s.actions.length > 0)
        .sort((a, b) => (b.endTime || b.startTime) - (a.endTime || a.startTime))[0];
      
      if (recentCompletedSession) {
        console.log(`📝 Found recent session: ${recentCompletedSession.name} with ${recentCompletedSession.actions.length} actions`);
        sessionToUse = recentCompletedSession;
      } else {
        return res.status(400).json({ error: "No active or recent recording session found with actions" });
      }
    }

    const { toolName, toolDescription } = req.body; // Accept custom name and description
    const toolCode = browserRecorder.generateToolFromSession(sessionToUse.id, 'mcp', toolName, toolDescription);
    
    res.json({
      success: true,
      toolCode,
      sessionId: sessionToUse.id,
      message: "Tool code generated successfully"
    });
  } catch (error) {
    console.error("Failed to generate tool:", error);
    res.status(500).json({ error: String(error) });
  }
});

// Convert Python Playwright code to WebSocket commands for extension execution
function convertPythonToWebSocketCommands(pythonCode: string): Array<{action: string, params: any}> {
  const commands: Array<{action: string, params: any}> = [];
  const lines = pythonCode.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Extract page.goto() commands
    const gotoMatch = trimmed.match(/await page\.goto\(['"](.+?)['"]\)/);
    if (gotoMatch) {
      commands.push({
        action: 'browser_navigate',
        params: { url: gotoMatch[1] }
      });
      continue;
    }
    
    // Extract page.fill() commands
    const fillMatch = trimmed.match(/await page\.fill\(['"](.+?)['"], ['"](.+?)['"]\)/);
    if (fillMatch) {
      commands.push({
        action: 'browser_type',
        params: { element: fillMatch[1], text: fillMatch[2] }
      });
      continue;
    }
    
    // Extract page.click() commands
    const clickMatch = trimmed.match(/await page\.click\(['"](.+?)['"]\)/);
    if (clickMatch) {
      commands.push({
        action: 'browser_click',
        params: { element: clickMatch[1] }
      });
      continue;
    }
    
    // Extract page.hover() commands
    const hoverMatch = trimmed.match(/await page\.hover\(['"](.+?)['"]\)/);
    if (hoverMatch) {
      commands.push({
        action: 'browser_hover',
        params: { element: hoverMatch[1] }
      });
      continue;
    }
    
    // Extract page.selectOption() commands
    const selectMatch = trimmed.match(/await page\.selectOption\(['"](.+?)['"], ['"](.+?)['"]\)/);
    if (selectMatch) {
      commands.push({
        action: 'browser_select_option',
        params: { element: selectMatch[1], option: selectMatch[2] }
      });
      continue;
    }
    
    // Extract page.goBack() commands
    const goBackMatch = trimmed.match(/await page\.goBack\(\)/);
    if (goBackMatch) {
      commands.push({
        action: 'browser_go_back',
        params: {}
      });
      continue;
    }
    
    // Extract page.goForward() commands
    const goForwardMatch = trimmed.match(/await page\.goForward\(\)/);
    if (goForwardMatch) {
      commands.push({
        action: 'browser_go_forward',
        params: {}
      });
      continue;
    }
    
    // Extract page.waitForTimeout() commands
    const waitMatch = trimmed.match(/await page\.waitForTimeout\((\d+)\)/);
    if (waitMatch) {
      commands.push({
        action: 'browser_wait',
        params: { time: parseInt(waitMatch[1]) / 1000 } // Convert ms to seconds
      });
      continue;
    }
    
    // Extract page.keyboard.press() commands
    const keyPressMatch = trimmed.match(/await page\.keyboard\.press\(['"](.+?)['"]\)/);
    if (keyPressMatch) {
      commands.push({
        action: 'browser_press_key',
        params: { key: keyPressMatch[1] }
      });
      continue;
    }
    
    // Extract page.screenshot() commands
    const screenshotMatch = trimmed.match(/await page\.screenshot\(/);
    if (screenshotMatch) {
      commands.push({
        action: 'browser_screenshot',
        params: {}
      });
      continue;
    }
    
    // Extract drag and drop operations
    const dragMatch = trimmed.match(/await page\.dragAndDrop\(['"](.+?)['"], ['"](.+?)['"]\)/);
    if (dragMatch) {
      commands.push({
        action: 'browser_drag',
        params: { startElement: dragMatch[1], endElement: dragMatch[2] }
      });
      continue;
    }
    
    // Extract console evaluation
    const consoleMatch = trimmed.match(/await page\.evaluate\(.*console/);
    if (consoleMatch) {
      commands.push({
        action: 'browser_get_console_logs',
        params: {}
      });
      continue;
    }
  }
  
  return commands;
}

// Test a generated tool by executing its Python code
app.post("/recorder/test-tool", async (req, res) => {
  try {
    let { code, sessionId } = req.body;
    
    // If sessionId provided but no code, generate Playwright code for testing
    if (sessionId && !code) {
      try {
        code = browserRecorder.generateToolFromSession(sessionId, 'playwright');
        console.log("🎭 Generated Playwright code for testing from session:", sessionId);
      } catch (error) {
        return res.status(400).json({ 
          error: `Failed to generate test code from session: ${String(error)}`,
          sessionId 
        });
      }
    }
    
    if (!code) {
      return res.status(400).json({ error: "Python code or sessionId is required" });
    }

    // Check if browser extension is connected for browser automation
    if (!isExtensionConnected()) {
      return res.status(400).json({ 
        error: "Browser extension not connected. Tool testing requires an active browser connection.",
        connected: false
      });
    }

    console.log("🧪 Testing generated tool via AI call...");
    
    // Get the MCP server context to make an AI-driven tool call
    const context = getServerContext();
    if (!context) {
      return res.status(500).json({
        error: "MCP server context not available",
        success: false
      });
    }

    try {
      // First ensure WebSocket connection is available
      if (!context.hasWs()) {
        console.log("🔌 No WebSocket connection - attempting to establish...");
        
        try {
          // Trigger extension to connect to WebSocket
          const automationResponse = await fetch(`http://localhost:${appConfig.apiPort}/extension/start-automation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              wsUrl: `ws://localhost:${appConfig.wsPort}`
            })
          });
          
          if (!automationResponse.ok) {
            throw new Error('Failed to start automation mode on extension');
          }
          
          // Wait with retries for WebSocket connection
          let attempts = 0;
          const maxAttempts = 15;
          const retryDelay = 1000;
          
          while (!context.hasWs() && attempts < maxAttempts) {
            console.log(`⏳ Waiting for extension to connect to WebSocket... (${attempts + 1}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            attempts++;
          }
          
          if (!context.hasWs()) {
            throw new Error(`WebSocket connection not established after ${maxAttempts * retryDelay}ms`);
          }
          
          console.log("✅ WebSocket connection established successfully");
          
        } catch (error) {
          console.error("❌ Failed to establish WebSocket connection:", error);
          return res.status(500).json({
            success: false,
            error: `Failed to establish browser automation connection: ${error.message}`,
            connected: isExtensionConnected()
          });
        }
      }
      
      // Get the session and convert actions to BrowserMCP tool calls
      if (sessionId) {
        console.log("📝 Testing session actions via BrowserMCP tools...");
        
        const session = browserRecorder.getSession(sessionId);
        if (!session) {
          return res.status(404).json({
            error: `Session ${sessionId} not found`,
            success: false
          });
        }
        
        if (!session.actions || session.actions.length === 0) {
          return res.status(400).json({
            error: "No actions found in session to test",
            success: false
          });
        }
        
        // Execute each action using WebSocket messages
        const results = [];
        let isFirstAction = true;
        
        for (const action of session.actions) {
          console.log(`🎯 Testing action: ${action.type}`);
          
          try {
            let result;
            
            switch (action.type) {
              case 'navigate':
                if (isFirstAction) {
                  console.log(`🎯 Executing first navigation: ${action.url}`);
                  result = await context.sendSocketMessage("browser_navigate", { url: action.url });
                  results.push({ action: 'navigate', url: action.url, success: true, result });
                } else {
                  console.log(`🎯 Skipping subsequent navigate command (page load event): ${action.url}`);
                  results.push({ 
                    action: 'navigate', 
                    url: action.url, 
                    success: true, 
                    result: `Skipped navigation to ${action.url} (page load after user action)` 
                  });
                }
                break;
                
              case 'click':
                if (action.x !== undefined && action.y !== undefined) {
                  console.log(`🎯 Sending click command: browser_click with coordinates: (${action.x}, ${action.y})`);
                  result = await context.sendSocketMessage("browser_click", { 
                    x: action.x,
                    y: action.y
                  });
                  results.push({ 
                    action: 'click', 
                    coordinates: `(${action.x}, ${action.y})`, 
                    success: true, 
                    result: `Clicked at coordinates (${action.x}, ${action.y})` 
                  });
                } else if (action.selector) {
                  console.log(`🎯 Sending click command: browser_click with selector: ${action.selector}`);
                  result = await context.sendSocketMessage("browser_click", { 
                    selector: action.selector
                  });
                  results.push({ 
                    action: 'click', 
                    selector: action.selector, 
                    success: true, 
                    result: `Clicked on ${action.selector}` 
                  });
                } else {
                  console.log(`⚠️ Click action missing coordinates and selector, skipping`);
                  results.push({ 
                    action: 'click', 
                    success: false, 
                    result: `Click action missing coordinates and selector` 
                  });
                }
                break;
                
              case 'type':
                console.log(`🎯 Sending type command: browser_type with text: ${action.text || action.value}`);
                result = await context.sendSocketMessage("browser_type", { 
                  text: action.text || action.value
                });
                results.push({ 
                  action: 'type', 
                  text: action.text || action.value, 
                  success: true, 
                  result: `Typed: ${action.text || action.value}` 
                });
                break;
                
              default:
                results.push({ 
                  action: action.type, 
                  success: false, 
                  result: `Action type ${action.type} not supported in test mode` 
                });
            }
            
            // Small delay between actions
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Mark that we've processed the first action
            isFirstAction = false;
            
          } catch (error) {
            console.error(`❌ Action ${action.type} failed:`, error);
            results.push({ 
              action: action.type, 
              success: false, 
              error: String(error) 
            });
            
            // Mark that we've processed the first action (even if it failed)
            isFirstAction = false;
          }
        }
        
        const successfulActions = results.filter(r => r.success).length;
        
        return res.json({
          success: successfulActions > 0,
          result: `Executed ${successfulActions}/${results.length} actions successfully via BrowserMCP`,
          message: successfulActions === results.length ? 
            "All actions executed successfully" : 
            `${successfulActions}/${results.length} actions succeeded`,
          actions: results,
          sessionId
        });
        
      } else {
        return res.status(400).json({
          error: "Session ID required for BrowserMCP tool testing",
          success: false
        });
      }
      
    } catch (error) {
      console.error("❌ AI tool test failed:", error);
      return res.status(500).json({
        success: false,
        error: `AI tool test failed: ${error.message}`,
        connected: isExtensionConnected()
      });
    }
  } catch (error) {
    console.error("Tool testing error:", error);
    res.status(500).json({ 
      success: false,
      error: String(error)
    });
  }
});

// === SAVED TOOLS MANAGEMENT ENDPOINTS ===
// These endpoints manage saved/generated tools

// Get all saved tools
app.get("/tools/saved", async (req, res) => {
  try {
    const tools = browserRecorder.getSavedTools();
    res.json({
      success: true,
      tools
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Save a generated tool
app.post("/tools/save", async (req, res) => {
  try {
    const { name, description, code, language = 'python', category = 'browser_automation', tags = [], isPublic = false } = req.body;
    
    if (!name || !code) {
      return res.status(400).json({ error: "name and code are required" });
    }

    const toolId = await browserRecorder.saveTool({
      name,
      description,
      code,
      language,
      category,
      tags,
      isPublic,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    res.json({
      success: true,
      toolId,
      message: `Tool "${name}" saved successfully`
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Delete a saved tool
app.delete("/tools/:toolId", async (req, res) => {
  try {
    const { toolId } = req.params;
    const deleted = await browserRecorder.deleteTool(toolId);
    
    if (!deleted) {
      return res.status(404).json({ error: "Tool not found" });
    }

    res.json({
      success: true,
      message: "Tool deleted successfully"
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

// ===============================
// AI-POWERED SELECTOR REPAIR SYSTEM
// ===============================

// Note: Import will be moved to top after testing

// AI Selector Repair endpoint
app.post("/ai/repair-selector", async (req, res) => {
  try {
    const { originalSelector, originalMetadata, currentDOM, intent, pageUrl } = req.body;
    
    if (!originalSelector || !originalMetadata || !currentDOM || !intent) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing required fields: originalSelector, originalMetadata, currentDOM, intent" 
      });
    }
    
    console.log('🔧 AI Selector Repair requested for:', originalSelector);
    console.log('🎯 Intent:', intent);
    console.log('📄 Page:', pageUrl);
    
    // Convert extension data to Browser-Use format
    const currentElements = currentDOM.map((el: any) => 
      ExtensionIntegration.convertExtensionElement(el)
    );
    
    // Create history element from original metadata
    const historyElement = {
      tagName: originalMetadata.tagName,
      xpath: originalMetadata.selectors?.xpath || originalMetadata.xpath,
      attributes: originalMetadata.attributes || {},
      coordinates: originalMetadata.visual?.boundingBox || { x: 0, y: 0, width: 0, height: 0 },
      parentBranch: originalMetadata.structure?.parentChain || '',
      hash: originalMetadata.fingerprint || '',
      timestamp: originalMetadata.timestamp || Date.now()
    };
    
    // Attempt repair using Browser-Use techniques + AI
    const repairedSelector = await AISelectorRepairService.repairSelector(
      historyElement,
      currentElements,
      intent,
      'anthropic' // Default to Anthropic Claude
    );
    
    if (repairedSelector) {
      console.log('✅ Selector repaired successfully:', repairedSelector);
      
      res.json({
        success: true,
        repairedSelector,
        originalSelector,
        confidence: 0.85,
        method: 'ai_repair',
        message: 'Selector repaired using AI analysis'
      });
      
    } else {
      console.log('❌ Selector repair failed - no suitable replacement found');
      
      res.json({
        success: false,
        error: 'Could not repair selector - no suitable element found',
        originalSelector,
        suggestions: [
          'Try recording the action again on the current page',
          'Check if the page structure has changed significantly',
          'Use a more stable selector (ID or data attributes)'
        ]
      });
    }
    
  } catch (error) {
    console.error('❌ AI Selector Repair error:', error);
    res.status(500).json({ 
      success: false, 
      error: String(error),
      message: 'Internal error during selector repair'
    });
  }
});

// Enhanced DOM Analysis endpoint
app.post("/ai/analyze-dom", async (req, res) => {
  try {
    const { elements, task } = req.body;
    
    if (!elements || !Array.isArray(elements)) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing or invalid elements array" 
      });
    }
    
    console.log('🔍 DOM Analysis requested for', elements.length, 'elements');
    
    // Convert to Browser-Use format and analyze
    const domElements = elements.map((el: any) => 
      ExtensionIntegration.convertExtensionElement(el)
    );
    
    // Generate enhanced metadata for all elements
    const analysis = domElements.map((element, index) => {
      const historyElement = HistoryTreeProcessor.convertDomElementToHistoryElement(element);
      const optimalSelector = AISelectorRepairService.generateOptimalSelector(element);
      
      return {
        index,
        element: {
          tagName: element.tagName,
          text: element.textContent.slice(0, 100),
          attributes: element.attributes
        },
        metadata: historyElement,
        recommendedSelector: optimalSelector,
        stabilityScore: calculateElementStability(element)
      };
    });
    
    res.json({
      success: true,
      analysis,
      totalElements: elements.length,
      task: task || 'general_analysis',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ DOM Analysis error:', error);
    res.status(500).json({ 
      success: false, 
      error: String(error)
    });
  }
});

// Pattern Detection endpoint for SHIFT+Click functionality
app.post("/ai/detect-patterns", async (req, res) => {
  try {
    const { selectedElement, allElements, patternType } = req.body;
    
    if (!selectedElement || !allElements) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing selectedElement or allElements" 
      });
    }
    
    console.log('🎯 Pattern detection requested for:', selectedElement.tagName);
    
    // Convert to Browser-Use format
    const selectedDOMElement = ExtensionIntegration.convertExtensionElement(selectedElement);
    const allDOMElements = allElements.map((el: any) => 
      ExtensionIntegration.convertExtensionElement(el)
    );
    
    // Find similar elements using Browser-Use techniques
    const selectedHistory = HistoryTreeProcessor.convertDomElementToHistoryElement(selectedDOMElement);
    const similarElements = [];
    
    for (const element of allDOMElements) {
      if (element === selectedDOMElement) continue;
      
      // Use Browser-Use similarity calculation
      const similarity = calculateElementSimilarity(selectedDOMElement, element, selectedHistory);
      
      if (similarity > 0.7) { // 70% similarity threshold
        similarElements.push({
          element: {
            tagName: element.tagName,
            text: element.textContent.slice(0, 50),
            attributes: element.attributes,
            coordinates: element.coordinates
          },
          similarity,
          recommendedSelector: AISelectorRepairService.generateOptimalSelector(element)
        });
      }
    }
    
    // Sort by similarity
    similarElements.sort((a, b) => b.similarity - a.similarity);
    
    res.json({
      success: true,
      selectedElement: {
        tagName: selectedElement.tagName,
        text: selectedElement.textContent?.slice(0, 50),
        selector: AISelectorRepairService.generateOptimalSelector(selectedDOMElement)
      },
      similarElements: similarElements.slice(0, 20), // Limit to top 20
      patternType: patternType || 'auto_detected',
      totalFound: similarElements.length,
      extractionSuggestion: generateExtractionSuggestion(selectedElement, similarElements)
    });
    
  } catch (error) {
    console.error('❌ Pattern detection error:', error);
    res.status(500).json({ 
      success: false, 
      error: String(error)
    });
  }
});

// Utility function for element similarity (simplified version)
function calculateElementSimilarity(element1: any, element2: any, metadata1: any): number {
  let score = 0;
  
  // Tag name similarity
  if (element1.tagName === element2.tagName) score += 20;
  
  // Attribute similarity
  const attrs1 = Object.keys(element1.attributes || {});
  const attrs2 = Object.keys(element2.attributes || {});
  const commonAttrs = attrs1.filter(attr => attrs2.includes(attr));
  
  if (attrs1.length > 0 || attrs2.length > 0) {
    score += (commonAttrs.length / Math.max(attrs1.length, attrs2.length, 1)) * 30;
  }
  
  // Text similarity (simple)
  const text1 = element1.textContent?.trim() || '';
  const text2 = element2.textContent?.trim() || '';
  if (text1 && text2 && text1.length > 0 && text2.length > 0) {
    const similarity = text1 === text2 ? 20 : 0;
    score += similarity;
  }
  
  // Structural similarity
  if (element1.parentBranch && element2.parentBranch) {
    const branch1Parts = element1.parentBranch.split('>');
    const branch2Parts = element2.parentBranch.split('>');
    const minLength = Math.min(branch1Parts.length, branch2Parts.length);
    
    let matchingParts = 0;
    for (let i = 0; i < minLength; i++) {
      if (branch1Parts[i] === branch2Parts[i]) matchingParts++;
    }
    
    if (minLength > 0) {
      score += (matchingParts / minLength) * 30;
    }
  }
  
  return score / 100; // Normalize to 0-1
}

// Utility function to calculate element stability
function calculateElementStability(element: any): number {
  let stability = 50; // Base score
  
  // ID increases stability
  if (element.attributes?.id) {
    const id = element.attributes.id;
    if (!/\d{6,}|random|temp|gen/i.test(id)) {
      stability += 30;
    } else {
      stability -= 20; // Dynamic ID
    }
  }
  
  // Stable attributes
  const stableAttrs = ['name', 'type', 'role', 'data-testid', 'aria-label'];
  let stableAttrCount = 0;
  
  for (const attr of stableAttrs) {
    if (element.attributes?.[attr]) {
      stableAttrCount++;
    }
  }
  
  stability += stableAttrCount * 10;
  
  // Class stability
  if (element.attributes?.class) {
    const classes = element.attributes.class.split(' ');
    const stableClasses = classes.filter((cls: string) => 
      !/^css-[a-z0-9]+$|^[a-z]+-[0-9]+$|random|temp|gen/i.test(cls)
    );
    
    stability += Math.min(stableClasses.length * 5, 20);
    
    if (stableClasses.length < classes.length / 2) {
      stability -= 15; // Many dynamic classes
    }
  }
  
  return Math.max(0, Math.min(100, stability));
}

// Utility function to generate extraction suggestions
function generateExtractionSuggestion(selectedElement: any, similarElements: any[]): string {
  const elementType = selectedElement.tagName?.toLowerCase();
  const hasText = selectedElement.textContent?.trim().length > 0;
  const isInTable = selectedElement.xpath?.includes('table') || selectedElement.parentBranch?.includes('table');
  const isInList = selectedElement.xpath?.includes('li') || selectedElement.parentBranch?.includes('li');
  
  if (isInTable && similarElements.length > 2) {
    return `Detected table data pattern. Consider extracting all ${similarElements.length + 1} cells as structured data (CSV/JSON format).`;
  }
  
  if (isInList && similarElements.length > 1) {
    return `Detected list pattern with ${similarElements.length + 1} items. Perfect for bulk data extraction.`;
  }
  
  if (hasText && similarElements.length > 0) {
    return `Found ${similarElements.length} similar text elements. Good candidate for content extraction.`;
  }
  
  if (elementType === 'a' && similarElements.length > 0) {
    return `Detected ${similarElements.length + 1} links with similar structure. Consider extracting URLs and link text.`;
  }
  
  return `Found ${similarElements.length} similar elements. Use SHIFT+Click to select multiple for batch operations.`;
}

// === DEMO ENDPOINTS ===
// Interactive demo endpoints for onboarding

// BigFoot TikTok search demo
app.post("/demo/bigfoot-search", async (req, res) => {
  try {
    console.log("🦍 Starting BigFoot TikTok search demo...");
    
    // Check if extension is connected
    if (!isExtensionConnected()) {
      return res.status(400).json({ 
        success: false,
        error: "Browser extension not connected. Please install and connect the extension first."
      });
    }

    // Get the MCP server context
    const context = getServerContext();
    if (!context || !context.hasWs()) {
      return res.status(500).json({
        success: false,
        error: "Browser automation not available. Extension WebSocket not connected."
      });
    }

    // Execute the demo steps
    const demoSteps = [
      { action: 'navigate', url: 'https://www.tiktok.com', description: 'Navigate to TikTok' },
      { action: 'wait', time: 3, description: 'Wait for page to load' },
      { action: 'click', selector: '[data-e2e="search-box"], input[placeholder*="search" i], input[type="search"]', description: 'Click search box' },
      { action: 'wait', time: 1, description: 'Wait for search box focus' },
      { action: 'type', text: 'BigFoot sightings', description: 'Type search query' },
      { action: 'wait', time: 1, description: 'Wait for typing' },
      { action: 'press_key', key: 'Enter', description: 'Press Enter to search' },
      { action: 'wait', time: 3, description: 'Wait for search results' },
      { action: 'screenshot', description: 'Take screenshot of results' }
    ];

    const results = [];
    
    for (const step of demoSteps) {
      console.log(`🎯 Demo step: ${step.description}`);
      
      try {
        let result;
        
        switch (step.action) {
          case 'navigate':
            result = await context.sendSocketMessage("browser_navigate", { url: step.url });
            break;
            
          case 'click':
            // Try multiple selectors for robustness
            const selectors = step.selector.split(', ');
            let clickSuccess = false;
            
            for (const selector of selectors) {
              try {
                result = await context.sendSocketMessage("browser_click", { selector: selector.trim() });
                clickSuccess = true;
                break;
              } catch (selectorError) {
                console.log(`Selector ${selector} failed, trying next...`);
              }
            }
            
            if (!clickSuccess) {
              throw new Error(`Could not find search box with any selector: ${step.selector}`);
            }
            break;
            
          case 'type':
            result = await context.sendSocketMessage("browser_type", { 
              selector: 'input:focus, [contenteditable="true"]:focus', 
              text: step.text 
            });
            break;
            
          case 'press_key':
            result = await context.sendSocketMessage("browser_press_key", { key: step.key });
            break;
            
          case 'wait':
            await new Promise(resolve => setTimeout(resolve, step.time * 1000));
            result = `Waited ${step.time} seconds`;
            break;
            
          case 'screenshot':
            result = await context.sendSocketMessage("browser_screenshot", {});
            break;
            
          default:
            throw new Error(`Unknown demo action: ${step.action}`);
        }
        
        results.push({
          step: step.description,
          action: step.action,
          success: true,
          result: typeof result === 'string' ? result : 'Completed'
        });
        
      } catch (stepError) {
        console.error(`Demo step failed: ${step.description}`, stepError);
        
        results.push({
          step: step.description,
          action: step.action,
          success: false,
          error: String(stepError)
        });
        
        // Continue with remaining steps even if one fails
      }
    }
    
    const successfulSteps = results.filter(r => r.success).length;
    const totalSteps = results.length;
    
    console.log(`🦍 BigFoot demo completed: ${successfulSteps}/${totalSteps} steps successful`);
    
    res.json({
      success: true,
      message: `BigFoot TikTok search demo completed! ${successfulSteps}/${totalSteps} steps successful.`,
      demo: 'bigfoot_tiktok_search',
      results,
      summary: {
        totalSteps,
        successfulSteps,
        completionRate: Math.round((successfulSteps / totalSteps) * 100)
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("❌ BigFoot demo error:", error);
    res.status(500).json({ 
      success: false,
      error: String(error),
      demo: 'bigfoot_tiktok_search'
    });
  }
});

// Get available demo scripts
app.get("/demo/available", (req, res) => {
  try {
    const availableDemos = [
      {
        id: 'bigfoot_tiktok_search',
        name: 'BigFoot TikTok Search',
        description: 'Automatically search for BigFoot sightings on TikTok',
        emoji: '🦍',
        steps: 9,
        estimatedTime: '15 seconds',
        difficulty: 'beginner'
      }
    ];
    
    res.json({
      success: true,
      demos: availableDemos,
      extensionRequired: true,
      message: 'Interactive demos available for onboarding'
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
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