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

import {
  googleWorkspaceUserExists,
  createGoogleWorkspaceUser,
} from "../services/googleAdmin.js";

import {
  getEmployeeCredential,
} from "../services/credentials.js";


function cleanValue(
  value: unknown
): string | undefined {
  if (
    value === undefined ||
    value === null
  ) {
    return undefined;
  }

  const cleaned =
    String(value).trim();

  return cleaned === ""
    ? undefined
    : cleaned;
}


export function registerGoogleUserTools(
  server: McpServer
) {

  /*
   * ============================================
   * PREVIEW GOOGLE USER
   * ============================================
   *
   * Completely read-only.
   */
  server.registerTool(
    "preview_google_user",
    {
      description:
        "Preview the Google Workspace account that would be created for a Cardiff new hire. Reads the live Rep Credentials Google Sheet and checks whether the user already exists. Does not create or modify anything.",

      inputSchema:
        z.object({
          row: z
            .number()
            .int()
            .min(2)
            .describe(
              "Spreadsheet row containing the new hire."
            ),
        }),
    },

    async ({ row }) => {
      try {
        const rawRow =
          await getGoogleSheetRow(
            row
          );

        const employee =
          mapRowToNewHire(
            rawRow,
            row
          );

        if (
          !employee.firstName ||
          !employee.lastName
        ) {
          throw new Error(
            `Row ${row} is missing the employee's first or last name.`
          );
        }

        if (!employee.cardiffEmail) {
          throw new Error(
            `Row ${row} does not contain a Cardiff email address.`
          );
        }

        const gmPassword =
          await getEmployeeCredential(
            row,
            "gmPassword"
        );

        const exists =
          await googleWorkspaceUserExists(
            employee.cardiffEmail
          );

        const preview = {
          row,

          firstName:
            employee.firstName,

          lastName:
            employee.lastName,

          primaryEmail:
            employee.cardiffEmail,

          personalEmail:
            employee.personalEmail,

          passwordAvailable:
            Boolean(gmPassword),

          changePasswordAtNextLogin:
            false,

          existingAccount:
            exists,

          readyToCreate:
            Boolean(
              employee.firstName &&
              employee.lastName &&
              employee.cardiffEmail &&
              gmPassword &&
              !exists
            ),
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                preview,
                null,
                2
              ),
            },
          ],

          structuredContent:
            preview,
        };
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown Google Workspace preview error.";

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


  /*
   * ============================================
   * CREATE GOOGLE USER
   * ============================================
   */
  server.registerTool(
    "create_google_user",
    {
      description:
        "Create the Google Workspace account for a Cardiff new hire using the employee's live Rep Credentials row. Use only after the user has explicitly approved account creation. The employee password is retrieved internally and is not returned.",

      inputSchema:
        z.object({
          row: z
            .number()
            .int()
            .min(2),

          confirm: z
            .literal(true)
            .describe(
              "Must be true to confirm creation of the Google Workspace account."
            ),
        }),
    },

    async ({ row }) => {
      try {
        const rawRow =
          await getGoogleSheetRow(
            row
          );

        const employee =
          mapRowToNewHire(
            rawRow,
            row
        );

        const gmPassword =
          await getEmployeeCredential(
            row,
            "gmPassword"
        );

        if (!employee.firstName) {
          throw new Error(
            `Row ${row} is missing First Name.`
          );
        }

        if (!employee.lastName) {
          throw new Error(
            `Row ${row} is missing Last Name.`
          );
        }

        if (!employee.cardiffEmail) {
          throw new Error(
            `Row ${row} is missing GM User / Cardiff email.`
          );
        }

        if (!gmPassword) {
          throw new Error(
            `Row ${row} does not contain a GM Password.`
          );
        }

        const result =
          await createGoogleWorkspaceUser({
            primaryEmail:
              employee.cardiffEmail,

            firstName:
              employee.firstName,

            lastName:
              employee.lastName,

            password:
              gmPassword,

            recoveryEmail:
              employee.personalEmail,

            changePasswordAtNextLogin:
              false,
          });

        return {
          content: [
            {
              type: "text",

              text: JSON.stringify(
                {
                  success: true,

                  row,

                  userCreated: {
                    id:
                      result.id,

                    primaryEmail:
                      result.primaryEmail,

                    fullName:
                      result.fullName,

                    orgUnitPath:
                      result.orgUnitPath,
                  },

                  passwordReturned:
                    false,
                },
                null,
                2
              ),
            },
          ],

          structuredContent: {
            success: true,

            row,

            userCreated: {
              id:
                result.id,

              primaryEmail:
                result.primaryEmail,

              fullName:
                result.fullName,

              orgUnitPath:
                result.orgUnitPath,
            },

            passwordReturned:
              false,
          },
        };
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown Google Workspace creation error.";

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