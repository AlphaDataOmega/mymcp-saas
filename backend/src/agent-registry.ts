import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Structured logging interface for agent operations
interface StructuredLogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  module: string;
  message: string;
  agentName?: string;
  sessionId?: string;
  eventType?: 'task_start' | 'task_complete' | 'task_error' | 'tool_invocation' | 'health_check';
  executionTime?: number;
  toolUsed?: string;
  success?: boolean;
  error?: string;
  retryCount?: number;
}

// Agent execution context with session tracking
interface AgentExecutionContext {
  sessionId: string;
  agentId: string;
  agentName: string;
  startTime: number;
  retryCount: number;
  capabilities: string[];
  healthChecked: boolean;
}

interface RegisteredAgent {
  id: string;
  name: string;
  description: string;
  code: string;
  tools: string[];
  created_at: Date;
  updated_at: Date;
  capabilities: string[];
  lastHealthCheck?: Date;
  healthStatus?: 'healthy' | 'degraded' | 'unhealthy';
  executionStats: {
    totalExecutions: number;
    successfulExecutions: number;
    averageExecutionTime: number;
    lastExecuted?: Date;
  };
  metadata: {
    author?: string;
    version?: string;
    tags?: string[];
    requirements?: string[];
    retryEnabled?: boolean;
    maxRetries?: number;
    timeoutMs?: number;
  };
}

interface AgentExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  logs?: string[];
  sessionId?: string;
  executionTime?: number;
  retryCount?: number;
  toolsUsed?: string[];
  healthStatus?: 'healthy' | 'degraded' | 'unhealthy';
}

export class AgentRegistry {
  private agents: Map<string, RegisteredAgent> = new Map();
  private agentsFilePath: string;
  private executionContexts: Map<string, AgentExecutionContext> = new Map();
  private structuredLogger: (entry: StructuredLogEntry) => void;

  constructor() {
    // Store agents in backend data directory
    this.agentsFilePath = path.join(process.cwd(), 'data', 'registered_agents.json');
    this.structuredLogger = this.createStructuredLogger();
    this.ensureDataDirectory();
    this.loadAgents();
  }

  private createStructuredLogger(): (entry: StructuredLogEntry) => void {
    return (entry: StructuredLogEntry) => {
      // Use structured JSON logging similar to Python implementation
      console.log(JSON.stringify(entry, null, 0));
    };
  }

  private log(level: 'INFO' | 'WARN' | 'ERROR', message: string, extra: Partial<StructuredLogEntry> = {}) {
    const logEntry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module: 'agent.registry',
      message,
      ...extra
    };
    this.structuredLogger(logEntry);
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
    capabilities?: string[];
    metadata?: RegisteredAgent['metadata'];
  }): Promise<string> {
    // Generate unique ID using UUID
    const id = `agent_${uuidv4()}`;
    
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
      capabilities: agentData.capabilities || ['basic_task_execution'],
      created_at: new Date(),
      updated_at: new Date(),
      executionStats: {
        totalExecutions: 0,
        successfulExecutions: 0,
        averageExecutionTime: 0
      },
      metadata: {
        retryEnabled: true,
        maxRetries: 3,
        timeoutMs: 30000,
        ...agentData.metadata
      }
    };

    this.agents.set(id, agent);
    await this.saveAgents();

    this.log('INFO', 'agent_registered', {
      agentName: agent.name,
      eventType: 'task_complete',
      success: true
    });
    
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

    return this.executeAgentWithRetry(id, params, agent.metadata.maxRetries || 3);
  }

  private async executeAgentWithRetry(id: string, params: Record<string, any>, maxRetries: number): Promise<AgentExecutionResult> {
    const agent = this.agents.get(id)!;
    const sessionId = uuidv4();
    const startTime = Date.now();
    let lastError: Error | null = null;

    // Create execution context
    const context: AgentExecutionContext = {
      sessionId,
      agentId: id,
      agentName: agent.name,
      startTime,
      retryCount: 0,
      capabilities: agent.capabilities,
      healthChecked: false
    };

    this.executionContexts.set(sessionId, context);

    this.log('INFO', 'task_start', {
      agentName: agent.name,
      sessionId,
      eventType: 'task_start'
    });

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      context.retryCount = attempt;
      
      try {
        // Health validation on retry attempts
        if (attempt > 0) {
          await this.validateAgentHealth(agent);
          context.healthChecked = true;
        }

        const result = await this.executeSingleAgent(agent, params, context);
        
        // Update execution stats on success
        const executionTime = Date.now() - startTime;
        agent.executionStats.totalExecutions++;
        agent.executionStats.successfulExecutions++;
        agent.executionStats.averageExecutionTime = 
          (agent.executionStats.averageExecutionTime * (agent.executionStats.totalExecutions - 1) + executionTime) / 
          agent.executionStats.totalExecutions;
        agent.executionStats.lastExecuted = new Date();
        
        await this.saveAgents();

        this.log('INFO', 'task_complete', {
          agentName: agent.name,
          sessionId,
          eventType: 'task_complete',
          success: true,
          executionTime,
          retryCount: attempt
        });

        this.executionContexts.delete(sessionId);
        
        return {
          ...result,
          sessionId,
          executionTime,
          retryCount: attempt
        };

      } catch (error) {
        lastError = error as Error;
        
        this.log('WARN', 'task_retry', {
          agentName: agent.name,
          sessionId,
          eventType: 'task_error',
          error: lastError.message,
          retryCount: attempt,
          success: false
        });

        // Don't retry on final attempt
        if (attempt === maxRetries) {
          break;
        }

        // Exponential backoff: 500ms, 1s, 2s
        const waitTime = Math.pow(2, attempt) * 500;
        this.log('INFO', `Retrying in ${waitTime}ms...`, {
          agentName: agent.name,
          sessionId
        });
        
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    // All retries exhausted
    const executionTime = Date.now() - startTime;
    agent.executionStats.totalExecutions++;
    await this.saveAgents();

    this.log('ERROR', 'task_error', {
      agentName: agent.name,
      sessionId,
      eventType: 'task_error',
      error: lastError?.message || 'Unknown error',
      executionTime,
      retryCount: maxRetries,
      success: false
    });

    this.executionContexts.delete(sessionId);

    return {
      success: false,
      error: `Agent execution failed after ${maxRetries + 1} attempts: ${lastError?.message}`,
      sessionId,
      executionTime,
      retryCount: maxRetries
    };
  }

  private async validateAgentHealth(agent: RegisteredAgent): Promise<void> {
    // Basic health validation - in production this would check MCP connections, resource usage, etc.
    try {
      // Simulate health check
      if (agent.healthStatus === 'unhealthy') {
        throw new Error('Agent is marked as unhealthy');
      }
      
      agent.lastHealthCheck = new Date();
      agent.healthStatus = 'healthy';
      
      this.log('INFO', 'health_check_passed', {
        agentName: agent.name,
        eventType: 'health_check',
        success: true
      });
      
    } catch (error) {
      agent.healthStatus = 'unhealthy';
      throw new Error(`Agent health check failed: ${(error as Error).message}`);
    }
  }

  private async executeSingleAgent(agent: RegisteredAgent, params: Record<string, any>, context: AgentExecutionContext): Promise<AgentExecutionResult> {

    try {
      // Enhanced Python subprocess execution with better error handling and logging
      const { spawn } = await import('child_process');
      
      // Create a modified version of the agent code with structured logging and session tracking
      const executableCode = `
import json
import os
import sys
import time
from uuid import uuid4

# Agent parameters and context from environment
try:
    agent_params = json.loads(os.environ.get('AGENT_PARAMS', '{}'))
    session_id = os.environ.get('SESSION_ID', str(uuid4()))
    agent_name = os.environ.get('AGENT_NAME', 'Unknown')
except:
    agent_params = {}
    session_id = str(uuid4())
    agent_name = 'Unknown'

# Structured logging function
def log_structured(level, message, **extra_fields):
    log_entry = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "level": level,
        "module": f"agent.{agent_name}",
        "message": message,
        "agent_name": agent_name,
        "session_id": session_id,
        **extra_fields
    }
    print(json.dumps(log_entry), file=sys.stderr)

start_time = time.time()
log_structured("INFO", "task_start", event_type="task_start")

${agent.code}

# Try to find and execute the main function with enhanced error handling
try:
    result = None
    tool_used = None
    
    # Look for the main execution function
    if 'run_test_agent' in globals():
        result = run_test_agent(agent_params.get('input', 'Hello'))
        tool_used = 'run_test_agent'
    elif '__main__' in globals() and hasattr(sys.modules['__main__'], 'main'):
        result = main(agent_params)
        tool_used = 'main'
    else:
        # Default response
        result = {
            "success": True,
            "result": "Agent executed successfully",
            "params_received": agent_params
        }
        tool_used = 'default_handler'
    
    execution_time = time.time() - start_time
    
    log_structured(
        "INFO", "task_complete",
        event_type="task_complete",
        success=True,
        tool_used=tool_used,
        execution_time=execution_time
    )
    
    # Ensure result includes execution metadata
    if isinstance(result, dict):
        result.update({
            "execution_time": execution_time,
            "session_id": session_id,
            "tool_used": tool_used
        })
    
    print(json.dumps(result))
    
except Exception as e:
    execution_time = time.time() - start_time
    
    log_structured(
        "ERROR", "task_error",
        event_type="task_error",
        error=str(e),
        execution_time=execution_time,
        success=False
    )
    
    error_result = {
        "success": False,
        "error": str(e),
        "params_received": agent_params,
        "execution_time": execution_time,
        "session_id": session_id
    }
    print(json.dumps(error_result))
`;
      
      return new Promise((resolve) => {
        const timeout = agent.metadata.timeoutMs || 30000;
        const pythonProcess = spawn('python3', ['-c', executableCode], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...process.env,
            AGENT_PARAMS: JSON.stringify(params),
            SESSION_ID: context.sessionId,
            AGENT_NAME: agent.name,
            BACKEND_API_URL: 'http://localhost:8100'
          },
          timeout
        });

        let stdout = '';
        let stderr = '';
        let timedOut = false;

        const timeoutHandle = setTimeout(() => {
          timedOut = true;
          pythonProcess.kill('SIGTERM');
        }, timeout);

        pythonProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        pythonProcess.on('close', (code) => {
          clearTimeout(timeoutHandle);
          
          this.log('INFO', 'python_execution_complete', {
            agentName: agent.name,
            sessionId: context.sessionId,
            success: code === 0 && !timedOut,
            error: timedOut ? 'Process timed out' : (code !== 0 ? `Exit code ${code}` : undefined)
          });
          
          if (timedOut) {
            resolve({
              success: false,
              error: `Agent execution timed out after ${timeout}ms`,
              logs: [stderr, `stdout: ${stdout}`]
            });
            return;
          }
          
          if (code === 0 && stdout.trim()) {
            try {
              // Try to parse stdout as JSON result
              const result = JSON.parse(stdout.trim());
              resolve({
                success: result.success !== false,
                result,
                logs: stderr ? stderr.split('\n').filter(line => line.trim()) : []
              });
            } catch (parseError) {
              // If not JSON, treat as plain text result
              resolve({
                success: true,
                result: stdout.trim(),
                logs: stderr ? stderr.split('\n').filter(line => line.trim()) : []
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

        pythonProcess.on('error', (error) => {
          clearTimeout(timeoutHandle);
          resolve({
            success: false,
            error: `Failed to spawn Python process: ${error.message}`
          });
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

  // Health monitoring methods
  async getAgentHealth(id: string): Promise<{ healthy: boolean; status: string; lastCheck?: Date }> {
    const agent = this.agents.get(id);
    if (!agent) {
      return { healthy: false, status: 'Agent not found' };
    }

    return {
      healthy: agent.healthStatus !== 'unhealthy',
      status: agent.healthStatus || 'unknown',
      lastCheck: agent.lastHealthCheck
    };
  }

  async getAllAgentMetrics(): Promise<Array<{ 
    id: string; 
    name: string; 
    health: string; 
    totalExecutions: number; 
    successRate: number; 
    avgExecutionTime: number;
  }>> {
    return Array.from(this.agents.values()).map(agent => ({
      id: agent.id,
      name: agent.name,
      health: agent.healthStatus || 'unknown',
      totalExecutions: agent.executionStats.totalExecutions,
      successRate: agent.executionStats.totalExecutions > 0 
        ? (agent.executionStats.successfulExecutions / agent.executionStats.totalExecutions) * 100 
        : 0,
      avgExecutionTime: agent.executionStats.averageExecutionTime
    }));
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
          
          const metadata = [
            `Session ID: ${result.sessionId}`,
            `Execution Time: ${result.executionTime}ms`,
            (result.retryCount !== undefined && result.retryCount > 0) ? `Retries: ${result.retryCount}` : null,
            result.toolsUsed?.length ? `Tools Used: ${result.toolsUsed.join(', ')}` : null
          ].filter(Boolean).join(' | ');
            
          return {
            content: [
              {
                type: "text",
                text: `Agent "${agent.name}" executed successfully:\n\n${resultText}\n\n---\n${metadata}`
              }
            ]
          };
        } else {
          const errorMetadata = [
            `Session ID: ${result.sessionId}`,
            `Execution Time: ${result.executionTime}ms`,
            result.retryCount !== undefined ? `Retries: ${result.retryCount}` : 'Retries: 0',
            `Health Status: ${result.healthStatus}`
          ].filter(Boolean).join(' | ');
          
          return {
            content: [
              {
                type: "text", 
                text: `Agent "${agent.name}" execution failed: ${result.error}\n\n---\n${errorMetadata}`
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