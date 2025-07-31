import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';

interface RegisteredAgent {
  id: string;
  name: string;
  description: string;
  code: string;
  tools: string[];
  created_at: Date;
  updated_at: Date;
  metadata: {
    author?: string;
    version?: string;
    tags?: string[];
    requirements?: string[];
  };
}

interface AgentExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  logs?: string[];
}

export class AgentRegistry {
  private agents: Map<string, RegisteredAgent> = new Map();
  private agentsFilePath: string;

  constructor() {
    // Store agents in backend data directory
    this.agentsFilePath = path.join(process.cwd(), 'data', 'registered_agents.json');
    this.ensureDataDirectory();
    this.loadAgents();
  }

  private async ensureDataDirectory() {
    const dataDir = path.dirname(this.agentsFilePath);
    try {
      await fs.mkdir(dataDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create data directory:', error);
    }
  }

  private async loadAgents() {
    try {
      const data = await fs.readFile(this.agentsFilePath, 'utf-8');
      const agentsData = JSON.parse(data);
      
      for (const agentData of agentsData) {
        // Convert date strings back to Date objects
        agentData.created_at = new Date(agentData.created_at);
        agentData.updated_at = new Date(agentData.updated_at);
        this.agents.set(agentData.id, agentData);
      }
      
      console.log(`📦 Loaded ${this.agents.size} registered agents`);
    } catch (error) {
      // File doesn't exist yet or is empty - that's fine
      console.log('📦 No existing agents found, starting with empty registry');
    }
  }

  private async saveAgents() {
    try {
      const agentsArray = Array.from(this.agents.values());
      await fs.writeFile(this.agentsFilePath, JSON.stringify(agentsArray, null, 2));
    } catch (error) {
      console.error('Failed to save agents:', error);
      throw error;
    }
  }

  async registerAgent(agentData: {
    name: string;
    description: string;
    code: string;
    tools?: string[];
    metadata?: RegisteredAgent['metadata'];
  }): Promise<string> {
    // Generate unique ID
    const id = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Validate agent name is unique
    for (const agent of this.agents.values()) {
      if (agent.name === agentData.name) {
        throw new Error(`Agent with name "${agentData.name}" already exists`);
      }
    }

    const agent: RegisteredAgent = {
      id,
      name: agentData.name,
      description: agentData.description,
      code: agentData.code,
      tools: agentData.tools || [],
      created_at: new Date(),
      updated_at: new Date(),
      metadata: agentData.metadata || {}
    };

    this.agents.set(id, agent);
    await this.saveAgents();

    console.log(`🤖 Registered new agent: ${agent.name} (ID: ${id})`);
    return id;
  }

  async updateAgent(id: string, updates: Partial<RegisteredAgent>): Promise<boolean> {
    const agent = this.agents.get(id);
    if (!agent) {
      return false;
    }

    // Don't allow changing ID or creation date
    const { id: _, created_at, ...allowedUpdates } = updates;
    
    Object.assign(agent, allowedUpdates, { updated_at: new Date() });
    this.agents.set(id, agent);
    await this.saveAgents();

    console.log(`🔄 Updated agent: ${agent.name} (ID: ${id})`);
    return true;
  }

  async unregisterAgent(id: string): Promise<boolean> {
    const agent = this.agents.get(id);
    if (!agent) {
      return false;
    }

    this.agents.delete(id);
    await this.saveAgents();

    console.log(`🗑️ Unregistered agent: ${agent.name} (ID: ${id})`);
    return true;
  }

  getAgent(id: string): RegisteredAgent | undefined {
    return this.agents.get(id);
  }

  getAllAgents(): RegisteredAgent[] {
    return Array.from(this.agents.values());
  }

  getAgentByName(name: string): RegisteredAgent | undefined {
    for (const agent of this.agents.values()) {
      if (agent.name === name) {
        return agent;
      }
    }
    return undefined;
  }

  async executeAgent(id: string, params: Record<string, any> = {}): Promise<AgentExecutionResult> {
    const agent = this.agents.get(id);
    if (!agent) {
      return {
        success: false,
        error: `Agent with ID "${id}" not found`
      };
    }

    try {
      // For now, we'll use a Python subprocess to execute the agent
      // This is a basic implementation - in production you'd want better sandboxing
      const { spawn } = await import('child_process');
      
      // Create a modified version of the agent code that includes the main execution block
      const executableCode = `
import json
import os
import sys

# Agent parameters from environment
try:
    agent_params = json.loads(os.environ.get('AGENT_PARAMS', '{}'))
except:
    agent_params = {}

${agent.code}

# Try to find and execute the main function
try:
    # Look for the main execution function
    if 'run_test_agent' in globals():
        result = run_test_agent(agent_params.get('input', 'Hello'))
    elif '__main__' in globals() and hasattr(sys.modules['__main__'], 'main'):
        result = main(agent_params)
    else:
        # Default response
        result = {
            "success": True,
            "result": "Agent executed successfully",
            "params_received": agent_params
        }
    
    print(json.dumps(result))
except Exception as e:
    error_result = {
        "success": False, 
        "error": str(e),
        "params_received": agent_params
    }
    print(json.dumps(error_result))
`;
      
      return new Promise((resolve) => {
        const pythonProcess = spawn('python3', ['-c', executableCode], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...process.env,
            AGENT_PARAMS: JSON.stringify(params),
            BACKEND_API_URL: 'http://localhost:8100'
          }
        });

        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        pythonProcess.on('close', (code) => {
          console.log(`🐍 Python execution finished with code ${code}`);
          console.log(`📤 stdout: ${stdout}`);
          console.log(`📤 stderr: ${stderr}`);
          
          if (code === 0 && stdout.trim()) {
            try {
              // Try to parse stdout as JSON result
              const result = JSON.parse(stdout.trim());
              resolve({
                success: true,
                result,
                logs: stderr ? [stderr] : []
              });
            } catch (parseError) {
              // If not JSON, treat as plain text result
              resolve({
                success: true,
                result: stdout.trim(),
                logs: stderr ? [stderr] : []
              });
            }
          } else {
            resolve({
              success: false,
              error: `Agent execution failed with code ${code}. stderr: ${stderr}`,
              logs: [stderr, `stdout: ${stdout}`]
            });
          }
        });

        pythonProcess.stdin.end();
      });

    } catch (error) {
      return {
        success: false,
        error: `Failed to execute agent: ${String(error)}`
      };
    }
  }

  // Generate MCP tool schema for a registered agent
  generateMCPTool(id: string): any {
    const agent = this.agents.get(id);
    if (!agent) {
      throw new Error(`Agent with ID "${id}" not found`);
    }

    // Create a safe tool name from agent name
    const toolName = `agent_${agent.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    return {
      schema: {
        name: toolName,
        description: agent.description,
        inputSchema: {
          type: "object",
          properties: {
            input: {
              type: "string",
              description: "Input for the agent"
            },
            params: {
              type: "object",
              description: "Additional parameters for the agent",
              additionalProperties: true
            }
          },
          required: [],
          additionalProperties: false,
          $schema: "http://json-schema.org/draft-07/schema#"
        }
      },
      handle: async (context: any, params: any) => {
        const { input = '', params: agentParams = {} } = params;
        
        // Execute the agent with the provided parameters
        const result = await this.executeAgent(id, { input, ...agentParams });
        
        if (result.success) {
          const resultText = typeof result.result === 'string' 
            ? result.result 
            : JSON.stringify(result.result, null, 2);
            
          return {
            content: [
              {
                type: "text",
                text: `Agent "${agent.name}" executed successfully:\n\n${resultText}`
              }
            ]
          };
        } else {
          return {
            content: [
              {
                type: "text", 
                text: `Agent "${agent.name}" execution failed: ${result.error}`
              }
            ]
          };
        }
      },
      agentId: id,
      agentName: agent.name
    };
  }
}

// Singleton instance
export const agentRegistry = new AgentRegistry();