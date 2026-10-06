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
  createSlackUser,
  findSlackUserByEmail,
} from "../services/slackScim.js";


export function registerSlackUserTools(
  server: McpServer
) {

  /*
   * ============================================
   * PREVIEW SLACK USER
   * ============================================
   *
   * Completely read-only.
   */
  server.registerTool(
    "preview_slack_user",
    {
      description:
        "Preview Slack provisioning for a Cardiff new hire. Checks whether the Cardiff email already exists in Slack. Does not create or modify anything.",

      inputSchema:
        z.object({
          row:
            z
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

        /*
         * ============================================
         * READ EMPLOYEE
         * ============================================
         */

        const rawRow =
          await getGoogleSheetRow(
            row
          );


        const employee =
          mapRowToNewHire(
            rawRow,
            row
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


        /*
         * ============================================
         * CHECK EXISTING SLACK USER
         * ============================================
         */

        const existingUser =
          await findSlackUserByEmail(
            employee.cardiffEmail
          );


        const preview = {
          row,

          firstName:
            employee.firstName,

          lastName:
            employee.lastName,

          email:
            employee.cardiffEmail,

          title:
            employee.title,

          existingUser:
            existingUser
              ? {
                  id:
                    existingUser.id,

                  userName:
                    existingUser.userName,

                  active:
                    existingUser.active,
                }
              : false,

          readyToCreate:
            !existingUser,
        };


        return {
          content: [
            {
              type:
                "text",

              text:
                JSON.stringify(
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
            : "Unknown Slack preview error.";


        return {
          isError:
            true,

          content: [
            {
              type:
                "text",

              text:
                message,
            },
          ],
        };
      }
    }
  );


  /*
   * ============================================
   * CREATE SLACK USER
   * ============================================
   *
   * Creates a Slack workspace member through
   * Slack SCIM.
   *
   * Cardiff uses Google Workspace SSO, so no
   * Slack password is generated or stored.
   */
  server.registerTool(
    "create_slack_user",
    {
      description:
        "Create the Slack member for a Cardiff new hire through Slack SCIM using their Cardiff email. Cardiff uses Google Workspace SSO, so no Slack password is created. Requires explicit confirmation.",

      inputSchema:
        z.object({
          row:
            z
              .number()
              .int()
              .min(2),

          confirm:
            z
              .literal(
                true
              )
              .describe(
                "Must be true to confirm Slack member creation."
              ),
        }),
    },

    async ({ row }) => {
      try {

        /*
         * ============================================
         * READ EMPLOYEE
         * ============================================
         */

        const rawRow =
          await getGoogleSheetRow(
            row
          );


        const employee =
          mapRowToNewHire(
            rawRow,
            row
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


        /*
         * ============================================
         * DUPLICATE PROTECTION
         * ============================================
         */

        const existingUser =
          await findSlackUserByEmail(
            employee.cardiffEmail
          );


        if (existingUser) {
          const result = {
            success:
              true,

            created:
              false,

            reason:
              "USER_ALREADY_EXISTS",

            row,

            user: {
              id:
                existingUser.id,

              userName:
                existingUser.userName,

              email:
                employee.cardiffEmail,

              active:
                existingUser.active,
            },
          };


          return {
            content: [
              {
                type:
                  "text",

                text:
                  JSON.stringify(
                    result,
                    null,
                    2
                  ),
              },
            ],

            structuredContent:
              result,
          };
        }


        /*
         * ============================================
         * CREATE SLACK MEMBER
         * ============================================
         */

        const createdUser =
          await createSlackUser({
            email:
              employee.cardiffEmail,

            firstName:
              employee.firstName,

            lastName:
              employee.lastName,

            title:
              employee.title,
          });


        const result = {
          success:
            true,

          created:
            true,

          reason:
            "USER_CREATED",

          row,

          user: {
            id:
              createdUser.id,

            userName:
              createdUser.userName,

            email:
              employee.cardiffEmail,

            active:
              createdUser.active,

            name:
              createdUser.name,
          },

          authentication:
            "GOOGLE_WORKSPACE_SSO",

          passwordCreated:
            false,
        };


        return {
          content: [
            {
              type:
                "text",

              text:
                JSON.stringify(
                  result,
                  null,
                  2
                ),
            },
          ],

          structuredContent:
            result,
        };

      } catch (error) {

        const message =
          error instanceof Error
            ? error.message
            : "Unknown Slack creation error.";


        return {
          isError:
            true,

          content: [
            {
              type:
                "text",

              text:
                message,
            },
          ],
        };
      }
    }
  );
}