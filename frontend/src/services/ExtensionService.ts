// Extension Service - Handles browser extension connection status
// Monitors extension connectivity and provides status updates

import { TenantApiClient } from './TenantApiClient';

export interface ExtensionStatus {
  connected: boolean;
  websocketReady?: boolean;
  lastPing?: string;
  error?: string;
}

export class ExtensionService {
  private apiClient: TenantApiClient;
  private statusCallbacks: ((status: ExtensionStatus) => void)[] = [];
  private pollingInterval: NodeJS.Timeout | null = null;
  private isPolling = false;

  constructor(tenantId: string) {
    this.apiClient = new TenantApiClient(tenantId);
  }

  /**
   * Start monitoring extension connection status
   */
  startMonitoring(callback: (status: ExtensionStatus) => void): void {
    this.statusCallbacks.push(callback);
    
    if (!this.isPolling) {
      this.isPolling = true;
      this.startPolling();
    }
    
    // Initial status check
    this.checkConnectionStatus();
  }

  /**
   * Stop monitoring extension connection status
   */
  stopMonitoring(callback?: (status: ExtensionStatus) => void): void {
    if (callback) {
      this.statusCallbacks = this.statusCallbacks.filter(cb => cb !== callback);
    } else {
      this.statusCallbacks = [];
    }
    
    if (this.statusCallbacks.length === 0 && this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      this.isPolling = false;
    }
  }

  /**
   * Check extension connection status once
   */
  async checkConnectionStatus(): Promise<ExtensionStatus> {
    try {
      const response = await this.apiClient.get('/extension/status');
      const status: ExtensionStatus = {
        connected: response.connected || false,
        websocketReady: response.websocketReady || false,
        lastPing: response.timestamp,
        error: response.connected ? undefined : 'Extension not connected'
      };
      
      // Notify all callbacks
      this.statusCallbacks.forEach(callback => callback(status));
      
      return status;
    } catch (error) {
      const status: ExtensionStatus = {
        connected: false,
        error: error instanceof Error ? error.message : 'Failed to check extension status'
      };
      
      // Notify all callbacks
      this.statusCallbacks.forEach(callback => callback(status));
      
      return status;
    }
  }

  /**
   * Get the extension download URL
   */
  getExtensionDownloadUrl(): string {
    return `${this.apiClient.baseUrl}/extension/download`;
  }

  /**
   * Trigger extension to connect (if already installed)
   */
  async triggerExtensionConnect(): Promise<boolean> {
    try {
      const response = await this.apiClient.post('/extension/trigger-connect');
      return response.success || false;
    } catch (error) {
      console.error('Failed to trigger extension connection:', error);
      return false;
    }
  }

  /**
   * Start polling for connection status
   */
  private startPolling(): void {
    // Poll every 2 seconds for more responsive detection
    this.pollingInterval = setInterval(async () => {
      // First check status
      await this.checkConnectionStatus();
      
      // Then ping to keep connection alive
      try {
        await this.apiClient.post('/extension/ping');
      } catch (error) {
        // Silent fail - the status check above will handle disconnection
      }
    }, 2000);
  }

  /**
   * Get recorder connection status (specific to recording functionality)
   */
  async getRecorderConnectionStatus(): Promise<{
    extensionConnected: boolean;
    recorderReady: boolean;
    activeSession?: string;
  }> {
    try {
      const response = await this.apiClient.get('/recorder/connection-status');
      return {
        extensionConnected: response.extensionConnected || false,
        recorderReady: response.recorderReady || false,
        activeSession: response.activeSession
      };
    } catch (error) {
      return {
        extensionConnected: false,
        recorderReady: false
      };
    }
  }

  /**
   * Test if extension can communicate with backend
   */
  async testExtensionCommunication(): Promise<{
    canCommunicate: boolean;
    latency?: number;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      const response = await this.apiClient.post('/extension/ping');
      const latency = Date.now() - startTime;
      
      return {
        canCommunicate: response.success || false,
        latency,
        error: response.success ? undefined : (response.error || 'Communication test failed')
      };
    } catch (error) {
      return {
        canCommunicate: false,
        error: error instanceof Error ? error.message : 'Communication test failed'
      };
    }
  }

  /**
   * Get extension information if connected
   */
  async getExtensionInfo(): Promise<{
    version?: string;
    capabilities?: string[];
    connectedAt?: string;
  } | null> {
    try {
      const response = await this.apiClient.get('/extension/info');
      return response.info || null;
    } catch (error) {
      return null;
    }
  }
}

// Helper function to create extension service instance
export function createExtensionService(tenantId: string): ExtensionService {
  return new ExtensionService(tenantId);
}

// Export types
export type { ExtensionStatus };