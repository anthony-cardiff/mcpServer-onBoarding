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
  getEmployeeCredential,
} from "../services/credentials.js";

import {
  assignSalesforcePermissionSetGroup,
  createSalesforceUser,
  findSalesforcePermissionSetGroup,
  findSalesforceProfileByName,
  findSalesforceRoleByName,
  findSalesforceUserByUsername,
  setSalesforceUserPassword,
} from "../services/salesforceApi.js";


export function registerSalesforceUserTools(
  server: McpServer
) {

  /*
   * ============================================
   * PREVIEW SALESFORCE USER
   * ============================================
   *
   * Completely read-only.
   */
  server.registerTool(
    "preview_salesforce_user",
    {
      description:
        "Preview Salesforce provisioning for a Cardiff new hire. Reads the live Rep Credentials Google Sheet and Salesforce production org. Checks the existing user, Profile, Role, Permission Set Groups, and password availability. Does not create or modify anything.",

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


        if (
          !employee.firstName ||
          !employee.lastName
        ) {
          throw new Error(
            `Row ${row} is missing the employee's first or last name.`
          );
        }


        /*
         * ============================================
         * CHECK SALESFORCE REQUIREMENT
         * ============================================
         */

        const salesforceRequired =
          Boolean(
            employee.salesforce
              .userRequired
          );


        const username =
          employee.salesforce
            .username ??
          employee.cardiffEmail;


        if (!salesforceRequired) {
          const preview = {
            row,

            firstName:
              employee.firstName,

            lastName:
              employee.lastName,

            salesforceRequired:
              false,

            username,

            existingUser:
              false,

            readyToCreate:
              false,

            reason:
              "SALESFORCE_NOT_REQUIRED",
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


        if (!username) {
          throw new Error(
            `Row ${row} requires Salesforce but does not contain a Salesforce username / GM User.`
          );
        }


        /*
         * ============================================
         * CHECK PASSWORD
         * ============================================
         */

        const sfPassword =
          await getEmployeeCredential(
            row,
            "sfPassword"
          );


        /*
         * ============================================
         * CHECK EXISTING USER
         * ============================================
         */

        const existingUser =
          await findSalesforceUserByUsername(
            username
          );


        /*
         * ============================================
         * RESOLVE PROFILE
         * ============================================
         */

        const requestedProfile =
          employee.salesforce
            .profile;


        const profile =
          requestedProfile
            ? await findSalesforceProfileByName(
                requestedProfile
              )
            : undefined;


        /*
         * ============================================
         * RESOLVE ROLE
         * ============================================
         */

        const requestedRole =
          employee.salesforce
            .role;


        const role =
          requestedRole
            ? await findSalesforceRoleByName(
                requestedRole
              )
            : undefined;


        /*
         * ============================================
         * RESOLVE PERMISSION SET GROUPS
         * ============================================
         */

        const requestedGroups =
          employee.salesforce
            .permissionSetGroups ??
          [];


        const resolvedGroups = [];


        for (
          const groupName
          of requestedGroups
        ) {
          const group =
            await findSalesforcePermissionSetGroup(
              groupName
            );


          resolvedGroups.push({
            requested:
              groupName,

            found:
              Boolean(
                group
              ),

            id:
              group?.Id,

            developerName:
              group?.DeveloperName,

            label:
              group?.MasterLabel,

            status:
              group?.Status,
          });
        }


        /*
         * ============================================
         * DETERMINE READINESS
         * ============================================
         */

        const profileReady =
          Boolean(
            requestedProfile &&
            profile
          );


        const roleReady =
          requestedRole
            ? Boolean(
                role
              )
            : true;


        const groupsReady =
          resolvedGroups.every(
            (group) =>
              group.found
          );


        const passwordAvailable =
          Boolean(
            sfPassword
          );


        const readyToCreate =
          Boolean(
            salesforceRequired &&
            username &&
            !existingUser &&
            profileReady &&
            roleReady &&
            groupsReady &&
            passwordAvailable
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

          salesforceRequired,

          username,

          passwordAvailable,

          existingUser:
            existingUser
              ? {
                  id:
                    existingUser.Id,

                  username:
                    existingUser.Username,

                  name:
                    existingUser.Name,

                  isActive:
                    existingUser.IsActive,

                  profileId:
                    existingUser.ProfileId,

                  userRoleId:
                    existingUser.UserRoleId,
                }
              : false,

          profile: {
            requested:
              requestedProfile,

            found:
              Boolean(
                profile
              ),

            id:
              profile?.Id,

            name:
              profile?.Name,
          },

          role: {
            requested:
              requestedRole,

            found:
              requestedRole
                ? Boolean(
                    role
                  )
                : true,

            id:
              role?.Id,

            name:
              role?.Name,
          },

          permissionSetGroups:
            resolvedGroups,

          readyToCreate,
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
            : "Unknown Salesforce preview error.";


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
   * CREATE SALESFORCE USER
   * ============================================
   *
   * Creates the Salesforce User record,
   * sets the employee's Salesforce password,
   * and assigns requested Permission Set Groups.
   *
   * Requires explicit confirmation.
   */
  server.registerTool(
    "create_salesforce_user",
    {
      description:
        "Create the Salesforce account for a Cardiff new hire using the live Rep Credentials row. Creates the Salesforce User, sets the stored SF Password internally, and assigns requested Permission Set Groups. Requires explicit confirmation.",

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
                "Must be true to confirm Salesforce account creation."
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
         * VALIDATE BASIC USER DATA
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
          !employee.salesforce
            .userRequired
        ) {
          throw new Error(
            `Row ${row} is not marked for Salesforce account creation.`
          );
        }


        const username =
          employee.salesforce
            .username ??
          employee.cardiffEmail;


        if (!username) {
          throw new Error(
            `Row ${row} is missing the Salesforce username / GM User.`
          );
        }


        /*
         * ============================================
         * CHECK FOR EXISTING USER
         * ============================================
         */

        const existingUser =
          await findSalesforceUserByUsername(
            username
          );


        if (existingUser) {
          const result = {
            success:
              false,

            created:
              false,

            reason:
              "USER_ALREADY_EXISTS",

            userId:
              existingUser.Id,

            username:
              existingUser.Username,

            isActive:
              existingUser.IsActive,
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
         * RETRIEVE SALESFORCE PASSWORD
         * ============================================
         */

        const sfPassword =
          await getEmployeeCredential(
            row,
            "sfPassword"
          );


        if (!sfPassword) {
          throw new Error(
            `Row ${row} does not contain an SF Password.`
          );
        }


        /*
         * ============================================
         * RESOLVE PROFILE
         * ============================================
         */

        const requestedProfile =
          employee.salesforce
            .profile;


        if (!requestedProfile) {
          throw new Error(
            `Row ${row} does not contain an SF Profile.`
          );
        }


        const profile =
          await findSalesforceProfileByName(
            requestedProfile
          );


        if (!profile) {
          throw new Error(
            `Salesforce Profile "${requestedProfile}" was not found.`
          );
        }


        /*
         * ============================================
         * RESOLVE ROLE
         * ============================================
         */

        const requestedRole =
          employee.salesforce
            .role;


        const role =
          requestedRole
            ? await findSalesforceRoleByName(
                requestedRole
              )
            : undefined;


        if (
          requestedRole &&
          !role
        ) {
          throw new Error(
            `Salesforce Role "${requestedRole}" was not found.`
          );
        }


        /*
         * ============================================
         * RESOLVE PERMISSION SET GROUPS
         * ============================================
         */

        const requestedGroups =
          employee.salesforce
            .permissionSetGroups ??
          [];


        const permissionSetGroups = [];


        for (
          const groupName
          of requestedGroups
        ) {
          const group =
            await findSalesforcePermissionSetGroup(
              groupName
            );


          if (!group) {
            throw new Error(
              `Salesforce Permission Set Group "${groupName}" was not found.`
            );
          }


          permissionSetGroups.push(
            group
          );
        }


        /*
         * ============================================
         * CREATE SALESFORCE USER
         * ============================================
         */

        const createdUser =
          await createSalesforceUser({
            firstName:
              employee.firstName,

            lastName:
              employee.lastName,

            username,

            email:
              employee.cardiffEmail ??
              username,

            profileId:
              profile.Id,

            userRoleId:
              role?.Id,
          });


        /*
         * ============================================
         * SET SALESFORCE PASSWORD
         * ============================================
         */

        await setSalesforceUserPassword(
          createdUser.id,
          sfPassword
        );


        /*
         * ============================================
         * ASSIGN PERMISSION SET GROUPS
         * ============================================
         */

        const groupAssignments = [];


        for (
          const group
          of permissionSetGroups
        ) {
          const assignmentId =
            await assignSalesforcePermissionSetGroup(
              createdUser.id,
              group.Id
            );


          groupAssignments.push({
            assignmentId,

            permissionSetGroupId:
              group.Id,

            developerName:
              group.DeveloperName,

            label:
              group.MasterLabel,
          });
        }


        /*
         * ============================================
         * BUILD SUCCESS RESPONSE
         * ============================================
         */

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

            username,

            alias:
              createdUser.alias,

            firstName:
              employee.firstName,

            lastName:
              employee.lastName,

            email:
              employee.cardiffEmail ??
              username,

            profile: {
              id:
                profile.Id,

              name:
                profile.Name,
            },

            role:
              role
                ? {
                    id:
                      role.Id,

                    name:
                      role.Name,
                  }
                : null,
          },

          passwordSet:
            true,

          passwordReturned:
            false,

          permissionSetGroups:
            groupAssignments,
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
            : "Unknown Salesforce creation error.";


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