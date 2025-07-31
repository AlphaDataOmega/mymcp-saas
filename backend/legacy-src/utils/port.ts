import { execSync } from "node:child_process";
import net from "node:net";

export async function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(true)); // Port is still in use
    server.once("listening", () => {
      server.close(() => resolve(false)); // Port is free
    });
    server.listen(port);
  });
}

export async function killProcessOnPort(port: number): Promise<void> {
  return new Promise((resolve) => {
    try {
      if (process.platform === "win32") {
        execSync(
          `FOR /F "tokens=5" %a in ('netstat -ano ^| findstr :${port}') do taskkill /F /PID %a`,
        );
      } else {
        // Check if any process is using the port first
        try {
          const result = execSync(`lsof -ti:${port}`, { encoding: 'utf8' });
          if (result.trim()) {
            execSync(`lsof -ti:${port} | xargs kill -9`);
          }
        } catch (lsofError) {
          // No process using the port, which is fine
        }
      }
    } catch (error) {
      // Port is probably not in use, which is fine
    }
    resolve();
  });
}
