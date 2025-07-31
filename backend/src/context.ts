import WebSocket from "ws";
import { logger } from "./utils/log.js";

const noConnectionMessage = `No connection to browser extension. In order to proceed, you must first connect a tab by clicking the Browser MCP extension icon in the browser toolbar and clicking the 'Connect' button.`;

export class Context {
  private _ws?: WebSocket;

  get ws(): WebSocket {
    if (!this._ws) {
      throw new Error(noConnectionMessage);
    }
    return this._ws;
  }

  set ws(ws: WebSocket) {
    this._ws = ws;
  }

  hasWs(): boolean {
    return !!this._ws && this._ws.readyState === WebSocket.OPEN;
  }

  async sendSocketMessage(action: string, data: any): Promise<any> {
    if (!this.hasWs()) {
      throw new Error(noConnectionMessage);
    }

    return new Promise((resolve, reject) => {
      const messageId = Math.random().toString(36).substring(7);
      const message = { id: messageId, action, data };

      // Set up message listener for response
      const messageHandler = (rawData: WebSocket.Data) => {
        try {
          const response = JSON.parse(rawData.toString());
          if (response.id === messageId) {
            this.ws.off("message", messageHandler);
            if (response.error) {
              reject(new Error(response.error));
            } else {
              resolve(response.data);
            }
          }
        } catch (error) {
          logger.error("Failed to parse WebSocket message:", error);
        }
      };

      this.ws.on("message", messageHandler);

      // Send the message
      this.ws.send(JSON.stringify(message));

      // Set timeout for response
      setTimeout(() => {
        this.ws.off("message", messageHandler);
        reject(new Error(`Timeout waiting for response to ${action}`));
      }, 30000); // 30 second timeout
    });
  }

  async close(): Promise<void> {
    if (this._ws) {
      this._ws.close();
      this._ws = undefined;
    }
  }
}
