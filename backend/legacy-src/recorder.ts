import { z } from 'zod';

interface RecordedAction {
  type: 'navigate' | 'click' | 'type' | 'select' | 'wait' | 'screenshot';
  selector?: string;
  url?: string;
  text?: string;
  value?: string;
  timestamp: number;
  description: string;
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
    this.currentSession = null;

    console.log(`🛑 Stopped recording session: ${session.name} (${session.actions.length} actions recorded)`);
    return session;
  }

  generateMCPToolFromSession(sessionId: string): any {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const toolName = session.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    // Generate MCP tool definition
    const mcpTool = {
      schema: {
        name: `recorded_${toolName}`,
        description: session.description || session.name,
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

  generateToolFromSession(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const toolName = session.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const functionName = `execute_${toolName}`;

    // Optimize actions by consolidating redundant ones
    const optimizedActions = this.optimizeActions(session.actions);

    // Generate direct BrowserMCP/Playwright code instead of HTTP API calls
    const generateActionCode = (action: RecordedAction): string => {
      const safeText = action.text ? action.text.replace(/"/g, '\\"').replace(/'/g, "\\'") : '';
      const safeSelector = action.selector ? action.selector.replace(/"/g, '\\"').replace(/'/g, "\\'") : '';
      const safeUrl = action.url ? action.url.replace(/"/g, '\\"').replace(/'/g, "\\'") : '';

      switch (action.type) {
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
        case 'wait':
          return `        # Wait for page to load
        await page.wait_for_timeout(2000)`;
        case 'screenshot':
          return `        # Take screenshot
        await page.screenshot(path='screenshot.png')`;
        case 'submit':
          return `        # Submit form
        await page.keyboard.press('Enter')`;
        default:
          return `        # ${action.description}
        pass`;
      }
    };

    // Build action descriptions for optimized actions
    const actionDescriptions = optimizedActions.map((action, i) => 
      `    ${i + 1}. ${action.description}`
    ).join('\n');

    // Build action code for optimized actions
    const actionCode = optimizedActions.map(generateActionCode).join('\n        \n');

    // Generate direct Playwright/BrowserMCP code
    const pythonCode = `"""
Auto-generated browser automation tool: ${session.name}
Generated from recorded session on ${new Date(session.startTime).toISOString()}

Description: ${session.description}
"""

from playwright.async_api import async_playwright
from typing import Dict, Any
import asyncio

async def ${functionName}() -> Dict[str, Any]:
    """
    ${session.description || session.name}
    
    This tool was automatically generated from a recorded browser session.
    It performs the following actions:
${actionDescriptions}
    """
    
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
            
            return {"success": True, "message": "Browser automation sequence completed successfully"}
            
        except Exception as e:
            return {"error": str(e)}

def ${functionName}_sync() -> Dict[str, Any]:
    """Synchronous wrapper for the async function"""
    return asyncio.run(${functionName}())

# Tool metadata for agent integration
TOOL_METADATA = {
    "name": "${functionName}",
    "description": "${session.description || session.name}",
    "parameters": {},
    "generated_from_recording": True,
    "recording_session_id": "${sessionId}",
    "actions_count": ${optimizedActions.length},
    "original_actions_count": ${session.actions.length},
    "optimized": True
}

# Usage example:
# result = ${functionName}_sync()
# print(result)
`;

    return pythonCode;
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

  getAllSessions(): RecordingSession[] {
    return Array.from(this.sessions.values());
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    return this.sessions.delete(sessionId);
  }
}

// Singleton instance
export const browserRecorder = new BrowserRecorder();