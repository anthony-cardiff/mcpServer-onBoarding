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
  sendGmailMessage,
} from "../services/gmail.js";

import {
  buildSlackInviteEmailHtml,
  buildSlackInviteEmailSubject,
  buildSlackInviteEmailText,
} from "../templates/slackInviteEmail.js";

import "dotenv/config";


/*
 * ============================================
 * ENVIRONMENT CONFIGURATION
 * ============================================
 */

function requireEnv(
  name: string
): string {

  const value =
    process.env[name];

  if (!value) {
    throw new Error(
      `${name} is not configured in .env.`
    );
  }

  return value;
}


const SLACK_WORKSPACE_URL =
  requireEnv(
    "SLACK_WORKSPACE_URL"
  );


const SLACK_INVITE_FROM_EMAIL =
  requireEnv(
    "SLACK_INVITE_FROM_EMAIL"
  );


const SLACK_INVITE_FROM_NAME =
  process.env
    .SLACK_INVITE_FROM_NAME ??
  "Anthony Daddario";


/*
 * ============================================
 * REGISTER SLACK INVITE EMAIL TOOLS
 * ============================================
 */

export function registerSlackInviteEmailTools(
  server: McpServer
) {

  /*
   * ============================================
   * PREVIEW SLACK INVITE EMAIL
   * ============================================
   *
   * Completely read-only.
   *
   * The email is sent to the employee's
   * Cardiff email address.
   */
  server.registerTool(
    "preview_slack_invite_email",
    {
      description:
        "Preview the Slack access email that would be sent to a Cardiff new hire's Cardiff email address. Includes the Cardiff Slack workspace URL and Google SSO instructions. Does not send anything.",

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


        /*
         * ============================================
         * VALIDATE REQUIRED DATA
         * ============================================
         */

        if (!employee.firstName) {
          throw new Error(
            `Row ${row} is missing First Name.`
          );
        }


        if (!employee.cardiffEmail) {
          throw new Error(
            `Row ${row} is missing GM User / Cardiff email.`
          );
        }


        /*
         * ============================================
         * BUILD EMAIL
         * ============================================
         */

        const templateInput = {
          firstName:
            employee.firstName,

          cardiffEmail:
            employee.cardiffEmail,

          slackWorkspaceUrl:
            SLACK_WORKSPACE_URL,
        };


        const subject =
          buildSlackInviteEmailSubject(
            templateInput
          );


        const text =
          buildSlackInviteEmailText(
            templateInput
          );


        const html =
          buildSlackInviteEmailHtml(
            templateInput
          );


        /*
         * ============================================
         * BUILD PREVIEW RESPONSE
         * ============================================
         */

        const preview = {
          row,

          from:
            SLACK_INVITE_FROM_EMAIL,

          to:
            employee.cardiffEmail,

          firstName:
            employee.firstName,

          cardiffEmail:
            employee.cardiffEmail,

          slackWorkspaceUrl:
            SLACK_WORKSPACE_URL,

          subject,

          text,

          html,

          readyToSend:
            true,
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
            : "Unknown Slack invite email preview error.";


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
   * SEND SLACK INVITE EMAIL
   * ============================================
   *
   * Sends through Anthony's authenticated
   * Cardiff Gmail account.
   *
   * The message is sent to the employee's
   * Cardiff email.
   *
   * Requires explicit confirmation.
   */
  server.registerTool(
    "send_slack_invite_email",
    {
      description:
        "Send the Cardiff Slack access email to the new hire's Cardiff email address using Anthony's authenticated Cardiff Gmail account. Requires explicit confirmation.",

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
                "Must be true to confirm sending the Slack invite email."
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


        /*
         * ============================================
         * VALIDATE REQUIRED DATA
         * ============================================
         */

        if (!employee.firstName) {
          throw new Error(
            `Row ${row} is missing First Name.`
          );
        }


        if (!employee.cardiffEmail) {
          throw new Error(
            `Row ${row} is missing GM User / Cardiff email.`
          );
        }


        /*
         * ============================================
         * BUILD EMAIL
         * ============================================
         */

        const templateInput = {
          firstName:
            employee.firstName,

          cardiffEmail:
            employee.cardiffEmail,

          slackWorkspaceUrl:
            SLACK_WORKSPACE_URL,
        };


        const subject =
          buildSlackInviteEmailSubject(
            templateInput
          );


        const text =
          buildSlackInviteEmailText(
            templateInput
          );


        const html =
          buildSlackInviteEmailHtml(
            templateInput
          );


        /*
         * ============================================
         * SEND EMAIL
         * ============================================
         */

        const sent =
          await sendGmailMessage({
            fromEmail:
              SLACK_INVITE_FROM_EMAIL,

            fromName:
              SLACK_INVITE_FROM_NAME,

            to:
              employee.cardiffEmail,

            subject,

            text,

            html,
          });


        /*
         * ============================================
         * SUCCESS RESPONSE
         * ============================================
         */

        const result = {
          success:
            true,

          sent:
            true,

          reason:
            "SLACK_INVITE_EMAIL_SENT",

          row,

          from:
            SLACK_INVITE_FROM_EMAIL,

          to:
            employee.cardiffEmail,

          subject,

          slackWorkspaceUrl:
            SLACK_WORKSPACE_URL,

          messageId:
            sent.messageId,

          threadId:
            sent.threadId,
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
            : "Unknown Slack invite email send error.";


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