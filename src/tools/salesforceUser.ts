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
  createSalesforceUser,
  ensureSalesforcePermissionSetGroup,
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
   *
   * This tool:
   *
   * - Reads Rep Credentials
   * - Checks whether Salesforce is required
   * - Checks whether the username already exists
   * - Resolves Profile
   * - Resolves Role
   * - Resolves Permission Set Groups
   * - Checks whether SF Password is available
   *
   * It does NOT create or modify anything.
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


        /*
         * ============================================
         * BASIC VALIDATION
         * ============================================
         */

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


        /*
         * If Salesforce is not required,
         * return a normal preview instead
         * of treating that as an error.
         */
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


        /*
         * ============================================
         * VALIDATE USERNAME
         * ============================================
         */

        if (!username) {
          throw new Error(
            `Row ${row} requires Salesforce but does not contain a Salesforce username / GM User.`
          );
        }


        /*
         * ============================================
         * CHECK SF PASSWORD
         * ============================================
         */

        const sfPassword =
          await getEmployeeCredential(
            row,
            "sfPassword"
          );


        /*
         * ============================================
         * CHECK EXISTING SALESFORCE USER
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


        /*
         * Role is optional if Rep Credentials
         * does not specify one.
         */
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
         * BUILD PREVIEW RESPONSE
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
   * CREATE / REPAIR SALESFORCE USER
   * ============================================
   *
   * Idempotent Salesforce provisioning.
   *
   * If the User does not exist:
   *
   * - Create the User
   * - Set password
   * - Assign missing Permission Set Groups
   *
   * If the User already exists:
   *
   * - Reuse the existing User
   * - Set/reset the password from Rep Credentials
   * - Assign only missing Permission Set Groups
   *
   * This allows a failed onboarding attempt
   * to safely resume without creating duplicates.
   */
  server.registerTool(
    "create_salesforce_user",
    {
      description:
        "Create or repair the Salesforce account for a Cardiff new hire using the live Rep Credentials row. If the Salesforce User already exists, the tool resumes provisioning by resetting the password from the stored SF Password and assigning any missing Permission Set Groups. Requires explicit confirmation.",

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
                "Must be true to confirm Salesforce account creation or repair."
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
         * VALIDATE EMPLOYEE DATA
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
         * GET SALESFORCE PASSWORD
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
         * CHECK FOR EXISTING USER
         * ============================================
         */

        const existingUser =
          await findSalesforceUserByUsername(
            username
          );


        let userId:
          string;


        let alias:
          string | undefined;


        let userCreated =
          false;


        /*
         * ============================================
         * EXISTING USER
         * ============================================
         *
         * Do not stop provisioning.
         *
         * Reuse the existing User Id and continue
         * with password + Permission Set Groups.
         */

        if (existingUser) {

          userId =
            existingUser.Id;


          /*
           * ============================================
           * SAFETY CHECK: PROFILE
           * ============================================
           *
           * If the existing User has a different
           * Profile than Rep Credentials expects,
           * stop instead of silently changing it.
           */

          if (
            existingUser.ProfileId &&
            existingUser.ProfileId !==
              profile.Id
          ) {
            throw new Error(
              `Existing Salesforce User ${username} has ProfileId ${existingUser.ProfileId}, but Rep Credentials requires ${profile.Id} (${profile.Name}). No changes were made to the Profile.`
            );
          }


          /*
           * ============================================
           * SAFETY CHECK: ROLE
           * ============================================
           *
           * Same approach for Role.
           */

          if (
            role &&
            existingUser.UserRoleId &&
            existingUser.UserRoleId !==
              role.Id
          ) {
            throw new Error(
              `Existing Salesforce User ${username} has UserRoleId ${existingUser.UserRoleId}, but Rep Credentials requires ${role.Id} (${role.Name}). No changes were made to the Role.`
            );
          }

        } else {

          /*
           * ============================================
           * CREATE NEW SALESFORCE USER
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


          userId =
            createdUser.id;


          alias =
            createdUser.alias;


          userCreated =
            true;
        }


        /*
         * ============================================
         * SET / RESET SALESFORCE PASSWORD
         * ============================================
         *
         * This intentionally runs whether the
         * User was created now or already existed.
         *
         * That allows a partially completed
         * onboarding to resume safely using the
         * SF Password stored in Rep Credentials.
         */

        const passwordResult =
          await setSalesforceUserPassword(
            userId,
            sfPassword
          );


        /*
         * ============================================
         * ENSURE PERMISSION SET GROUPS
         * ============================================
         *
         * Existing assignments are retained.
         *
         * Missing assignments are created.
         */

        const groupAssignments = [];


        for (
          const group
          of permissionSetGroups
        ) {

          const assignment =
            await ensureSalesforcePermissionSetGroup(
              userId,
              group.Id
            );


          groupAssignments.push({
            assignmentId:
              assignment.assignmentId,

            permissionSetGroupId:
              group.Id,

            developerName:
              group.DeveloperName,

            label:
              group.MasterLabel,

            alreadyAssigned:
              !assignment.created,

            assignedNow:
              assignment.created,
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
              userId,

            username,

            alias:
              alias,

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
            passwordResult.passwordSet,

          passwordAlreadyCurrent:
            passwordResult.alreadyCurrent,

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
            : "Unknown Salesforce creation or repair error.";


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