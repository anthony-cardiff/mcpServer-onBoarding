import {
  zoomFetch,
} from "./zoomOAuth.js";


/*
 * ============================================
 * ZOOM PHONE TYPES / CALLING PLAN
 * ============================================
 *
 * Public API references verified 2026-10-14:
 * https://developers.zoom.us/docs/api/phone/
 * https://developers.zoom.us/docs/api/number-management/
 * https://developers.zoom.us/docs/api/references/phone-calling-plans/
 */

export const US_CA_UNLIMITED_PLAN =
  200;


export interface ZoomPhoneNumberRecord {
  id:
    string;

  number:
    string;

  source?:
    string;

  number_type?:
    string;

  /*
   * Read-only information for preview output.
   * Does not control number eligibility or setup.
   */
  capability?:
    string[];

  allocated_product?:
    string;

  assigned_list?: {
    assigned_to_id?:
      string;

    assigned_to_type?:
      string;
  }[];

  display_name?:
    string;

  caller_id_name?:
    string;

  /*
   * Observed in this account's Zoom Phone responses,
   * although the public schema lists caller_id_name.
   */
  caller_name?:
    string;
}


export interface ZoomPhoneUserRecord {
  calling_plans?: {
    type:
      number;
  }[];

  phone_numbers?: {
    id:
      string;

    number:
      string;
  }[];
}


/*
 * ============================================
 * SAFE PHONE API ERRORS
 * ============================================
 *
 * Do not return raw API bodies, OAuth errors,
 * credentials, or unexpected exception messages.
 */

export class ZoomPhoneError extends Error {}


async function zoomPhoneRequest<T>(
  path: string,
  operation: string,
  init: RequestInit = {}
): Promise<T> {

  let response:
    Response;


  try {
    response =
      await zoomFetch(
        path,
        init
      );
  } catch {
    throw new ZoomPhoneError(
      `${operation} could not reach Zoom or authenticate. Check the server configuration.`
    );
  }


  if (!response.ok) {
    let zoomCode =
      "; Zoom error code unavailable";

    let validationReason =
      "";


    /*
     * Expose only numeric Zoom codes and fixed
     * diagnostic text, never raw response messages.
     */
    try {
      const error =
        await response.json() as {
          code?: unknown;
          message?: unknown;
        };


      if (
        (typeof error.code === "number" &&
          Number.isSafeInteger(error.code)) ||
        (typeof error.code === "string" &&
          /^\d{1,10}$/.test(error.code))
      ) {
        zoomCode =
          `; Zoom error code ${error.code}`;
      }


      if (typeof error.message === "string") {
        const message =
          error.message.toLowerCase();


        if (/caller[ _-]?id/.test(message)) {
          validationReason =
            " Zoom rejected the Caller ID field. Its availability and validation rules need to be checked for this Zoom Phone number.";
        } else if (/display[ _-]?name/.test(message)) {
          validationReason =
            " Zoom rejected the Display Name field.";
        } else if (/invalid field/.test(message)) {
          validationReason =
            " Zoom reports an invalid request field.";
        } else if (/scope/.test(message)) {
          validationReason =
            " Zoom reports a scope authorization problem.";
        }


        if (/upper[ -]?case/.test(message)) {
          validationReason +=
            " Zoom reports an uppercase requirement.";
        }
      }
    } catch {
      /*
       * Non-JSON errors retain the safe HTTP status.
       */
    }


    throw new ZoomPhoneError(
      `${operation} failed (HTTP ${response.status}${zoomCode}).${validationReason} Check Zoom permissions, scopes, and account configuration.`
    );
  }


  const body =
    await response.text();


  if (!body) {
    return undefined as T;
  }


  try {
    return JSON.parse(
      body
    ) as T;
  } catch {
    throw new ZoomPhoneError(
      `${operation} returned invalid JSON. Verify the state in Zoom before retrying.`
    );
  }
}


/*
 * ============================================
 * PHONE NUMBER ELIGIBILITY
 * ============================================
 *
 * Exact Number Management values. Fail closed
 * when assignment information is missing.
 * Contact Center numbers cannot be assigned here.
 */

export function isEligibleZoomPhoneNumber(
  number: ZoomPhoneNumberRecord
): boolean {

  return Boolean(
    number.id &&
    number.number &&
    Array.isArray(
      number.assigned_list
    ) &&
    number.assigned_list.length === 0 &&
    number.source === "Zoom" &&
    number.number_type === "Toll" &&
    number.allocated_product === "ZOOM_PHONE"
  );
}

/*
 * ============================================
 * LIST ZOOM PHONE NUMBER INVENTORY
 * ============================================
 *
 * Read every page; never select a number for reuse.
 * No created timestamp is documented. Preserve
 * API order rather than inventing an age sort.
 */

async function listZoomPhoneNumbers(
  unassignedOnly: boolean = false
): Promise<ZoomPhoneNumberRecord[]> {

  const numbers:
    ZoomPhoneNumberRecord[] = [];

  const seenTokens =
    new Set<string>();

  let nextPageToken =
    "";


  do {
    const query =
      new URLSearchParams({
        page_size:
          "100",

        allocated_product:
          "ZOOM_PHONE",
      });


    if (unassignedOnly) {
      query.set(
        "assigned_to_type",
        "PhoneUnassigned"
      );
    }


    if (nextPageToken) {
      query.set(
        "next_page_token",
        nextPageToken
      );
    }


    const data =
      await zoomPhoneRequest<{
        numbers:
          ZoomPhoneNumberRecord[];

        next_page_token?:
          string;
      }>(
        `/number_management/numbers?${query}`,
        "Zoom phone number lookup"
      );


    if (!Array.isArray(data?.numbers)) {
      throw new ZoomPhoneError(
        "Zoom did not return a phone number inventory."
      );
    }


    /*
     * Zoom can omit assigned_list for unassigned
     * numbers. Only the explicit PhoneUnassigned
     * query proves that an omitted list is empty.
     * Preserve nonempty or malformed lists so the
     * eligibility check can reject contradictions.
     */
    numbers.push(
      ...data.numbers.map(
        (number) =>
          unassignedOnly &&
          !Object.prototype.hasOwnProperty.call(
            number,
            "assigned_list"
          )
            ? {
                ...number,
                assigned_list:
                  [],
              }
            : number
      )
    );


    nextPageToken =
      data.next_page_token ?? "";


    if (nextPageToken) {
      if (seenTokens.has(nextPageToken)) {
        throw new ZoomPhoneError(
          "Zoom returned a repeated inventory page token."
        );
      }

      seenTokens.add(nextPageToken);
    }
  } while (nextPageToken);


  return numbers;
}


/*
 * ============================================
 * FILTER INVENTORY / RESOLVE NUMBER ID
 * ============================================
 *
 * Resolve only the human's exact phone number.
 * Search all pages before accepting one match.
 * Eligibility is checked separately so retries
 * can resolve a number already assigned to this user.
 */

export async function listEligibleZoomPhoneNumbers():
Promise<ZoomPhoneNumberRecord[]> {

  const numbers =
    await listZoomPhoneNumbers(
      true
    );


  return numbers.filter(
    isEligibleZoomPhoneNumber
  );
}


export function normalizeZoomPhoneNumber(
  phoneNumber: string
): string {

  let normalized =
    phoneNumber.trim();


  if (!/^[+\d\s().-]+$/.test(normalized)) {
    throw new ZoomPhoneError(
      "Enter a phone number without letters or an extension, for example +18585551234."
    );
  }


  normalized =
    normalized.replace(
      /[\s().-]/g,
      ""
    );


  if (/^\d{10}$/.test(normalized)) {
    normalized =
      `+1${normalized}`;
  } else if (/^1\d{10}$/.test(normalized)) {
    normalized =
      `+${normalized}`;
  }


  if (!/^\+[1-9]\d{1,14}$/.test(normalized)) {
    throw new ZoomPhoneError(
      "Enter a phone number with its country code, for example +18585551234. US/CA numbers may also use 10 digits."
    );
  }


  return normalized;
}


export async function resolveZoomPhoneNumberId(
  phoneNumber: string
): Promise<string> {

  const normalized =
    normalizeZoomPhoneNumber(
      phoneNumber
    );

  const numbers =
    await listZoomPhoneNumbers();

  const matches =
    numbers.filter(
      (number) =>
        number.number === normalized
    );


  if (matches.length !== 1 || !matches[0]?.id) {
    throw new ZoomPhoneError(
      matches.length === 0
        ? "The entered phone number was not found in the account's Zoom Phone inventory. Confirm it was acquired in this account and allocated to Zoom Phone."
        : "Zoom returned an ambiguous phone number match. Review the number in Zoom before retrying."
    );
  }


  return matches[0].id;
}


/*
 * ============================================
 * GET PHONE USER / NUMBER
 * ============================================
 */

export async function getZoomPhoneUser(
  userId: string
): Promise<ZoomPhoneUserRecord> {

  return zoomPhoneRequest<ZoomPhoneUserRecord>(
    `/phone/users/${encodeURIComponent(userId)}`,
    "Zoom phone user lookup"
  );
}


export async function getZoomPhoneNumber(
  numberId: string
): Promise<ZoomPhoneNumberRecord> {

  const number =
    await zoomPhoneRequest<ZoomPhoneNumberRecord>(
      `/number_management/numbers/${encodeURIComponent(numberId)}`,
      "Zoom phone number verification"
    );


  if (
    number &&
    !Object.prototype.hasOwnProperty.call(
      number,
      "assigned_list"
    )
  ) {
    const unassignedNumbers =
      await listZoomPhoneNumbers(
        true
      );

    const confirmedUnassigned =
      unassignedNumbers.some(
        (item) =>
          item.id === number.id &&
          item.number === number.number &&
          Array.isArray(item.assigned_list) &&
          item.assigned_list.length === 0
      );


    if (confirmedUnassigned) {
      return {
        ...number,
        assigned_list:
          [],
      };
    }
  }


  return number;
}


/*
 * ============================================
 * ASSIGN US / CA UNLIMITED
 * ============================================
 *
 * Reuse the plan when it is already assigned.
 */

export async function ensureZoomPhoneCallingPlan(
  userId: string,
  user: ZoomPhoneUserRecord
): Promise<boolean> {

  if (user.calling_plans?.some(
    (plan) =>
      plan.type ===
        US_CA_UNLIMITED_PLAN
  )) {
    return false;
  }


  await zoomPhoneRequest<void>(
    `/phone/users/${encodeURIComponent(userId)}/calling_plans`,
    "Zoom calling plan assignment",
    {
      method:
        "POST",

      body:
        JSON.stringify({
          calling_plans: [
            {
              type:
                US_CA_UNLIMITED_PLAN,
            },
          ],
        }),
    }
  );


  return true;
}


/*
 * ============================================
 * UPDATE NAMES / ASSIGN NUMBER
 * ============================================
 *
 * Update Display Name only. Caller ID updates are deferred.
 */

export async function updateZoomPhoneNumberDisplayName(
  numberId: string,
  displayName: string
): Promise<void> {

  await zoomPhoneRequest<void>(
    `/number_management/numbers/${encodeURIComponent(numberId)}`,
    "Zoom phone number Display Name update",
    {
      method:
        "PATCH",

      body:
        JSON.stringify({
          display_name:
            displayName,
        }),
    }
  );
}


export async function assignZoomPhoneNumber(
  userId: string,
  number: ZoomPhoneNumberRecord
): Promise<void> {

  await zoomPhoneRequest<void>(
    `/phone/users/${encodeURIComponent(userId)}/phone_numbers`,
    "Zoom phone number assignment",
    {
      method:
        "POST",

      body:
        JSON.stringify({
          phone_numbers: [
            {
              id:
                number.id,

              number:
                number.number,
            },
          ],
        }),
    }
  );
}

