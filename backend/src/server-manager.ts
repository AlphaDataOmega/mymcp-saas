/**
 * Marketplace Server Manager
 * Handles installation, lifecycle, and management of MCP servers from the marketplace
 */

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { setupManager } from './setup-manager.js';
import { agentRegistry } from './agent-registry.js';

interface InstalledServer {
  id: string;
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  port?: number;
  status: 'stopped' | 'starting' | 'running' | 'error';
  process?: ChildProcess;
  lastError?: string;
  installedAt: Date;
  tools: string[];
  disabledTools?: string[];  // Tools that are disabled by user
}

interface ServerInstallConfig {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  tools: string[];
  port?: number;
}

export class ServerManager {
  private servers: Map<string, InstalledServer> = new Map();
  private serversFilePath: string;

  constructor() {
    this.serversFilePath = path.join(process.cwd(), 'data', 'installed_servers.json');
    this.ensureDataDirectory();
    this.loadServers();
  }

  private async ensureDataDirectory() {
    const dataDir = path.dirname(this.serversFilePath);
    try {
      await fs.mkdir(dataDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create data directory:', error);
    }
  }

  private async loadServers() {
    try {
      const data = await fs.readFile(this.serversFilePath, 'utf-8');
      const serversData = JSON.parse(data);
      
      for (const serverData of serversData) {
        serverData.installedAt = new Date(serverData.installedAt);
        serverData.status = 'stopped'; // Reset status on load
        this.servers.set(serverData.id, serverData);
      }
      
      console.log(`📦 Loaded ${this.servers.size} installed servers`);
    } catch (error) {
      console.log('📦 No existing servers found, starting with empty registry');
    }
  }

  private async saveServers() {
    try {
      const serversArray = Array.from(this.servers.values()).map(server => ({
        ...server,
        process: undefined // Don't serialize process objects
      }));
      await fs.writeFile(this.serversFilePath, JSON.stringify(serversArray, null, 2));
    } catch (error) {
      console.error('Failed to save servers:', error);
      throw error;
    }
  }

  async installServer(config: ServerInstallConfig): Promise<string> {
    // Generate unique ID
    const id = `server_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Check if server with same name already exists
    for (const server of this.servers.values()) {
      if (server.name === config.name) {
        throw new Error(`Server with name "${config.name}" already installed`);
      }
    }

    const server: InstalledServer = {
      id,
      name: config.name,
      command: config.command,
      args: config.args,
      env: config.env,
      port: config.port,
      status: 'stopped',
      installedAt: new Date(),
      tools: config.tools,
      disabledTools: []  // Start with all tools enabled
    };

    this.servers.set(id, server);
    await this.saveServers();

    // Register server as an agent that exposes individual tools
    try {
      const enabledTools = this.getEnabledTools(server);
      const agentCode = this.generateServerAgentCode(server);
      const agentId = await agentRegistry.registerAgent({
        name: `${config.name} Server`,
        description: `MCP server wrapper for ${config.name} with ${enabledTools.length} tools: ${enabledTools.join(', ')}`,
        code: agentCode,
        tools: enabledTools,
        metadata: {
          type: 'mcp_server_wrapper',
          server_id: id,
          server_name: config.name,
          created_at: new Date().toISOString(),
          installed_from: 'marketplace'
        }
      });

      console.log(`📦 Installed server: ${server.name} (ID: ${id})`);
      console.log(`🤖 Registered as agent: ${config.name} Server (ID: ${agentId})`);
      
      return id;
    } catch (error) {
      console.error(`Failed to register server as agent:`, error);
      // Continue with server installation even if agent registration fails
      console.log(`📦 Installed server: ${server.name} (ID: ${id}) - without agent registration`);
      return id;
    }
  }

  async startServer(id: string): Promise<boolean> {
    const server = this.servers.get(id);
    if (!server) {
      throw new Error(`Server with ID "${id}" not found`);
    }

    if (server.status === 'running') {
      return true; // Already running
    }

    try {
      server.status = 'starting';
      
      console.log(`🚀 Starting server: ${server.name}`);
      console.log(`Command: ${server.command} ${server.args.join(' ')}`);

      const childProcess = spawn(server.command, server.args, {
        env: { ...process.env, ...server.env },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      childProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        console.log(`[${server.name}] ${output.trim()}`);
      });

      childProcess.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        console.error(`[${server.name}] ${output.trim()}`);
      });

      childProcess.on('close', (code) => {
        console.log(`[${server.name}] Process exited with code ${code}`);
        if (server.status === 'running') {
          server.status = code === 0 ? 'stopped' : 'error';
          server.lastError = code !== 0 ? `Process exited with code ${code}` : undefined;
        }
        server.process = undefined;
      });

      process.on('error', (error) => {
        console.error(`[${server.name}] Process error:`, error);
        server.status = 'error';
        server.lastError = error.message;
        server.process = undefined;
      });

      server.process = childProcess;
      
      // Wait a bit to see if the process starts successfully
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (server.process && !server.process.killed) {
        server.status = 'running';
        console.log(`✅ Server ${server.name} started successfully`);
        return true;
      } else {
        server.status = 'error';
        server.lastError = 'Process failed to start or crashed immediately';
        console.error(`❌ Server ${server.name} failed to start`);
        return false;
      }

    } catch (error) {
      server.status = 'error';
      server.lastError = String(error);
      console.error(`❌ Error starting server ${server.name}:`, error);
      return false;
    }
  }

  async stopServer(id: string): Promise<boolean> {
    const server = this.servers.get(id);
    if (!server) {
      throw new Error(`Server with ID "${id}" not found`);
    }

    if (server.status === 'stopped') {
      return true; // Already stopped
    }

    try {
      if (server.process) {
        console.log(`🛑 Stopping server: ${server.name}`);
        server.process.kill('SIGTERM');
        
        // Wait for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        if (server.process && !server.process.killed) {
          console.log(`🔪 Force killing server: ${server.name}`);
          server.process.kill('SIGKILL');
        }
      }

      server.status = 'stopped';
      server.process = undefined;
      console.log(`✅ Server ${server.name} stopped`);
      return true;

    } catch (error) {
      console.error(`❌ Error stopping server ${server.name}:`, error);
      return false;
    }
  }

  async uninstallServer(id: string): Promise<boolean> {
    const server = this.servers.get(id);
    if (!server) {
      return false;
    }

    // Stop the server first
    if (server.status === 'running') {
      await this.stopServer(id);
    }

    this.servers.delete(id);
    await this.saveServers();

    console.log(`🗑️ Uninstalled server: ${server.name} (ID: ${id})`);
    return true;
  }

  getServer(id: string): InstalledServer | undefined {
    return this.servers.get(id);
  }

  getAllServers(): InstalledServer[] {
    return Array.from(this.servers.values());
  }

  getRunningServers(): InstalledServer[] {
    return this.getAllServers().filter(server => server.status === 'running');
  }

  // Get tools from all running servers for the federated MCP system
  getAvailableTools(): Array<{serverId: string, serverName: string, tools: string[]}> {
    return this.getRunningServers().map(server => ({
      serverId: server.id,
      serverName: server.name,
      tools: server.tools
    }));
  }

  // Predefined server configurations for popular marketplace servers
  getServerConfig(serverName: string): ServerInstallConfig | null {
    const configs: Record<string, ServerInstallConfig> = {
      'github': {
        name: 'GitHub MCP Server',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env: {
          'GITHUB_PERSONAL_ACCESS_TOKEN': process.env.GITHUB_PERSONAL_ACCESS_TOKEN || 'required'
        },
        tools: ['get_repositories', 'create_repository', 'get_issues', 'create_issue']
      },
      'slack': {
        name: 'Slack MCP Server',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-slack'],
        env: {
          'SLACK_BOT_TOKEN': process.env.SLACK_BOT_TOKEN || 'required'
        },
        tools: ['send_message', 'get_channels', 'get_users']
      },
      'postgres': {
        name: 'PostgreSQL MCP Server',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-postgres'],
        env: {
          'POSTGRES_CONNECTION_STRING': process.env.POSTGRES_CONNECTION_STRING || 'required'
        },
        tools: ['execute_query', 'get_schema', 'list_tables']
      },
      'brave-search': {
        name: 'Brave Search MCP',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-brave-search'],
        env: {
          'BRAVE_API_KEY': process.env.BRAVE_API_KEY || 'required'
        },
        tools: ['web_search', 'search_results']
      }
    };

    return configs[serverName.toLowerCase()] || null;
  }

  // Get server config with setup integration (async version)
  async getServerConfigWithSetup(serverName: string): Promise<ServerInstallConfig | null> {
    const baseConfigs: Record<string, Omit<ServerInstallConfig, 'env'>> = {
      'github': {
        name: 'GitHub MCP Server',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        tools: ['get_repositories', 'create_repository', 'get_issues', 'create_issue']
      },
      'slack': {
        name: 'Slack MCP Server',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-slack'],
        tools: ['send_message', 'get_channels', 'get_users']
      },
      'postgres': {
        name: 'PostgreSQL MCP Server',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-postgres'],
        tools: ['execute_query', 'get_schema', 'list_tables']
      },
      'brave-search': {
        name: 'Brave Search MCP',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-brave-search'],
        tools: ['web_search', 'search_results']
      }
    };

    const baseConfig = baseConfigs[serverName.toLowerCase()];
    if (!baseConfig) {
      return null;
    }

    // Get environment variables from setup system
    let env: Record<string, string> = {};
    
    try {
      const setupInfo = setupManager.getSetupRequirements(serverName);
      if (setupInfo?.requirements) {
        for (const req of setupInfo.requirements) {
          if (req.type === 'env') {
            // Try to get from setup system first, fallback to process.env
            const setupValue = await setupManager.getCredential(serverName, req.key);
            env[req.key] = setupValue || process.env[req.key] || 'required';
          }
        }
      } else {
        // Fallback to legacy environment variable mapping
        const envMappings: Record<string, string> = {
          'github': 'GITHUB_PERSONAL_ACCESS_TOKEN',
          'slack': 'SLACK_BOT_TOKEN',
          'postgres': 'POSTGRES_CONNECTION_STRING',
          'brave-search': 'BRAVE_API_KEY'
        };
        
        const envKey = envMappings[serverName.toLowerCase()];
        if (envKey) {
          const setupValue = await setupManager.getCredential(serverName, envKey);
          env[envKey] = setupValue || process.env[envKey] || 'required';
        }
      }
    } catch (error) {
      console.warn(`Failed to get setup credentials for ${serverName}, using fallback:`, error);
      // Fallback to process.env
      return this.getServerConfig(serverName);
    }

    return {
      ...baseConfig,
      env
    };
  }

  // Get enabled tools for a server (all tools minus disabled ones)
  private getEnabledTools(server: InstalledServer): string[] {
    const disabledTools = server.disabledTools || [];
    return server.tools.filter(tool => !disabledTools.includes(tool));
  }

  // Update tool enabled/disabled status
  async updateToolStatus(serverId: string, toolName: string, enabled: boolean): Promise<boolean> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server with ID "${serverId}" not found`);
    }

    // Initialize disabledTools if not present (for legacy servers)
    if (!server.disabledTools) {
      server.disabledTools = [];
    }

    if (enabled) {
      // Remove from disabled list
      server.disabledTools = server.disabledTools.filter(tool => tool !== toolName);
    } else {
      // Add to disabled list if not already there
      if (!server.disabledTools.includes(toolName)) {
        server.disabledTools.push(toolName);
      }
    }

    await this.saveServers();

    // Re-register the agent with updated tools
    await this.reregisterServerAgent(serverId);

    console.log(`🔧 Updated tool ${toolName} for ${server.name}: ${enabled ? 'enabled' : 'disabled'}`);
    return true;
  }

  // Re-register server agent with current tool configuration
  private async reregisterServerAgent(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) return;

    try {
      // Find and remove existing agent
      const existingAgents = agentRegistry.getAllAgents();
      const existingAgent = existingAgents.find(agent => 
        agent.metadata?.server_id === serverId
      );

      if (existingAgent) {
        await agentRegistry.unregisterAgent(existingAgent.id);
      }

      // Register new agent with current tool configuration
      const enabledTools = this.getEnabledTools(server);
      const agentCode = this.generateServerAgentCode(server);
      const agentId = await agentRegistry.registerAgent({
        name: `${server.name} Server`,
        description: `MCP server wrapper for ${server.name} with ${enabledTools.length} tools: ${enabledTools.join(', ')}`,
        code: agentCode,
        tools: enabledTools,
        metadata: {
          type: 'mcp_server_wrapper',
          server_id: serverId,
          server_name: server.name,
          created_at: new Date().toISOString(),
          installed_from: 'marketplace'
        }
      });

      console.log(`🔄 Re-registered agent for ${server.name} (ID: ${agentId})`);
    } catch (error) {
      console.error(`Failed to re-register agent for server ${serverId}:`, error);
    }
  }

  // Generate agent code that wraps the MCP server
  private generateServerAgentCode(server: InstalledServer): string {
    const enabledTools = this.getEnabledTools(server);
    const toolFunctions = enabledTools.map(toolName => `
@server_agent.tool
async def ${toolName.replace('-', '_')}(**kwargs) -> str:
    """${toolName} tool from ${server.name}"""
    try:
        # This would call the actual MCP server tool
        # For now, return a placeholder indicating the server needs to be started
        import requests
        
        # Check if server is running
        server_status = await check_server_status("${server.id}")
        if not server_status.get("running"):
            return f"❌ ${server.name} server is not running. Please start the server first."
        
        # Call the actual server tool (this would be implemented with proper MCP client)
        return f"✅ Called ${toolName} on ${server.name} server (ID: ${server.id})"
        
    except Exception as e:
        return f"❌ Error calling ${toolName}: {str(e)}"
`).join('\n');

    return `"""
${server.name} Agent Wrapper
Auto-generated agent that wraps the ${server.name} MCP server.
Provides individual tools: ${enabledTools.join(', ')}

Server ID: ${server.id}
Installed: ${server.installedAt}
Enabled Tools: ${enabledTools.length}/${server.tools.length}
"""

import asyncio
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIModel

# Initialize the server agent
server_agent = Agent(
    model=OpenAIModel("gpt-4o-mini"),
    system_prompt="""You are a ${server.name} server agent that provides access to ${enabledTools.length} tools.
    You manage the lifecycle and tool execution for the ${server.name} MCP server.
    
    Available tools: ${enabledTools.join(', ')}
    """
)

async def check_server_status(server_id: str) -> dict:
    """Check if the MCP server is running"""
    try:
        import requests
        response = requests.get(f"http://localhost:8100/servers/{server_id}/status", timeout=5)
        if response.status_code == 200:
            return response.json()
        return {"running": False, "error": f"HTTP {response.status_code}"}
    except Exception as e:
        return {"running": False, "error": str(e)}

${toolFunctions}

# Main execution function for MCP integration
async def run_agent(params: dict = None):
    """Main function to run the ${server.name} server agent"""
    try:
        # Extract the tool name from params if provided
        tool_name = params.get('tool_name') if params else None
        
        if tool_name and hasattr(globals(), tool_name.replace('-', '_')):
            # Call the specific tool function
            tool_func = globals()[tool_name.replace('-', '_')]
            result = await tool_func(**(params.get('tool_params', {})))
        else:
            # General server interaction
            result = await server_agent.run(f"Interact with ${server.name} server. Available tools: ${server.tools.join(', ')}")
            result = result.data
            
        return {
            "success": True,
            "result": result,
            "type": "mcp_server_wrapper",
            "server_id": "${server.id}",
            "server_name": "${server.name}"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "type": "mcp_server_wrapper",
            "server_id": "${server.id}",
            "server_name": "${server.name}"
        }

# For backward compatibility
def execute_agent():
    """Legacy function name"""
    return asyncio.run(run_agent())
`;
  }

  // Quick install method using predefined configs with setup integration
  async quickInstall(serverName: string): Promise<string> {
    const config = await this.getServerConfigWithSetup(serverName);
    if (!config) {
      throw new Error(`No configuration found for server: ${serverName}`);
    }

    return this.installServer(config);
  }
}

// Singleton instance
export const serverManager = new ServerManager();