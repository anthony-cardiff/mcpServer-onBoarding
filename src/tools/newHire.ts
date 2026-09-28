import type {
  McpServer,
} from "@modelcontextprotocol/server";

import * as z from "zod/v4";

import {
  getGoogleSheetRow,
} from "../services/googleSheets.js";

import {
  mapRowToNewHire,
} from "../services/spreadsheet.js";


export function registerNewHireTools(
  server: McpServer
) {
  server.registerTool(
    "get_new_hire",
    {
      description:
        "Read a new employee from a specific row of the live Cardiff Rep Credentials Google Sheet. Returns employee and provisioning information but does not return passwords.",

      inputSchema:
        z.object({
          row: z
            .number()
            .int()
            .min(2)
            .describe(
              "The spreadsheet row number to retrieve."
            ),
        }),
    },

    async ({ row }) => {
      try {
        /*
         * 1. Read the LIVE Google Sheet row.
         */
        const rawRow =
          await getGoogleSheetRow(
            row
          );

        /*
         * 2. Translate Google's column names
         *    into our NewHire structure.
         */
        const employee =
          mapRowToNewHire(
            rawRow,
            row
          );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                employee,
                null,
                2
              ),
            },
          ],

          structuredContent:
            employee,
        };
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown Google Sheets error.";

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