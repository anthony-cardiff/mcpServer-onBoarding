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
  createZoomUser,
  ensureZoomUserInGroup,
  findZoomGroupByName,
  findZoomUserByEmail,
  getZoomUserProvisioningState,
  updateZoomUserDefaults,
} from "../services/zoomApi.js";


const DEFAULT_ZOOM_GROUP =
  "Everyone";


export function registerZoomUserTools(
  server: McpServer
) {

  /*
   * ============================================
   * PREVIEW ZOOM USER
   * ============================================
   *
   * Completely read-only.
   *
   * Standard Cardiff Zoom configuration:
   *
   * - Zoom Workplace: Unassigned
   * - Zoom Phone Basic: enabled
   * - Job Title: Rep Credentials Title
   * - User Group: Everyone
   */
  server.registerTool(
    "preview_zoom_user",
    {
      description:
        "Preview Zoom provisioning for a Cardiff new hire. Checks whether the user exists and resolves the standard Cardiff Zoom configuration: Unassigned Zoom Workplace, Zoom Phone Basic, spreadsheet Job Title, and Everyone group membership. Does not create or modify anything.",

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
         * VALIDATE EMPLOYEE
         * ============================================
         */

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


        /*
         * ============================================
         * CHECK ZOOM REQUIREMENT
         * ============================================
         */

        const zoomRequired =
          Boolean(
            employee.zoom
              .accountRequired
          );


        const directLineRequired =
          Boolean(
            employee.zoom
              .directLineRequired
          );


        if (!zoomRequired) {

          const preview = {
            row,

            firstName:
              employee.firstName,

            lastName:
              employee.lastName,

            zoomRequired:
              false,

            directLineRequired,


            readyToCreate:
              false,

            reason:
              "ZOOM_NOT_REQUIRED",
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
        }


        /*
         * ============================================
         * VALIDATE EMAIL
         * ============================================
         */

        if (!employee.cardiffEmail) {
          throw new Error(
            `Row ${row} requires Zoom but does not contain GM User / Cardiff email.`
          );
        }


        /*
         * ============================================
         * RESOLVE EVERYONE GROUP
         * ============================================
         */

        const everyoneGroup =
          await findZoomGroupByName(
            DEFAULT_ZOOM_GROUP
          );


        if (!everyoneGroup) {
          throw new Error(
            `Zoom group "${DEFAULT_ZOOM_GROUP}" was not found.`
          );
        }


        /*
         * ============================================
         * CHECK EXISTING USER
         * ============================================
         */

        const existingUser =
          await findZoomUserByEmail(
            employee.cardiffEmail
          );


        /*
         * ============================================
         * CHECK ACTIVATION / PHONE READINESS
         * ============================================
         */

        const provisioningState =
          await getZoomUserProvisioningState(
            existingUser
          );


        /*
         * ============================================
         * BUILD PREVIEW
         * ============================================
         */

        const preview = {
          row,

          firstName:
            employee.firstName,

          lastName:
            employee.lastName,

          email:
            employee.cardiffEmail,

          zoomRequired,

          directLineRequired,


          standardConfiguration: {
            zoomWorkplace:
              "UNASSIGNED",

            zoomUserType:
              4,

            zoomPhoneBasic:
              true,

            jobTitle:
              employee.title,

            group: {
              id:
                everyoneGroup.id,

              name:
                everyoneGroup.name,
            },
          },

          existingUser:
            existingUser
              ? {
                  id:
                    existingUser.id,

                  email:
                    existingUser.email,

                  firstName:
                    existingUser.first_name,

                  lastName:
                    existingUser.last_name,

                  status:
                    existingUser.status,

                  type:
                    existingUser.type,

                  role:
                    existingUser.role_name,

                  jobTitle:
                    existingUser.job_title,

                  groupIds:
                    existingUser.group_ids,

                  verified:
                    existingUser.verified,

                  loginTypes:
                    existingUser.login_types,
                }
              : false,

          activation: {
            status:
              provisioningState.status,

            activationRequired:
              provisioningState.activationRequired,

            readyForPhoneProvisioning:
              provisioningState.readyForPhoneProvisioning,
          },

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
            : "Unknown Zoom preview error.";


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
   * CREATE / REPAIR ZOOM USER
   * ============================================
   *
   * Standard Cardiff configuration:
   *
   * - Zoom Workplace: Unassigned
   * - Zoom Phone Basic: enabled
   * - Job Title: from Rep Credentials
   * - Group: Everyone
   *
   * Existing users are reused and repaired
   * rather than duplicated.
   */
  server.registerTool(
    "create_zoom_user",
    {
      description:
        "Create or repair the Zoom account for a Cardiff new hire. Applies the standard Cardiff Zoom configuration: Unassigned Zoom Workplace, Zoom Phone Basic enabled, Job Title from Rep Credentials, and Everyone group membership. Requires explicit confirmation.",

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
                "Must be true to confirm Zoom account creation or repair."
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


        if (!employee.lastName) {
          throw new Error(
            `Row ${row} is missing Last Name.`
          );
        }


        if (
          !employee.zoom
            .accountRequired
        ) {
          throw new Error(
            `Row ${row} is not marked for Zoom account creation.`
          );
        }


        if (!employee.cardiffEmail) {
          throw new Error(
            `Row ${row} is missing GM User / Cardiff email.`
          );
        }


        /*
         * ============================================
         * RESOLVE EVERYONE GROUP
         * ============================================
         */

        const everyoneGroup =
          await findZoomGroupByName(
            DEFAULT_ZOOM_GROUP
          );


        if (!everyoneGroup) {
          throw new Error(
            `Zoom group "${DEFAULT_ZOOM_GROUP}" was not found.`
          );
        }


        /*
         * ============================================
         * CHECK FOR EXISTING USER
         * ============================================
         */

        let zoomUser =
          await findZoomUserByEmail(
            employee.cardiffEmail
          );


        let userCreated =
          false;


        /*
         * ============================================
         * CREATE USER IF NEEDED
         * ============================================
         */

        if (!zoomUser) {

          zoomUser =
            await createZoomUser({
              email:
                employee.cardiffEmail,

              firstName:
                employee.firstName,

              lastName:
                employee.lastName,

              jobTitle:
                employee.title,
            });


          userCreated =
            true;
        }


        if (!zoomUser.id) {
          throw new Error(
            "Zoom User ID is missing after provisioning."
          );
        }


        /*
         * ============================================
         * APPLY STANDARD CARDIFF SETTINGS
         * ============================================
         *
         * Runs for both new and existing users,
         * which makes provisioning repairable.
         */

        await updateZoomUserDefaults(
          zoomUser.id,
          {
            jobTitle:
              employee.title,
          }
        );


        /*
         * ============================================
         * ENSURE EVERYONE GROUP
         * ============================================
         */

        const groupResult =
          await ensureZoomUserInGroup(
            zoomUser.id,
            employee.cardiffEmail,
            everyoneGroup.id
          );


        /*
         * ============================================
         * VERIFY FINAL USER
         * ============================================
         */

        const verifiedUser =
          await findZoomUserByEmail(
            employee.cardiffEmail
          );


        if (!verifiedUser) {
          throw new Error(
            `Zoom user ${employee.cardiffEmail} could not be verified after provisioning.`
          );
        }


        /*
         * ============================================
         * CHECK ACTIVATION / PHONE READINESS
         * ============================================
         */

        const provisioningState =
          await getZoomUserProvisioningState(
            verifiedUser
          );


        /*
         * ============================================
         * SUCCESS RESPONSE
         * ============================================
         */

        const result = {
          success:
            true,

          created:
            userCreated,

          repaired:
            !userCreated,

          reason:
            userCreated
              ? "USER_CREATED"
              : "USER_REPAIRED",

          row,

          user: {
            id:
              verifiedUser.id,

            email:
              verifiedUser.email,

            firstName:
              verifiedUser.first_name,

            lastName:
              verifiedUser.last_name,

            status:
              verifiedUser.status,

            jobTitle:
              verifiedUser.job_title,

            zoomWorkplace:
              "UNASSIGNED",

            zoomUserType:
              verifiedUser.type,

            zoomPhoneBasic:
              true,
          },

          group: {
            id:
              everyoneGroup.id,

            name:
              everyoneGroup.name,

            alreadyAssigned:
              groupResult.alreadyAssigned,

            assignedNow:
              groupResult.assignedNow,
          },

          activation: {
            status:
              provisioningState.status,

            activationRequired:
              provisioningState.activationRequired,

            readyForPhoneProvisioning:
              provisioningState.readyForPhoneProvisioning,
          },

          directLineRequired:
            Boolean(
              employee.zoom
                .directLineRequired
            ),

          /*
           * Direct Line is intentionally
           * not provisioned by this tool.
           *
           * We will handle Zoom Phone separately.
           */
          phoneProvisioningComplete:
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
            : "Unknown Zoom creation or repair error.";


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