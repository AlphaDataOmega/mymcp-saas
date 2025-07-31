import { WebSocketServer } from "ws";
import { appConfig } from "./shared/config.js";
import { isPortInUse, killProcessOnPort } from "./utils/port.js";

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function createWebSocketServer(
  port: number = appConfig.wsPort,
): Promise<WebSocketServer> {
  await killProcessOnPort(port);
  // Wait until the port is free
  while (await isPortInUse(port)) {
    await wait(100);
  }
  return new WebSocketServer({ port });
}
