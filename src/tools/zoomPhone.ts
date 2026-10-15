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
  findZoomUserByEmail,
  getZoomUserProvisioningState,
} from "../services/zoomApi.js";

import {
  assignZoomPhoneNumber,
  ensureZoomPhoneCallingPlan,
  getZoomPhoneNumber,
  getZoomPhoneUser,
  isEligibleZoomPhoneNumber,
  listEligibleZoomPhoneNumbers,
  resolveZoomPhoneNumberId,
  updateZoomPhoneNumberDisplayName,
  US_CA_UNLIMITED_PLAN,
  ZoomPhoneError,
} from "../services/zoomPhoneApi.js";


const PHONE_NUMBER_SORT_NOTE =
  "Zoom does not document a reliable number-created timestamp. Numbers are shown in API order; no newest-to-oldest sort is applied.";

const NEW_NUMBER_NOTE =
  "The public Zoom API does not document native number search or acquisition. In the Zoom portal, select area code 858 and city All locations to obtain a new US Toll number, then run provision_zoom_phone with phoneNumber set to the acquired number. The tool resolves its Zoom ID automatically. No existing number will be selected automatically.";

/*
 * ============================================
 * RESOLVE EMPLOYEE / ZOOM PHONE READINESS
 * ============================================
 *
 * Read the current row each time. Return only
 * the employee fields needed for phone setup.
 */

async function resolveZoomPhoneEmployee(
  row: number
) {

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
    !employee.firstName?.trim() ||
    !employee.lastName?.trim() ||
    !employee.cardiffEmail?.trim()
  ) {
    throw new ZoomPhoneError(
      `Row ${row} requires First Name, Last Name, and GM User / Cardiff email.`
    );
  }


  if (!employee.zoom.accountRequired) {
    throw new ZoomPhoneError(
      `Row ${row} is not marked for a Zoom account.`
    );
  }


  const user =
    await findZoomUserByEmail(
      employee.cardiffEmail
    );

  const activation =
    await getZoomUserProvisioningState(
      user
    );

  const name =
    `${employee.firstName.trim()} ${employee.lastName.trim()}`;


  /*
   * Display Name keeps the full employee name.
   * Caller ID updates are deferred and do not
   * block phone provisioning.
   */
  const nameSupported =
    name.length <= 32;


  return {
    row,

    email:
      employee.cardiffEmail,

    name,

    displayName:
      name,

    nameSupported,

    userId:
      user?.id,

    activation,

    phoneRequired:
      Boolean(
        employee.zoom.directLineRequired
      ),
  };
}


function phoneToolResult(
  result: Record<string, unknown>,
  isError: boolean = false
) {

  return {
    ...(isError
      ? { isError: true }
      : {}),

    content: [
      {
        type:
          "text" as const,

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


export function registerZoomPhoneTools(
  server: McpServer
) {

  const provisioningUsers =
    new Set<string>();

  /*
   * ============================================
   * PREVIEW ZOOM PHONE OPTIONS
   * ============================================
   *
   * Completely read-only. Browse available numbers
   * or review one explicitly selected phone number.
   */
  server.registerTool(
    "preview_zoom_phone_options",
    {
      description:
        "Preview Zoom Phone setup for a spreadsheet row. Without phoneNumber, list eligible unassigned native Zoom Toll numbers and manual 858 acquisition instructions. With phoneNumber, validate only the selected number and existing user assignment. Does not modify anything.",

      inputSchema:
        z.object({
          row:
            z.number().int().min(2),

          phoneNumber:
            z.string().trim().optional()
              .describe(
                "Enter a phone number you have already selected to view its details only. Leave blank to browse available numbers."
              ),

        }),
    },

    async ({ row, phoneNumber }) => {
      try {
        const employee =
          await resolveZoomPhoneEmployee(
            row
          );

        const numbers =
          phoneNumber
            ? []
            : await listEligibleZoomPhoneNumbers();

        const phoneUser =
          employee.userId &&
          employee.activation.readyForPhoneProvisioning
            ? await getZoomPhoneUser(
                employee.userId
              )
            : undefined;


        const selectedNumberId =
          phoneNumber
            ? await resolveZoomPhoneNumberId(
                phoneNumber
              )
            : undefined;

        const selectedNumber =
          selectedNumberId
            ? await getZoomPhoneNumber(
                selectedNumberId
              )
            : undefined;

        const selectedNumberEligible =
          Boolean(
            selectedNumber &&
            (isEligibleZoomPhoneNumber(selectedNumber) ||
              (phoneUser?.phone_numbers?.some(
                (number) =>
                  number.id === selectedNumber.id
              ) &&
                selectedNumber.assigned_list?.length === 1 &&
                selectedNumber.assigned_list[0]?.assigned_to_id === employee.userId &&
                selectedNumber.assigned_list[0]?.assigned_to_type === "User" &&
                isEligibleZoomPhoneNumber({
                  ...selectedNumber,
                  assigned_list: [],
                }))) &&
            !phoneUser?.phone_numbers?.some(
              (number) =>
                number.id !== selectedNumber.id
            )
          );

        return phoneToolResult({
          ...employee,

          callerIdNameUpdateSkipped:
            true,

          callerIdNameNote:
            "Caller ID Name must be set manually in Zoom.",

          readyForPhoneProvisioning:
            Boolean(
              employee.userId &&
              employee.phoneRequired &&
              employee.nameSupported &&
              employee.activation.readyForPhoneProvisioning &&
              (phoneNumber
                ? selectedNumberEligible
                : !phoneUser?.phone_numbers?.length)
            ),

          nameValidationNote:
            employee.nameSupported
              ? "Display Name will use the employee's full name. Caller ID Name must be set manually in Zoom."
              : "The employee's full name exceeds Zoom's 32-character Display Name limit. Resolve this before provisioning.",

          callingPlan: {
            name:
              "US/CA Unlimited",

            type:
              US_CA_UNLIMITED_PLAN,
          },

          currentPhoneNumbers:
            phoneNumber
              ? (phoneUser?.phone_numbers ?? []).filter(
                  (number) =>
                    number.id === selectedNumberId
                )
              : phoneUser?.phone_numbers ?? [],

          ...(phoneNumber
            ? {
                selectedPhoneNumber:
                  selectedNumber?.number,

                selectedNumberEligible,

                selectedNumber: {
                  id:
                    selectedNumber?.id,

                  number:
                    selectedNumber?.number,

                  displayName:
                    selectedNumber?.display_name,

                  source:
                    selectedNumber?.source,

                  numberType:
                    selectedNumber?.number_type,

                  messagingEnabled:
                    Boolean(selectedNumber?.capability?.includes("Messaging")),

                  allocatedProduct:
                    selectedNumber?.allocated_product,

                  assignedTo:
                    selectedNumber?.assigned_list,
                },
              }
            : {
                availablePhoneNumbers:
                  numbers.map(
                    (number) => ({
                      id:
                        number.id,

                      number:
                        number.number,

                      displayName:
                        number.display_name,

                      source:
                        number.source,

                      numberType:
                        number.number_type,

                      messagingEnabled:
                        Boolean(number.capability?.includes("Messaging")),
                    })
                  ),

                phoneNumberSortNote:
                  PHONE_NUMBER_SORT_NOTE,

                newNumberAcquisition: {
                  areaCode:
                    "858",

                  city:
                    "All locations",

                  manualAcquisitionRequired:
                    true,

                  note:
                    NEW_NUMBER_NOTE,
                },
              }),
        });
      } catch (error) {
        return phoneToolResult({
          success:
            false,

          message:
            error instanceof ZoomPhoneError
              ? error.message
              : "Zoom phone preview failed. Check the spreadsheet and Zoom configuration; sensitive error details are withheld.",
        }, true);
      }
    }
  );


  /*
   * ============================================
   * PROVISION ZOOM PHONE
   * ============================================
   *
   * Baseline account creation stays separate.
   * Assign the plan, update Display Name,
   * then assign the explicitly selected number.
   */
  server.registerTool(
    "provision_zoom_phone",
    {
      description:
        "Assign US/CA Unlimited, set Display Name to employee first + last name, and assign the explicitly selected phoneNumber to the active Zoom user. Resolves the Zoom number ID automatically. Reuses existing plan and number assignments. Caller ID Name must be set manually in Zoom. Requires explicit confirmation.",

      inputSchema:
        z.object({
          row:
            z.number().int().min(2),

          confirm:
            z.literal(true)
              .describe(
                "Set to true to approve assigning US/CA Unlimited, updating Display Name, and assigning this phone number to the employee."
              ),

          phoneNumber:
            z.string().trim().min(1)
              .describe(
                "The explicitly selected phone number, for example +18585551234 or (858) 555-1234. Its Zoom ID is resolved automatically."
              ),

        }),
    },

    async ({ row, phoneNumber }) => {
      let selectedNumberId:
        string | undefined;

      let phoneProvisioningComplete =
        false;

      let lockedUserId:
        string | undefined;

      const progress = {
        callingPlanAssigned:
          false,

        displayNameUpdated:
          false,

        callerIdNameUpdated:
          false,

        callerIdNameUpdateSkipped:
          true,

        numberAssigned:
          false,

      };


      try {
        const employee =
          await resolveZoomPhoneEmployee(
            row
          );


        if (
          !employee.userId ||
          !employee.activation.readyForPhoneProvisioning
        ) {
          throw new ZoomPhoneError(
            "Create the baseline Zoom account and complete activation before provisioning Zoom Phone."
          );
        }


        if (!employee.phoneRequired) {
          throw new ZoomPhoneError(
            `Row ${row} is not marked for a Direct Line.`
          );
        }


        if (!employee.nameSupported) {
          throw new ZoomPhoneError(
            "The employee's full name must fit Zoom's 32-character Display Name limit. No changes were made."
          );
        }


        if (provisioningUsers.has(employee.userId)) {
          throw new ZoomPhoneError(
            "Zoom phone provisioning is already running for this user."
          );
        }

        lockedUserId =
          employee.userId;

        provisioningUsers.add(
          lockedUserId
        );


        /*
         * Resolve the explicitly entered number before
         * checking assignments or making any changes.
         */
        selectedNumberId =
          await resolveZoomPhoneNumberId(
            phoneNumber
          );


        const phoneUser =
          await getZoomPhoneUser(
            employee.userId
          );

        const currentNumbers =
          phoneUser.phone_numbers ?? [];

        const alreadyAssigned =
          Boolean(
            selectedNumberId &&
            currentNumbers.some(
              (number) =>
                number.id === selectedNumberId
            )
          );


        if (currentNumbers.some(
          (number) =>
            number.id !== selectedNumberId
        )) {
          throw new ZoomPhoneError(
            "The user already has a different phone number. Review it in Zoom before adding another number."
          );
        }


        const number =
          await getZoomPhoneNumber(
            selectedNumberId
          );


        if (number) {
          const eligible =
            alreadyAssigned
              ? isEligibleZoomPhoneNumber({
                  ...number,
                  assigned_list:
                    [],
                }) &&
                number.assigned_list?.length === 1 &&
                number.assigned_list[0]?.assigned_to_type === "User" &&
                number.assigned_list[0]?.assigned_to_id === employee.userId
              : isEligibleZoomPhoneNumber(number);


          if (
            number.id !== selectedNumberId ||
            !eligible
          ) {
            throw new ZoomPhoneError(
              "The selected number is no longer eligible: it must be unassigned, source Zoom, type Toll, and allocated to Zoom Phone."
            );
          }
        }


        const callingPlanAssignedNow =
          await ensureZoomPhoneCallingPlan(
            employee.userId,
            phoneUser
          );

        progress.callingPlanAssigned =
          true;


        /*
         * Recheck assignment immediately before
         * replacing names; never take another user's
         * number after a stale preview.
         */
        const currentNumber =
          await getZoomPhoneNumber(
            number.id
          );

        const assignmentUnchanged =
          alreadyAssigned
            ? JSON.stringify(currentNumber.assigned_list) ===
              JSON.stringify(number.assigned_list)
            : isEligibleZoomPhoneNumber(currentNumber);


        if (!assignmentUnchanged) {
          throw new ZoomPhoneError(
            "The selected number's assignment changed. Preview again before retrying."
          );
        }


        await updateZoomPhoneNumberDisplayName(
          number.id,
          employee.displayName
        );

        progress.displayNameUpdated =
          true;


        /*
         * Verify Display Name before assigning a number.
         * Caller ID Name is deliberately left unchanged.
         */
        const namedNumber =
          await getZoomPhoneNumber(
            number.id
          );


        if (namedNumber.display_name !== employee.displayName) {
          throw new ZoomPhoneError(
            "Zoom has not verified Display Name after the update. The number was not assigned by this run. Review Display Name in Zoom before retrying."
          );
        }


        if (!alreadyAssigned) {
          await assignZoomPhoneNumber(
            employee.userId,
            number
          );
        }

        progress.numberAssigned =
          true;


        const verifiedUser =
          await getZoomPhoneUser(
            employee.userId
          );

        const verifiedNumber =
          await getZoomPhoneNumber(
            number.id
          );


        if (
          !verifiedUser.calling_plans?.some(
            (plan) =>
              plan.type === US_CA_UNLIMITED_PLAN
          ) ||
          !verifiedUser.phone_numbers?.some(
            (item) =>
              item.id === number.id
          ) ||
          verifiedNumber.display_name !== employee.displayName
        ) {
          throw new ZoomPhoneError(
            "Zoom has not verified the calling plan, number assignment, and Display Name. Review the reported progress in Zoom before retrying with the same phoneNumber."
          );
        }


        phoneProvisioningComplete =
          true;


        return phoneToolResult({
          success:
            true,

          row,

          userId:
            employee.userId,

          phoneNumberId:
            number.id,

          phoneNumber:
            number.number,

          displayName:
            employee.displayName,

          callingPlan:
            "US/CA Unlimited",

          callingPlanAssignedNow,

          callerIdNameNote:
            "Caller ID Name must be set manually in Zoom.",

          alreadyAssigned,

          ...progress,

          phoneProvisioningComplete:
            true,


        });
      } catch (error) {
        return phoneToolResult({
          success:
            false,

          row,

          phoneNumberId:
            selectedNumberId,

          ...progress,

          phoneProvisioningComplete,

          message:
            error instanceof ZoomPhoneError
              ? error.message
              : "Zoom phone provisioning failed. Check the spreadsheet and Zoom configuration; sensitive error details are withheld.",

          retryNote:
            "Review progress in Zoom before retrying. Reuse the same explicit phoneNumber; completed steps are not rolled back.",
        }, true);
      } finally {
        if (lockedUserId) {
          provisioningUsers.delete(
            lockedUserId
          );
        }
      }
    }
  );
}
