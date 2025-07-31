import { z } from "zod";

// Browser automation tool schemas
export const SnapshotTool = z.object({
  name: z.literal("browser_snapshot"),
  description: z.literal("Capture an ARIA snapshot of the current browser page"),
  arguments: z.object({}),
});

export const ClickTool = z.object({
  name: z.literal("browser_click"),
  description: z.literal("Click on an element identified by its accessibility label or text"),
  arguments: z.object({
    element: z.string().describe("The accessibility label or visible text of the element to click"),
  }),
});

export const TypeTool = z.object({
  name: z.literal("browser_type"),
  description: z.literal("Type text into an input field"),
  arguments: z.object({
    element: z.string().describe("The accessibility label of the input field"),
    text: z.string().describe("The text to type"),
  }),
});

export const NavigateTool = z.object({
  name: z.literal("browser_navigate"),
  description: z.literal("Navigate to a specific URL"),
  arguments: z.object({
    url: z.string().url().describe("The URL to navigate to"),
  }),
});

export const HoverTool = z.object({
  name: z.literal("browser_hover"),
  description: z.literal("Hover over an element"),
  arguments: z.object({
    element: z.string().describe("The accessibility label of the element to hover over"),
  }),
});

export const SelectOptionTool = z.object({
  name: z.literal("browser_select_option"),
  description: z.literal("Select an option from a dropdown or select element"),
  arguments: z.object({
    element: z.string().describe("The accessibility label of the select element"),
    option: z.string().describe("The option text or value to select"),
  }),
});

export const DragTool = z.object({
  name: z.literal("browser_drag"),
  description: z.literal("Drag an element to another location"),
  arguments: z.object({
    startElement: z.string().describe("The accessibility label of the element to drag"),
    endElement: z.string().describe("The accessibility label of the target location"),
  }),
});

export const GoBackTool = z.object({
  name: z.literal("browser_go_back"),
  description: z.literal("Navigate back in browser history"),
  arguments: z.object({}),
});

export const GoForwardTool = z.object({
  name: z.literal("browser_go_forward"),
  description: z.literal("Navigate forward in browser history"),
  arguments: z.object({}),
});

export const WaitTool = z.object({
  name: z.literal("browser_wait"),
  description: z.literal("Wait for a specified number of seconds"),
  arguments: z.object({
    time: z.number().describe("Number of seconds to wait"),
  }),
});

export const PressKeyTool = z.object({
  name: z.literal("browser_press_key"),
  description: z.literal("Press a keyboard key"),
  arguments: z.object({
    key: z.string().describe("The key to press (e.g., 'Enter', 'Tab', 'Escape')"),
  }),
});

export const ScreenshotTool = z.object({
  name: z.literal("browser_screenshot"),
  description: z.literal("Take a screenshot of the current page"),
  arguments: z.object({}),
});

export const GetConsoleLogsTool = z.object({
  name: z.literal("browser_get_console_logs"),
  description: z.literal("Get console logs from the current page"),
  arguments: z.object({}),
});

// Export all tool types
export type ToolSchema = 
  | typeof SnapshotTool
  | typeof ClickTool
  | typeof TypeTool
  | typeof NavigateTool
  | typeof HoverTool
  | typeof SelectOptionTool
  | typeof DragTool
  | typeof GoBackTool
  | typeof GoForwardTool
  | typeof WaitTool
  | typeof PressKeyTool
  | typeof ScreenshotTool
  | typeof GetConsoleLogsTool;