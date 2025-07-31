export const appConfig = {
  name: "MyMCP.me Browser Automation",
  wsPort: parseInt(process.env.WS_PORT || "8200"),
  apiPort: parseInt(process.env.API_PORT || "8100"),
};