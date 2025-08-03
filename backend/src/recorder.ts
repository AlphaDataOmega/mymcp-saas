import { z } from 'zod';

interface RecordedAction {
  type: 'navigate' | 'click' | 'type' | 'select' | 'wait' | 'screenshot' | 'input_dynamic' | 'scrape_target' | 'copy' | 'submit' | 'scroll';
  selector?: string;
  url?: string;
  text?: string;
  value?: string;
  timestamp: number;
  description: string;
  action?: string; // For compatibility with new recording format
}

interface RecordingSession {
  id: string;
  name: string;
  description: string;
  actions: RecordedAction[];
  startTime: number;
  endTime?: number;
  status: 'recording' | 'stopped' | 'completed';
}

export class BrowserRecorder {
  private currentSession: RecordingSession | null = null;
  private lastCompletedSession: RecordingSession | null = null;
  private sessions: Map<string, RecordingSession> = new Map();

  async startRecording(sessionName: string, description: string = ''): Promise<string> {
    if (this.currentSession?.status === 'recording') {
      throw new Error('Recording already in progress');
    }

    const sessionId = Math.random().toString(36).substring(7);
    this.currentSession = {
      id: sessionId,
      name: sessionName,
      description,
      actions: [],
      startTime: Date.now(),
      status: 'recording'
    };

    this.sessions.set(sessionId, this.currentSession);

    console.log(`🎬 Started recording session: ${sessionName} (ID: ${sessionId})`);
    console.log(`📝 Manual recording mode - use the API to record actions or integrate with browser extension`);
    
    return sessionId;
  }

  // Manual action recording methods for API integration
  recordNavigate(url: string) {
    this.recordAction({
      type: 'navigate',
      url,
      timestamp: Date.now(),
      description: `Navigate to ${url}`
    });
  }

  recordClick(selector: string, description?: string) {
    this.recordAction({
      type: 'click',
      selector,
      timestamp: Date.now(),
      description: description || `Click on ${selector}`
    });
  }

  recordType(selector: string, text: string, description?: string) {
    this.recordAction({
      type: 'type',
      selector,
      text,
      timestamp: Date.now(),
      description: description || `Type "${text}" into ${selector}`
    });
  }

  recordWait(duration?: number) {
    this.recordAction({
      type: 'wait',
      timestamp: Date.now(),
      description: `Wait ${duration ? duration + 'ms' : 'for page load'}`
    });
  }

  recordScreenshot() {
    this.recordAction({
      type: 'screenshot',
      timestamp: Date.now(),
      description: 'Take screenshot'
    });
  }

  // Record action from CDP event (used by extension integration)
  recordActionFromCDP(sessionId: string, action: any) {
    const session = this.sessions.get(sessionId);
    if (session && session.status === 'recording') {
      const fullAction: RecordedAction = {
        type: action.type || 'wait',
        selector: action.selector,
        url: action.url,
        text: action.text,
        value: action.value,
        timestamp: Date.now(),
        description: action.description || 'CDP recorded action'
      };

      session.actions.push(fullAction);
      console.log(`📝 Action Recorded: ${fullAction.description}`);
    }
  }

  private recordAction(action: Partial<RecordedAction>) {
    if (!this.currentSession || this.currentSession.status !== 'recording') return;

    const fullAction: RecordedAction = {
      type: action.type || 'wait',
      selector: action.selector,
      url: action.url,
      text: action.text,
      value: action.value,
      timestamp: action.timestamp || Date.now(),
      description: action.description || 'Unknown action'
    };

    this.currentSession.actions.push(fullAction);
    console.log(`📝 Recorded: ${fullAction.description}`);
  }

  async stopRecording(): Promise<RecordingSession | null> {
    if (!this.currentSession || this.currentSession.status !== 'recording') {
      throw new Error('No active recording session');
    }

    this.currentSession.endTime = Date.now();
    this.currentSession.status = 'stopped';

    const session = this.currentSession;
    this.lastCompletedSession = session;  // Store the completed session
    this.currentSession = null;

    console.log(`🛑 Stopped recording session: ${session.name} (${session.actions.length} actions recorded)`);
    return session;
  }

  getCurrentSession(): RecordingSession | null {
    return this.currentSession;
  }

  getLastCompletedSession(): RecordingSession | null {
    return this.lastCompletedSession;
  }

  // Get the most relevant session for display (current recording or last completed)
  getDisplaySession(): RecordingSession | null {
    return this.currentSession || this.lastCompletedSession;
  }

  // Get all sessions as an array
  getAllSessions(): RecordingSession[] {
    return Array.from(this.sessions.values());
  }

  generateMCPToolFromSession(sessionId: string): any {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const toolName = (customName || session.name).toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    // Generate MCP tool definition
    const mcpTool = {
      schema: {
        name: `recorded_${toolName}`,
        description: customDescription || session.description || session.name,
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
          additionalProperties: false,
          $schema: "http://json-schema.org/draft-07/schema#"
        }
      },
      handle: async (context: any, params: any) => {
        const results = [];
        
        for (const action of session.actions) {
          try {
            let result;
            switch (action.type) {
              case 'navigate':
                result = await context.sendSocketMessage("browser_navigate", { url: action.url });
                results.push(`Navigated to ${action.url}`);
                break;
              case 'click':
                result = await context.sendSocketMessage("browser_click", { element: action.selector });
                results.push(`Clicked on ${action.selector}`);
                break;
              case 'type':
                result = await context.sendSocketMessage("browser_type", { 
                  element: action.selector, 
                  text: action.text 
                });
                results.push(`Typed "${action.text}" into ${action.selector}`);
                break;
              case 'wait':
                await new Promise(resolve => setTimeout(resolve, 2000));
                results.push('Waited 2 seconds');
                break;
              case 'screenshot':
                result = await context.sendSocketMessage("browser_screenshot", {});
                results.push('Took screenshot');
                break;
            }
          } catch (error) {
            results.push(`Error: ${error.message}`);
          }
        }
        
        return {
          content: [
            {
              type: "text",
              text: `Executed recorded actions for "${session.name}":\n\n${results.join('\n')}`
            }
          ]
        };
      },
      sessionId,
      actions: session.actions
    };

    return mcpTool;
  }

  generateToolFromSession(sessionId: string, format: 'mcp' | 'playwright' = 'mcp', customName?: string, customDescription?: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const toolName = (customName || session.name).toLowerCase().replace(/[^a-z0-9]/g, '_');
    const functionName = `execute_${toolName}`;

    // Optimize actions by consolidating redundant ones
    const optimizedActions = this.optimizeActions(session.actions);
    console.log(`🔧 Tool generation: ${session.actions.length} original actions → ${optimizedActions.length} optimized actions`);

    // Generate direct BrowserMCP/Playwright code instead of HTTP API calls
    const generateActionCode = (action: RecordedAction): string => {
      const safeText = action.text ? action.text.replace(/"/g, '\\"').replace(/'/g, "\\'") : '';
      const safeSelector = action.selector ? action.selector.replace(/"/g, '\\"').replace(/'/g, "\\'") : '';
      const safeUrl = action.url ? action.url.replace(/"/g, '\\"').replace(/'/g, "\\'") : '';

      const actionType = action.type || action.action; // Handle both formats
      
      switch (actionType) {
        case 'navigate':
          return `        # Navigate to ${safeUrl}
        await page.goto('${safeUrl}')
        await page.wait_for_load_state('networkidle')`;
        
        case 'click':
          return `        # Click on ${safeSelector}
        await page.click('${safeSelector}')`;
        
        case 'type':
          return `        # Type "${safeText}" into ${safeSelector}
        await page.fill('${safeSelector}', '${safeText}')`;
        
        case 'input_dynamic':
          // Handle AI-generated input fields
          const fieldType = this.extractFieldType(safeText);
          const placeholder = this.getPlaceholderValue(fieldType);
          return `        # AI-generated input (${fieldType}): ${safeSelector}
        # Use parameter substitution - replace with actual value in runtime
        ai_value = params.get('${fieldType.toUpperCase()}', '${placeholder}')
        await page.fill('${safeSelector}', ai_value)`;
        
        case 'scrape_target':
          return `        # Extract data from ${safeSelector}
        element = await page.locator('${safeSelector}')
        extracted_text = await element.text_content()
        extracted_data['${safeSelector}'] = extracted_text.strip() if extracted_text else ''`;
        
        case 'copy':
          return `        # Copy text from ${safeSelector || 'selection'}
        ${safeSelector ? `element = await page.locator('${safeSelector}')
        await element.select_text()` : '# Text already selected'}
        # Note: Clipboard operations may require additional permissions`;
        
        case 'scroll':
          const [x, y] = (action.value || '0,0').split(',');
          return `        # Scroll to position (${x}, ${y})
        await page.evaluate('window.scrollTo(${x}, ${y})')`;
        
        case 'submit':
          return `        # Submit form ${safeSelector}
        await page.locator('${safeSelector}').press('Enter')`;
        
        case 'wait':
          return `        # Wait for page to load
        await page.wait_for_timeout(2000)`;
        
        case 'screenshot':
          return `        # Take screenshot
        await page.screenshot(path='screenshot.png')`;
        
        default:
          return `        # ${action.description}
        pass`;
      }
    };

    // Build action descriptions for optimized actions (limit to prevent truncation)
    const actionDescriptions = optimizedActions.slice(0, 10).map((action, i) => 
      `    ${i + 1}. ${action.description}`
    ).join('\n') + (optimizedActions.length > 10 ? `\n    ... and ${optimizedActions.length - 10} more actions` : '');

    // Build action code for optimized actions
    const actionCode = optimizedActions.map(generateActionCode).join('\n        \n');

    if (format === 'playwright') {
      // Check if we have dynamic inputs or scraping
      const hasDynamicInputs = optimizedActions.some(a => (a.type || a.action) === 'input_dynamic');
      const hasDataExtraction = optimizedActions.some(a => (a.type || a.action) === 'scrape_target' || (a.type || a.action) === 'copy');
      
      // Generate Playwright code for testing
      const playwrightCode = `"""
Test Script: ${customName || session.name}
Generated from recorded session on ${new Date(session.startTime).toISOString()}

Description: ${customDescription || session.description || session.name}
${hasDynamicInputs ? '\nThis script includes AI-generated input fields that can be customized with parameters.' : ''}
${hasDataExtraction ? '\nThis script extracts data from the page and returns it in the results.' : ''}
"""

from playwright.async_api import async_playwright
import asyncio
from typing import Dict, Any

async def ${functionName}(params: Dict[str, Any] = None):
    """
    ${customDescription || session.description || session.name}
    
    This script was automatically generated from a recorded browser session.
    It performs the following actions:
${actionDescriptions}
    
    Args:
        params: Optional dictionary containing values for AI-generated fields
                Examples: {'EMAIL': 'user@company.com', 'NAME': 'John Smith'}
    
    Returns:
        Dict containing execution results${hasDataExtraction ? ' and extracted data' : ''}
    """
    
    if params is None:
        params = {}
    
    ${hasDataExtraction ? 'extracted_data = {}' : ''}
    
    async with async_playwright() as p:
        try:
            # Launch browser
            browser = await p.chromium.launch(headless=False)
            context = await browser.new_context()
            page = await context.new_page()
            
            # Execute recorded actions
${actionCode}
            
            # Close browser
            await browser.close()
            
            result = {"success": True, "message": "Browser automation sequence completed successfully"}
            ${hasDataExtraction ? 'result["extracted_data"] = extracted_data' : ''}
            
            return result
            
        except Exception as e:
            return {"error": str(e)}

# Run the automation
if __name__ == "__main__":
    # Example parameters for AI-generated fields
    example_params = {
        ${optimizedActions.filter(a => (a.type || a.action) === 'input_dynamic').map(a => {
          const fieldType = this.extractFieldType(a.text || '');
          const placeholder = this.getPlaceholderValue(fieldType);
          return `'${fieldType.toUpperCase()}': '${placeholder}'`;
        }).join(',\n        ')}
    }
    
    result = asyncio.run(${functionName}(example_params))
    print(result)
`;
      return playwrightCode;
    }

    // Generate MCP tool definition that integrates with the BrowserMCP server
    const mcpToolCode = `"""
MCP Browser Automation Tool: ${customName || session.name}
Generated from recorded session on ${new Date(session.startTime).toISOString()}

Description: ${customDescription || session.description || session.name}

This tool can be used by AI assistants through the MCP (Model Context Protocol) server.
It executes the following recorded browser automation sequence:
${actionDescriptions}
"""

import asyncio
from typing import Dict, Any, List
import json

# MCP Tool Definition
async def ${functionName}(context, **kwargs) -> Dict[str, Any]:
    """
    ${customDescription || session.description || session.name}
    
    This MCP tool executes a recorded browser automation sequence.
    It uses the BrowserMCP server to control the browser through WebSocket commands.
    
    Returns:
        Dict containing success status and execution results
    """
    
    try:
        results = []
        
        # Execute each recorded action through the MCP browser automation tools
${optimizedActions.map(action => {
  switch (action.type) {
    case 'navigate':
      return `        # Navigate to ${action.url}
        nav_result = await context.sendSocketMessage("browser_navigate", {"url": "${action.url}"})
        results.append(f"Navigated to ${action.url}")`;
    case 'click':
      return `        # Click on ${action.selector}
        click_result = await context.sendSocketMessage("browser_click", {"element": "${action.selector}"})
        results.append(f"Clicked on ${action.selector}")`;
    case 'type':
      return `        # Type "${action.text}" into ${action.selector}
        type_result = await context.sendSocketMessage("browser_type", {"element": "${action.selector}", "text": "${action.text}"})
        results.append(f"Typed '${action.text}' into ${action.selector}")`;
    case 'wait':
      return `        # Wait for 2 seconds
        await context.sendSocketMessage("browser_wait", {"time": 2})
        results.append("Waited 2 seconds")`;
    case 'screenshot':
      return `        # Take screenshot
        screenshot_result = await context.sendSocketMessage("browser_screenshot", {})
        results.append("Took screenshot")`;
    default:
      return `        # ${action.description}
        results.append("${action.description}")`;
  }
}).join('\n        \n')}
        
        return {
            "content": [
                {
                    "type": "text",
                    "text": f"Successfully executed ${customName || session.name}:\\n\\n" + "\\n".join(results)
                }
            ]
        }
        
    except Exception as e:
        return {
            "content": [
                {
                    "type": "text", 
                    "text": f"Error executing ${customName || session.name}: {str(e)}"
                }
            ]
        }

# MCP Tool Registration
TOOL_SCHEMA = {
    "name": "${toolName}",
    "description": "${customDescription || session.description || session.name}",
    "inputSchema": {
        "type": "object",
        "properties": {},
        "required": []
    }
}

# Tool metadata for MyMCP.me platform
TOOL_METADATA = {
    "name": "${toolName}",
    "function_name": "${functionName}",
    "description": "${customDescription || session.description || session.name}",
    "category": "browser_automation",
    "generated_from_recording": True,
    "recording_session_id": "${sessionId}",
    "actions_count": ${optimizedActions.length},
    "original_actions_count": ${session.actions.length},
    "created_at": "${new Date().toISOString()}",
    "requires_browser_connection": True,
    "mcp_compatible": True
}

# Usage: This tool will be automatically registered with your MCP server
# AI assistants can call it using: await context.callTool("${toolName}", {})
`;

    return mcpToolCode;
  }

  private optimizeActions(actions: RecordedAction[]): RecordedAction[] {
    const optimized: RecordedAction[] = [];
    
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      
      // Consolidate sequential typing actions on the same element
      if (action.type === 'type' && action.selector) {
        // Look ahead for more typing actions on the same element
        let j = i + 1;
        let finalText = action.text || '';
        
        while (j < actions.length && 
               actions[j].type === 'type' && 
               actions[j].selector === action.selector) {
          finalText = actions[j].text || finalText; // Use the final typed text
          j++;
        }
        
        // If we found sequential typing, create one consolidated action
        if (j > i + 1) {
          optimized.push({
            ...action,
            text: finalText,
            description: `Type "${finalText}" into ${action.selector}`
          });
          i = j - 1; // Skip the consolidated actions
        } else {
          optimized.push(action);
        }
      }
      // Skip duplicate navigation actions
      else if (action.type === 'navigate') {
        const lastAction = optimized[optimized.length - 1];
        if (!lastAction || lastAction.type !== 'navigate' || lastAction.url !== action.url) {
          optimized.push(action);
        }
      }
      // Skip duplicate click actions on the same element within short time
      else if (action.type === 'click') {
        const lastAction = optimized[optimized.length - 1];
        if (!lastAction || lastAction.type !== 'click' || lastAction.selector !== action.selector) {
          optimized.push(action);
        }
      }
      else {
        optimized.push(action);
      }
    }
    
    return optimized;
  }

  getSession(sessionId: string): RecordingSession | undefined {
    return this.sessions.get(sessionId);
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    return this.sessions.delete(sessionId);
  }
  
  // Clear all sessions (for reset functionality)
  clearAllSessions(): void {
    console.log(`🧹 Clearing ${this.sessions.size} stored sessions`);
    this.sessions.clear();
    this.currentSession = null;
    this.lastCompletedSession = null;
  }

  // === SAVED TOOLS MANAGEMENT ===
  private savedTools: Map<string, any> = new Map();

  getSavedTools(): any[] {
    return Array.from(this.savedTools.values());
  }

  async saveTool(tool: {
    name: string;
    description: string;
    code: string;
    language: string;
    category: string;
    tags: string[];
    isPublic: boolean;
    createdAt: string;
    updatedAt: string;
  }): Promise<string> {
    const toolId = Math.random().toString(36).substring(7);
    const savedTool = {
      id: toolId,
      ...tool
    };
    
    this.savedTools.set(toolId, savedTool);
    console.log(`💾 Saved tool: ${tool.name} (ID: ${toolId})`);
    
    return toolId;
  }

  async deleteTool(toolId: string): Promise<boolean> {
    const deleted = this.savedTools.delete(toolId);
    if (deleted) {
      console.log(`🗑️ Deleted tool: ${toolId}`);
    }
    return deleted;
  }

  /**
   * Extract field type from AI placeholder text (e.g., "{{AI_GENERATED_EMAIL}}" -> "email")
   */
  private extractFieldType(text: string): string {
    const match = text.match(/\{\{AI_GENERATED_([^}]+)\}\}/);
    return match ? match[1].toLowerCase() : 'text';
  }

  /**
   * Get placeholder value for AI field types
   */
  private getPlaceholderValue(fieldType: string): string {
    switch (fieldType) {
      case 'email':
        return 'user@example.com';
      case 'name':
      case 'text':
        return 'John Doe';
      case 'phone':
        return '(555) 123-4567';
      case 'address':
        return '123 Main St, City, State 12345';
      case 'company':
        return 'Example Company';
      case 'url':
        return 'https://example.com';
      case 'search':
        return 'example search query';
      case 'long_text':
        return 'This is a longer text example for textarea fields.';
      case 'number':
        return '42';
      case 'date':
        return '2024-01-01';
      default:
        return 'example value';
    }
  }
}

// Singleton instance
export const browserRecorder = new BrowserRecorder();