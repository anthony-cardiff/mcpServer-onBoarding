import {
  zoomFetch,
} from "./zoomOAuth.js";

/*
 * ============================================
 * GET ZOOM USER PROVISIONING STATE
 * ============================================
 *
 * Accept an email for a fresh lookup, or reuse
 * a user already fetched by preview / verification.
 *
 * Phone readiness here checks activation only.
 * Phone licenses and Direct Line are
 * provisioned separately.
 */

export async function getZoomUserProvisioningState(
  userOrEmail:
    string |
    ZoomUserRecord |
    undefined
) {

  const user =
    typeof userOrEmail === "string"
      ? await findZoomUserByEmail(
          userOrEmail
        )
      : userOrEmail;


  if (!user) {
    return {
      exists:
        false,

      status:
        "NOT_CREATED",

      activationRequired:
        false,

      readyForPhoneProvisioning:
        false,
    };
  }


  const status =
    user.status ??
    "unknown";


  return {
    exists:
      true,

    userId:
      user.id,

    email:
      user.email,

    status,

    activationRequired:
      status ===
        "pending",

    readyForPhoneProvisioning:
      status ===
        "active",
  };
}


/*
 * ============================================
 * ZOOM USER TYPE
 * ============================================
 */

export interface ZoomUserRecord {
  id?:
    string;

  first_name?:
    string;

  last_name?:
    string;

  email?:
    string;

  type?:
    number;

  status?:
    string;

  role_name?:
    string;

  verified?:
    number;

  created_at?:
    string;

  last_login_time?:
    string;

  job_title?:
    string;

  group_ids?:
    string[];

  login_types?:
    number[];
}


/*
 * ============================================
 * ZOOM GROUP TYPE
 * ============================================
 */

export interface ZoomGroupRecord {
  id:
    string;

  name:
    string;

  total_members?:
    number;
}


/*
 * ============================================
 * FIND ZOOM USER BY EMAIL
 * ============================================
 *
 * Completely read-only.
 */

export async function findZoomUserByEmail(
  email: string
): Promise<ZoomUserRecord | undefined> {

  const normalizedEmail =
    email
      .trim()
      .toLowerCase();


  const response =
    await zoomFetch(
      `/users/${encodeURIComponent(normalizedEmail)}`
    );


  if (
    response.status === 404
  ) {
    return undefined;
  }


  const body =
    await response.text();


  if (!response.ok) {
    throw new Error(
      `Zoom user lookup failed (${response.status}): ${body}`
    );
  }


  const data:
    ZoomUserRecord =
    JSON.parse(
      body
    );


  return data;
}


/*
 * ============================================
 * LIST ZOOM GROUPS
 * ============================================
 */

export async function listZoomGroups():
Promise<ZoomGroupRecord[]> {

  const response =
    await zoomFetch(
      "/groups?page_size=300"
    );


  const body =
    await response.text();


  if (!response.ok) {
    throw new Error(
      `Zoom group lookup failed (${response.status}): ${body}`
    );
  }


  const data:
    any =
    JSON.parse(
      body
    );


  return data.groups ?? [];
}


/*
 * ============================================
 * FIND ZOOM GROUP BY NAME
 * ============================================
 */

export async function findZoomGroupByName(
  name: string
): Promise<ZoomGroupRecord | undefined> {

  const groups =
    await listZoomGroups();


  const normalizedName =
    name
      .trim()
      .toLowerCase();


  return groups.find(
    (group) =>
      group.name
        ?.trim()
        .toLowerCase() ===
      normalizedName
  );
}


/*
 * ============================================
 * CREATE ZOOM USER
 * ============================================
 *
 * Standard Cardiff configuration:
 *
 * - Zoom Workplace: Unassigned
 * - Zoom Phone Basic: enabled
 * - Job Title: employee Title
 *
 * type = 4 means:
 * Unassigned without Meetings Basic.
 */

export async function createZoomUser(
  input: {
    email:
      string;

    firstName:
      string;

    lastName:
      string;

    jobTitle?:
      string;
  }
): Promise<ZoomUserRecord> {

  const requestBody = {
    action:
      "create",

    user_info: {
      email:
        input.email,

      first_name:
        input.firstName,

      last_name:
        input.lastName,

      type:
        4,

      feature: {
        zoom_phone:
          true,
      },

      ...(input.jobTitle
        ? {
            job_title:
              input.jobTitle,
          }
        : {}),
    },
  };


  const response =
    await zoomFetch(
      "/users",
      {
        method:
          "POST",

        body:
          JSON.stringify(
            requestBody
          ),
      }
    );


  const body =
    await response.text();


  if (!response.ok) {
    throw new Error(
      `Zoom user creation failed (${response.status}): ${body}`
    );
  }


  const data:
    ZoomUserRecord =
    JSON.parse(
      body
    );


  if (!data.id) {
    throw new Error(
      "Zoom created the user but did not return a User ID."
    );
  }


  return data;
}


/*
 * ============================================
 * UPDATE ZOOM USER PROFILE
 * ============================================
 *
 * We explicitly set these values after
 * creation as well so that the final state is
 * exactly what Cardiff expects.
 */

export async function updateZoomUserDefaults(
  userId: string,
  input: {
    jobTitle?:
      string;
  }
): Promise<void> {

  const requestBody:
    Record<string, unknown> = {

      /*
       * Zoom Workplace:
       * Unassigned without Meetings Basic
       */
      type:
        4,

      /*
       * Zoom Phone Basic
       */
      zoom_phone:
        true,
  };


  if (input.jobTitle) {
    requestBody.job_title =
      input.jobTitle;
  }


  const response =
    await zoomFetch(
      `/users/${encodeURIComponent(userId)}`,
      {
        method:
          "PATCH",

        body:
          JSON.stringify(
            requestBody
          ),
      }
    );


  if (!response.ok) {
    const body =
      await response.text();

    throw new Error(
      `Zoom user configuration failed (${response.status}): ${body}`
    );
  }
}


/*
 * ============================================
 * CHECK GROUP MEMBERSHIP
 * ============================================
 */

export async function zoomUserIsInGroup(
  user:
    ZoomUserRecord,
  groupId:
    string
): Promise<boolean> {

  return Boolean(
    user.group_ids?.includes(
      groupId
    )
  );
}


/*
 * ============================================
 * ADD USER TO ZOOM GROUP
 * ============================================
 */

export async function addZoomUserToGroup(
  groupId: string,
  userId: string,
  email?: string
): Promise<void> {

  const response =
    await zoomFetch(
      `/groups/${encodeURIComponent(groupId)}/members`,
      {
        method:
          "POST",

        body:
          JSON.stringify({
            members: [
              {
                id:
                  userId,

                ...(email
                  ? {
                      email,
                    }
                  : {}),
              },
            ],
          }),
      }
    );


  if (!response.ok) {
    const body =
      await response.text();

    throw new Error(
      `Zoom group assignment failed (${response.status}): ${body}`
    );
  }
}


/*
 * ============================================
 * ENSURE USER IS IN GROUP
 * ============================================
 *
 * Idempotent helper.
 */

export async function ensureZoomUserInGroup(
  userId: string,
  email: string,
  groupId: string
) {

  const currentUser =
    await findZoomUserByEmail(
      email
    );


  if (!currentUser) {
    throw new Error(
      `Zoom user ${email} could not be found while checking group membership.`
    );
  }


  const alreadyAssigned =
    await zoomUserIsInGroup(
      currentUser,
      groupId
    );


  if (alreadyAssigned) {
    return {
      assigned:
        true,

      assignedNow:
        false,

      alreadyAssigned:
        true,
    };
  }


  await addZoomUserToGroup(
    groupId,
    userId,
    email
  );


  return {
    assigned:
      true,

    assignedNow:
      true,

    alreadyAssigned:
      false,
  };
}