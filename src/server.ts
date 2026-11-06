import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { PurelymailApiError, type PurelymailClient } from "./client.js";
import { tools, type ToolDefinition } from "./tools.js";

export interface ServerOptions {
  client: PurelymailClient;
  readOnly?: boolean;
}

export function createServer({ client, readOnly = false }: ServerOptions): McpServer {
  const server = new McpServer({ name: "purelymail", version: "0.1.0" });

  for (const tool of tools) {
    if (readOnly && tool.kind !== "read") continue;

    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: annotationsFor(tool),
      },
      (args: object) => runTool(client, tool, args),
    );
  }

  return server;
}

function annotationsFor(tool: ToolDefinition) {
  return {
    title: tool.title,
    readOnlyHint: tool.kind === "read",
    destructiveHint: tool.kind === "destructive",
    openWorldHint: true,
  };
}

async function runTool(
  client: PurelymailClient,
  tool: ToolDefinition,
  args: object,
): Promise<CallToolResult> {
  try {
    const result = await client.call(tool.path, args);
    return { content: [{ type: "text", text: formatResult(result) }] };
  } catch (error) {
    const text =
      error instanceof PurelymailApiError
        ? `Purelymail API error (${error.code}): ${error.message}`
        : error instanceof Error
          ? error.message
          : String(error);
    return { isError: true, content: [{ type: "text", text }] };
  }
}

/** Write operations return `{}`, which reads as nothing having happened. */
function formatResult(result: unknown): string {
  const isEmpty = typeof result === "object" && result !== null && Object.keys(result).length === 0;
  return JSON.stringify(isEmpty ? { success: true } : result, null, 2);
}
