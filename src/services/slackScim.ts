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


const SLACK_SCIM_TOKEN =
  requireEnv(
    "SLACK_SCIM_TOKEN"
  );


const SLACK_SCIM_BASE_URL =
  "https://api.slack.com/scim/v1";


/*
 * ============================================
 * SLACK SCIM TYPES
 * ============================================
 */

export interface SlackScimUser {
  id?:
    string;

  userName?:
    string;

  displayName?:
    string;

  active?:
    boolean;

  name?: {
    givenName?:
      string;

    familyName?:
      string;
  };

  emails?: Array<{
    value?:
      string;

    type?:
      string;

    primary?:
      boolean;
  }>;
}


interface SlackScimListResponse {
  totalResults?:
    number;

  Resources?:
    SlackScimUser[];
}


/*
 * ============================================
 * GENERIC SCIM REQUEST
 * ============================================
 */

async function slackScimFetch(
  path: string,
  init:
    RequestInit = {}
): Promise<Response> {

  const headers =
    new Headers(
      init.headers
    );


  headers.set(
    "Authorization",
    `Bearer ${SLACK_SCIM_TOKEN}`
  );


  headers.set(
    "Accept",
    "application/json"
  );


  if (
    init.body &&
    !headers.has(
      "Content-Type"
    )
  ) {
    headers.set(
      "Content-Type",
      "application/json"
    );
  }


  return fetch(
    `${SLACK_SCIM_BASE_URL}${path}`,
    {
      ...init,
      headers,
    }
  );
}


/*
 * ============================================
 * FIND SLACK USER BY EMAIL
 * ============================================
 *
 * Completely read-only.
 */

export async function findSlackUserByEmail(
  email: string
): Promise<SlackScimUser | undefined> {

  const filter =
    `email eq ${JSON.stringify(email)}`;


  const response =
    await slackScimFetch(
      `/Users?filter=${encodeURIComponent(filter)}`
    );


  const body =
    await response.text();


  if (!response.ok) {
    throw new Error(
      `Slack SCIM user lookup failed (${response.status}): ${body}`
    );
  }


  const data:
    SlackScimListResponse =
    JSON.parse(
      body
    );


  return data.Resources?.[0];
}


/*
 * ============================================
 * GENERATE SLACK USERNAME
 * ============================================
 *
 * Slack SCIM userName is required.
 *
 * We use the email local-part and keep it
 * within Slack's 21-character limit.
 */

export function generateSlackUsername(
  email: string
): string {

  const localPart =
    email
      .split("@")[0]
      ?.trim()
      .toLowerCase();


  if (!localPart) {
    throw new Error(
      `Could not generate Slack username from ${email}.`
    );
  }


  const cleaned =
    localPart
      .replace(
        /[^a-z0-9._-]/g,
        "_"
      )
      .slice(
        0,
        21
      );


  if (!cleaned) {
    throw new Error(
      `Could not generate a valid Slack username from ${email}.`
    );
  }


  return cleaned;
}


/*
 * ============================================
 * CREATE SLACK USER
 * ============================================
 *
 * Creates the Slack member.
 *
 * No Slack password is created because Cardiff
 * uses Google Workspace SSO.
 */

export async function createSlackUser(
  input: {
    email:
      string;

    firstName:
      string;

    lastName:
      string;

    title?:
      string;
  }
): Promise<SlackScimUser> {

  const userName =
    generateSlackUsername(
      input.email
    );


  const requestBody = {
    schemas: [
      "urn:scim:schemas:core:1.0",
    ],

    userName,

    active:
      true,

    name: {
      givenName:
        input.firstName,

      familyName:
        input.lastName,
    },

    displayName:
      `${input.firstName} ${input.lastName}`,

    emails: [
      {
        value:
          input.email,

        type:
          "work",

        primary:
          true,
      },
    ],

    ...(input.title
      ? {
          title:
            input.title,
        }
      : {}),
  };


  const response =
    await slackScimFetch(
      "/Users",
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
      `Slack SCIM user creation failed (${response.status}): ${body}`
    );
  }


  return JSON.parse(
    body
  ) as SlackScimUser;
}


/*
 * ============================================
 * TEST SLACK SCIM CONNECTION
 * ============================================
 */

export async function testSlackScimConnection():
Promise<void> {

  const response =
    await slackScimFetch(
      "/ServiceProviderConfigs"
    );


  const body =
    await response.text();


  if (!response.ok) {
    throw new Error(
      `Slack SCIM connection test failed (${response.status}): ${body}`
    );
  }
}