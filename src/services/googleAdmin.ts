import { google } from "googleapis";
import "dotenv/config";

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `${name} is not configured in .env.`
    );
  }

  return value;
}

const SERVICE_ACCOUNT_FILE =
  requireEnv(
    "GOOGLE_SERVICE_ACCOUNT_FILE"
  );

  const WORKSPACE_DOMAIN =
  requireEnv(
    "GOOGLE_WORKSPACE_DOMAIN"
  );

const adminAuth =
  new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_FILE,

    scopes: [
      "https://www.googleapis.com/auth/admin.directory.user",
    ],
  });

const directory =
  google.admin({
    version: "directory_v1",
    auth: adminAuth,
  });


export interface CreateGoogleUserInput {
  primaryEmail: string;
  firstName: string;
  lastName: string;
  password: string;

  recoveryEmail?: string;

  changePasswordAtNextLogin?: boolean;
}


/**
 * Retrieve an existing Google Workspace user.
 */
export async function getGoogleWorkspaceUser(
  email: string
) {
  const response =
    await directory.users.get({
      userKey: email,
      projection: "basic",
    });

  return response.data;
}


/**
 * Check whether a Google Workspace account exists.
 */
export async function googleWorkspaceUserExists(
  email: string
): Promise<boolean> {
  const normalizedEmail =
    email.trim().toLowerCase();

  const response =
    await directory.users.list({
      domain: WORKSPACE_DOMAIN,

      query:
        `email=${normalizedEmail}`,

      maxResults: 2,

      projection: "basic",
    });

  const users =
    response.data.users ?? [];

  return users.some(
    (user) =>
      user.primaryEmail
        ?.trim()
        .toLowerCase() ===
      normalizedEmail
  );
}


/**
 * Create a new Google Workspace user.
 *
 * The password is sent to Google but is
 * deliberately not returned by this function.
 */
export async function createGoogleWorkspaceUser(
  input: CreateGoogleUserInput
) {
  const existing =
    await googleWorkspaceUserExists(
      input.primaryEmail
    );

  if (existing) {
    throw new Error(
      `Google Workspace user ${input.primaryEmail} already exists.`
    );
  }

  const response =
    await directory.users.insert({
      requestBody: {
        primaryEmail:
          input.primaryEmail,

        name: {
          givenName:
            input.firstName,

          familyName:
            input.lastName,
        },

        password:
          input.password,

        changePasswordAtNextLogin:
          input.changePasswordAtNextLogin ??
          false,

        recoveryEmail:
          input.recoveryEmail,
      },
    });

  return {
    id:
      response.data.id,

    primaryEmail:
      response.data.primaryEmail,

    fullName:
      response.data.name?.fullName,

    suspended:
      response.data.suspended,

    orgUnitPath:
      response.data.orgUnitPath,
  };
}