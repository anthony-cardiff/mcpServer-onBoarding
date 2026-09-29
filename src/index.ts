import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";

import { registerNewHireTools } from "./tools/newHire.js";
import { registerGoogleUserTools } from "./tools/googleUser.js";

function createServer() {
  const server = new McpServer({
    name: "cardiff-onboarding",
    version: "1.0.0",
  });

  server.registerTool(
    "test_connection",
    {
      description:
        "Test whether the Cardiff Onboarding MCP server is connected.",
      inputSchema: z.object({
        message: z.string().optional(),
      }),
    },
    async ({ message }) => ({
      content: [
        {
          type: "text",
          text:
            "Cardiff Onboarding MCP is connected." +
            (message ? ` Message: ${message}` : ""),
        },
      ],
    })
  );

  registerNewHireTools(server);
  registerGoogleUserTools(server);

  return server;
}

void serveStdio(createServer);

console.error("Cardiff Onboarding MCP running on stdio");