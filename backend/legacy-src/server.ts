import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { Context } from "./context.js";
import type { Resource } from "./resources/resource.js";
import type { Tool } from "./tools/tool.js";
import { createWebSocketServer } from "./ws.js";
import { browserRecorder } from "./recorder.js";
import { agentRegistry } from "./agent-registry.js";
import { customToolManager } from "./custom-tool-manager.js";
import { localToolManager } from "./local-tool-manager.js";

type Options = {
  name: string;
  version: string;
  tools: Tool[];
  resources: Resource[];
};

export async function createServerWithTools(options: Options): Promise<Server> {
  const { name, version, tools, resources } = options;
  const context = new Context();
  const server = new Server(
    { name, version },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    },
  );

  const wss = await createWebSocketServer();
  wss.on("connection", (websocket) => {
    console.log("🔗 WebSocket connection established");
    // Close any existing connections  
    if (context.hasWs()) {
      console.log("🔄 Closing existing WebSocket connection");
      context.ws.close();
    }
    context.ws = websocket;
    console.log("✅ WebSocket context updated, hasWs():", context.hasWs());
    
    // Handle incoming messages from browser extension
    websocket.on('message', (data) => {
      try {
        console.log("📨 Raw WebSocket data:", data.toString().substring(0, 500));
        const message = JSON.parse(data.toString());
        console.log("📨 Parsed message method:", message?.method);
        console.log("📨 Parsed message keys:", Object.keys(message || {}));
        
        // Handle CDP events for recording
        if (message.method === 'forwardCDPEvent') {
          console.log("🎬 Found CDP event to forward");
          handleCDPEventForRecording(message.params);
        }
        
        // Send acknowledgment back to extension if it has an ID
        if (message.id) {
          websocket.send(JSON.stringify({
            id: message.id,
            result: { success: true }
          }));
        }
      } catch (error) {
        console.error("❌ Error processing WebSocket message:", error);
        console.error("❌ Raw data was:", data.toString().substring(0, 200));
      }
    });
    
    websocket.on('close', () => {
      console.log("❌ WebSocket connection closed");
    });
    
    websocket.on('error', (error) => {
      console.log("❌ WebSocket error:", error);
    });
  });

  // Handle CDP events for recording
  function handleCDPEventForRecording(params: any) {
    if (!params) return;
    
    const { sessionId, recordingSessionId, method, params: cdpParams } = params;
    console.log("🎬 Processing CDP event for recording:", method, "session:", recordingSessionId);
    
    // Only forward events when we have a recording session
    if (recordingSessionId) {
      // Convert CDP event to action format (same logic as API)
      const action = convertCDPEventToAction(method, cdpParams);
      if (action) {
        // Call browserRecorder directly instead of HTTP fetch
        browserRecorder.recordActionFromCDP(recordingSessionId, action);
        console.log("✅ Forwarded CDP event to recorder:", action.description);
      }
    }
  }

  // Helper function to convert CDP events to our action format
  function convertCDPEventToAction(method: string, params: any) {
    switch (method) {
      case 'Page.frameNavigated':
        if (params.frame?.url && !params.frame.url.startsWith('chrome-extension://')) {
          return {
            type: 'navigate',
            url: params.frame.url,
            description: `Navigate to ${params.frame.url}`
          };
        }
        break;
      
      case 'Input.dispatchMouseEvent':
        if (params.type === 'mousePressed' && params.button === 'left') {
          return {
            type: 'click',
            x: params.x,
            y: params.y,
            description: `Click at (${params.x}, ${params.y})`
          };
        }
        break;
      
      case 'Input.dispatchKeyEvent':
        if (params.type === 'keyDown' && params.text) {
          return {
            type: 'type',
            text: params.text,
            description: `Type "${params.text}"`
          };
        }
        break;
    }
    
    return null;
  }

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    // Get base tools
    const baseToolSchemas = tools.map((tool) => tool.schema);
    
    // Get registered agent tools
    const registeredAgents = agentRegistry.getAllAgents();
    const agentToolSchemas = registeredAgents.map(agent => {
      const agentTool = agentRegistry.generateMCPTool(agent.id);
      return agentTool.schema;
    });
    
    // Get custom tools
    const customTools = customToolManager.getReadyTools();
    const customToolSchemas = customTools.map(tool => {
      const customTool = customToolManager.generateMCPTool(tool.id);
      return customTool.schema;
    });
    
    // Get local tools
    const localTools = localToolManager.getAllTools();
    const localToolSchemas = localTools.map(tool => {
      const localTool = localToolManager.generateMCPTool(tool.id);
      return localTool.schema;
    });
    
    console.log(`📋 Listing tools: ${baseToolSchemas.length} base tools + ${agentToolSchemas.length} agent tools + ${customToolSchemas.length} custom tools + ${localToolSchemas.length} local tools`);
    
    return { 
      tools: [...baseToolSchemas, ...agentToolSchemas, ...customToolSchemas, ...localToolSchemas]
    };
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return { resources: resources.map((resource) => resource.schema) };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    
    // First, check if it's a base tool
    const baseTool = tools.find((tool) => tool.schema.name === toolName);
    if (baseTool) {
      try {
        const result = await baseTool.handle(context, request.params.arguments);
        return result;
      } catch (error) {
        return {
          content: [{ type: "text", text: String(error) }],
          isError: true,
        };
      }
    }
    
    // Check if it's a registered agent tool
    const registeredAgents = agentRegistry.getAllAgents();
    for (const agent of registeredAgents) {
      const agentTool = agentRegistry.generateMCPTool(agent.id);
      if (agentTool.schema.name === toolName) {
        try {
          console.log(`🤖 Executing registered agent: ${agent.name}`);
          const result = await agentTool.handle(context, request.params.arguments);
          return result;
        } catch (error) {
          console.error(`❌ Agent execution error for ${agent.name}:`, error);
          return {
            content: [{ type: "text", text: `Agent execution failed: ${String(error)}` }],
            isError: true,
          };
        }
      }
    }
    
    // Check if it's a custom tool
    const customTools = customToolManager.getReadyTools();
    for (const tool of customTools) {
      const customTool = customToolManager.generateMCPTool(tool.id);
      if (customTool.schema.name === toolName) {
        try {
          console.log(`🔧 Executing custom tool: ${tool.name}`);
          const result = await customTool.handle(context, request.params.arguments);
          return result;
        } catch (error) {
          console.error(`❌ Custom tool execution error for ${tool.name}:`, error);
          return {
            content: [{ type: "text", text: `Custom tool execution failed: ${String(error)}` }],
            isError: true,
          };
        }
      }
    }
    
    // Check if it's a local tool
    const localTools = localToolManager.getAllTools();
    for (const tool of localTools) {
      const localTool = localToolManager.generateMCPTool(tool.id);
      if (localTool.schema.name === toolName) {
        try {
          console.log(`📁 Executing local tool: ${tool.name}`);
          const result = await localTool.handle(context, request.params.arguments);
          return result;
        } catch (error) {
          console.error(`❌ Local tool execution error for ${tool.name}:`, error);
          return {
            content: [{ type: "text", text: `Local tool execution failed: ${String(error)}` }],
            isError: true,
          };
        }
      }
    }
    
    // Tool not found
    return {
      content: [
        { type: "text", text: `Tool "${toolName}" not found` },
      ],
      isError: true,
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const resource = resources.find(
      (resource) => resource.schema.uri === request.params.uri,
    );
    if (!resource) {
      return { contents: [] };
    }

    const contents = await resource.read(context, request.params.uri);
    return { contents };
  });

  server.close = async () => {
    await server.close();
    await wss.close();
    await context.close();
  };

  // Attach context to server for API access
  (server as any).context = context;

  return server;
}
