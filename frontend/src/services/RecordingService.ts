// Recording Service - Extracted from recorder.py functionality
import { RecordingSession, RecordedAction, GeneratedTool } from '../types/automation';
import { TenantApiClient } from './TenantApiClient';

export class RecordingService {
  private apiClient: TenantApiClient;

  constructor(tenantId: string) {
    this.apiClient = new TenantApiClient(tenantId);
  }

  /**
   * Start a new recording session
   * Extracted from: recorder.py:start_recording_with_extension()
   */
  async startRecording(sessionName: string, description: string = ''): Promise<RecordingSession> {
    const response = await this.apiClient.post('/recorder/start', {
      sessionName,
      description
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to start recording');
    }

    return {
      id: response.sessionId,
      tenantId: this.apiClient.tenantId,
      name: sessionName,
      description,
      status: 'recording',
      startTime: Date.now(),
      actions: [],
      metadata: {
        browserInfo: await this.getBrowserInfo(),
        userAgent: navigator.userAgent,
        screenResolution: `${screen.width}x${screen.height}`
      }
    };
  }

  /**
   * Stop the current recording session
   * Extracted from: recorder.py:stop_recording()
   */
  async stopRecording(): Promise<RecordingSession> {
    const response = await this.apiClient.post('/recorder/stop');
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to stop recording');
    }

    return response.session;
  }

  /**
   * Get recording session status
   * Extracted from: recorder.py:get_recording_status()
   */
  async getSessionStatus(sessionId: string): Promise<RecordingSession> {
    const response = await this.apiClient.get(`/recorder/sessions/${sessionId}`);
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to get session status');
    }

    return response.session;
  }

  /**
   * List all recording sessions for tenant
   * Extracted from: recorder.py:show_sessions_interface()
   */
  async listSessions(): Promise<RecordingSession[]> {
    const response = await this.apiClient.get('/recorder/sessions');
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to list sessions');
    }

    return response.sessions || [];
  }

  /**
   * Delete a recording session
   * Extracted from: recorder.py:delete_session()
   */
  async deleteSession(sessionId: string): Promise<void> {
    const response = await this.apiClient.delete(`/recorder/sessions/${sessionId}`);
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to delete session');
    }
  }

  /**
   * Generate tool code from recording session
   * Extracted from: recorder.py:generate_tool_code()
   */
  async generateTool(
    sessionId: string, 
    customization: {
      name: string;
      description: string;
      parameters?: any[];
    }
  ): Promise<GeneratedTool> {
    const response = await this.apiClient.post(`/recorder/sessions/${sessionId}/generate-tool`, {
      customization
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to generate tool');
    }

    // Save tool to tenant storage
    const tool: GeneratedTool = {
      id: response.toolId,
      sessionId,
      tenantId: this.apiClient.tenantId,
      name: customization.name,
      description: customization.description,
      code: response.toolCode,
      language: 'python',
      parameters: customization.parameters || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      executionCount: 0,
      category: 'browser_automation',
      tags: ['recorded', 'browser'],
      isPublic: false
    };

    await this.saveTool(tool);
    return tool;
  }

  /**
   * Save generated tool to tenant storage
   * Extracted from: recorder.py:save_tool_to_resources()
   */
  private async saveTool(tool: GeneratedTool): Promise<void> {
    const response = await this.apiClient.post('/tools', tool);
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to save tool');
    }
  }

  /**
   * Get browser connection status
   * Extracted from: recorder.py:check_extension_connection()
   */
  async checkBrowserConnection(): Promise<{
    connected: boolean;
    extensionVersion?: string;
    capabilities: string[];
  }> {
    try {
      const response = await this.apiClient.get('/recorder/connection-status');
      return {
        connected: response.connected || false,
        extensionVersion: response.extensionVersion,
        capabilities: response.capabilities || []
      };
    } catch (error) {
      return {
        connected: false,
        capabilities: []
      };
    }
  }

  /**
   * Add manual action to recording (for testing)
   * Extracted from: recorder.py:add_manual_action()
   */
  async addManualAction(
    actionType: RecordedAction['type'],
    actionData: Partial<RecordedAction>
  ): Promise<void> {
    const response = await this.apiClient.post('/recorder/action', {
      type: actionType,
      ...actionData,
      timestamp: Date.now()
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to add manual action');
    }
  }

  /**
   * Get recent recording sessions for dashboard
   */
  async getRecentSessions(limit: number = 5): Promise<RecordingSession[]> {
    const sessions = await this.listSessions();
    return sessions
      .sort((a, b) => (b.startTime || 0) - (a.startTime || 0))
      .slice(0, limit);
  }

  /**
   * Get recording statistics for dashboard
   */
  async getRecordingStats(): Promise<{
    totalSessions: number;
    completedSessions: number;
    toolsGenerated: number;
    hoursRecorded: number;
  }> {
    const sessions = await this.listSessions();
    const completed = sessions.filter(s => s.status === 'completed');
    const totalDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);

    const toolsResponse = await this.apiClient.get('/tools');
    const toolsGenerated = toolsResponse.tools?.length || 0;

    return {
      totalSessions: sessions.length,
      completedSessions: completed.length,
      toolsGenerated,
      hoursRecorded: Math.round(totalDuration / (1000 * 60 * 60) * 10) / 10
    };
  }

  private async getBrowserInfo(): Promise<any> {
    // Extract browser info from user agent
    const ua = navigator.userAgent;
    let browserName = 'Unknown';
    let browserVersion = 'Unknown';

    if (ua.includes('Chrome')) {
      browserName = 'Chrome';
      const match = ua.match(/Chrome\/([0-9]+)/);
      browserVersion = match ? match[1] : 'Unknown';
    } else if (ua.includes('Firefox')) {
      browserName = 'Firefox';
      const match = ua.match(/Firefox\/([0-9]+)/);
      browserVersion = match ? match[1] : 'Unknown';
    } else if (ua.includes('Safari')) {
      browserName = 'Safari';
      const match = ua.match(/Version\/([0-9]+)/);
      browserVersion = match ? match[1] : 'Unknown';
    }

    return {
      name: browserName,
      version: browserVersion,
      platform: navigator.platform,
      userAgent: ua
    };
  }
}