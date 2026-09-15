import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";

function createServer() {
  const server = new McpServer({
    name: "cardiff-onboarding",
    version: "1.0.0",
  });

  server.registerTool(
    "test_connection",
    {
      description:
        "Test whether the Cardiff Onboarding MCP server is connected and responding.",
      inputSchema: z.object({
        message: z.string().optional(),
      }),
    },
    async ({ message }) => {
      return {
        content: [
          {
            type: "text",
            text:
              "Cardiff Onboarding MCP is connected successfully." +
              (message ? ` Message received: ${message}` : ""),
          },
        ],
      };
    }
  );

  return server;
}

void serveStdio(createServer);

// IMPORTANT: MCP stdio uses stdout for protocol messages.
// Use console.error for debugging, never console.log.
console.error("Cardiff Onboarding MCP running on stdio");