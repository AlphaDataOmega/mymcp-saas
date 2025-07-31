/**
 * Local Tool Manager
 * Makes local Python files from agent-resources/tools available as MCP tools
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';

interface LocalTool {
  id: string;
  name: string;
  description: string;
  fileName: string;
  filePath: string;
  metadata: any;
  source: 'recorder' | 'agent-resources';
  sessionId?: string;
}

export class LocalToolManager {
  private tools: Map<string, LocalTool> = new Map();
  private toolsDirectory: string;

  constructor() {
    this.toolsDirectory = path.join(process.cwd(), '..', 'frontend', 'agent-resources', 'tools');
    this.scanForTools();
  }

  async scanForTools() {
    // Scan the agent-resources/tools directory for Python files
    try {
      await fs.access(this.toolsDirectory);
    } catch {
      console.log('📁 No agent-resources/tools directory found');
      return;
    }

    try {
      const files = await fs.readdir(this.toolsDirectory);
      const pythonFiles = files.filter(file => file.endsWith('.py') && !file.startsWith('__'));

      console.log(`🔍 Scanning ${pythonFiles.length} Python files for local tools...`);

      for (const fileName of pythonFiles) {
        await this.loadToolFromFile(fileName);
      }

      console.log(`📁 Loaded ${this.tools.size} local tools from agent-resources`);
    } catch (error) {
      console.error('Error scanning local tools:', error);
    }
  }

  private async loadToolFromFile(fileName: string) {
    try {
      const filePath = path.join(this.toolsDirectory, fileName);
      const content = await fs.readFile(filePath, 'utf-8');

      // Try to extract metadata
      let metadata = {};
      let toolName = fileName.replace('.py', '').replace(/_/g, ' ');
      let description = 'Local tool from agent resources';
      let source: 'recorder' | 'agent-resources' = 'agent-resources';
      let sessionId: string | undefined;

      // Look for TOOL_METADATA
      const metadataMatch = content.match(/TOOL_METADATA\s*=\s*\{([^}]+)\}/s);
      if (metadataMatch) {
        try {
          // Extract metadata fields manually (safer than eval)
          const nameMatch = content.match(/"name":\s*"([^"]+)"/);
          const descMatch = content.match(/"description":\s*"([^"]+)"/);
          const sessionMatch = content.match(/"recording_session_id":\s*"([^"]+)"/);
          const generatedMatch = content.match(/"generated_from_recording":\s*true/i);

          if (nameMatch) toolName = nameMatch[1];
          if (descMatch) description = descMatch[1];
          if (sessionMatch) sessionId = sessionMatch[1];
          if (generatedMatch) source = 'recorder';

          metadata = {
            name: toolName,
            description: description,
            generated_from_recording: !!generatedMatch,
            recording_session_id: sessionId
          };
        } catch (e) {
          console.warn(`Could not parse metadata for ${fileName}:`, e);
        }
      } else {
        // Try to extract description from docstring
        const docstringMatch = content.match(/"""([^"]+)"""/);
        if (docstringMatch) {
          description = docstringMatch[1].trim();
        }
      }

      const toolId = `local_${fileName.replace('.py', '').replace(/[^a-zA-Z0-9]/g, '_')}`;

      const localTool: LocalTool = {
        id: toolId,
        name: toolName,
        description: description,
        fileName: fileName,
        filePath: filePath,
        metadata: metadata,
        source: source,
        sessionId: sessionId
      };

      this.tools.set(toolId, localTool);
    } catch (error) {
      console.warn(`Failed to load tool from ${fileName}:`, error);
    }
  }

  getAllTools(): LocalTool[] {
    return Array.from(this.tools.values());
  }

  getTool(id: string): LocalTool | undefined {
    return this.tools.get(id);
  }

  // Generate MCP tool that can be added to the main server
  generateMCPTool(toolId: string): any {
    const tool = this.tools.get(toolId);
    if (!tool) {
      throw new Error(`Local tool with ID "${toolId}" not found`);
    }

    return {
      schema: {
        name: `local_${tool.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        description: `${tool.description} ${tool.source === 'recorder' ? '(Generated from browser recording)' : '(Local agent resource)'}`,
        inputSchema: {
          type: "object",
          properties: {
            params: {
              type: "object",
              description: "Parameters to pass to the local tool",
              additionalProperties: true
            }
          },
          additionalProperties: false,
          $schema: "http://json-schema.org/draft-07/schema#"
        }
      },
      handle: async (context: any, params: any) => {
        try {
          const result = await this.executeTool(toolId, params);
          
          if (result.success) {
            return {
              content: [
                {
                  type: "text",
                  text: `Local tool "${tool.name}" executed successfully:\n\n${JSON.stringify(result.data, null, 2)}`
                }
              ]
            };
          } else {
            return {
              content: [
                {
                  type: "text",
                  text: `Local tool "${tool.name}" execution failed: ${result.error}`
                }
              ]
            };
          }
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error executing local tool: ${String(error)}`
              }
            ]
          };
        }
      },
      toolId,
      toolName: tool.name,
      isLocalTool: true,
      source: tool.source
    };
  }

  private async executeTool(toolId: string, params: any): Promise<any> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      return { success: false, error: `Tool ${toolId} not found` };
    }

    try {
      // Execute the Python file
      return new Promise((resolve) => {
        const pythonProcess = spawn('python3', [tool.filePath], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, TOOL_PARAMS: JSON.stringify(params) }
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
          if (code === 0) {
            try {
              // Try to parse JSON output
              const result = JSON.parse(stdout.trim());
              resolve({ success: true, data: result });
            } catch {
              // Return raw output if not JSON
              resolve({ success: true, data: { output: stdout.trim() } });
            }
          } else {
            resolve({
              success: false,
              error: `Tool execution failed with code ${code}. stderr: ${stderr}`
            });
          }
        });

        // Send params via stdin if the tool expects it
        pythonProcess.stdin.write(JSON.stringify(params));
        pythonProcess.stdin.end();
      });

    } catch (error) {
      return {
        success: false,
        error: `Failed to execute tool: ${String(error)}`
      };
    }
  }

  // Rescan for new tools (useful when tools are added)
  async refresh() {
    this.tools.clear();
    await this.scanForTools();
  }
}

// Singleton instance
export const localToolManager = new LocalToolManager();