import { Context } from "../context.js";
import { ToolResult } from "../tools/tool.js";

export async function captureAriaSnapshot(
  context: Context,
  status: string = "",
): Promise<ToolResult> {
  const url = await context.sendSocketMessage("browser_get_url", {});
  const title = await context.sendSocketMessage("browser_get_title", {});
  const snapshot = await context.sendSocketMessage("browser_snapshot", {});
  return {
    content: [
      {
        type: "text",
        text: `${status ? `${status}\n` : ""}
- Page URL: ${url}
- Page Title: ${title}
- Page Snapshot
\`\`\`yaml
${snapshot}
\`\`\`
`,
      },
    ],
  };
}
