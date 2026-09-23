import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import { getNewHireFromSpreadsheet } from "../services/spreadsheet.js";

const WORKBOOK_PATH =
  "/Users/anthonyd/mcpServer/Onboarding/data/Rep Credentials.xlsx";

export function registerNewHireTools(server: McpServer) {
  server.registerTool(
    "get_new_hire",
    {
      description:
        "Read a new employee from a specific row of the Cardiff Rep Credentials onboarding spreadsheet. Returns employee and provisioning information.",
      inputSchema: z.object({
        row: z
          .number()
          .int()
          .min(2)
          .describe("The Excel spreadsheet row number to retrieve."),
      }),
    },
    async ({ row }) => {
      try {
        const employee = getNewHireFromSpreadsheet(
          WORKBOOK_PATH,
          row
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(employee, null, 2),
            },
          ],
          structuredContent: employee,
        };
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown spreadsheet error.";

        return {
          isError: true,
          content: [
            {
              type: "text",
              text: message,
            },
          ],
        };
      }
    }
  );
}