import { google } from "googleapis";
import fs from "node:fs";
import "dotenv/config";

const OAUTH_CLIENT_FILE =
  process.env.GOOGLE_OAUTH_CLIENT_FILE;

const OAUTH_TOKEN_FILE =
  process.env.GOOGLE_OAUTH_TOKEN_FILE;

if (!OAUTH_CLIENT_FILE) {
  throw new Error(
    "GOOGLE_OAUTH_CLIENT_FILE is not configured in .env."
  );
}

if (!OAUTH_TOKEN_FILE) {
  throw new Error(
    "GOOGLE_OAUTH_TOKEN_FILE is not configured in .env."
  );
}

export const GOOGLE_USER_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
];

type OAuthClientFile = {
  installed?: {
    client_id: string;
    client_secret: string;
    redirect_uris?: string[];
  };
  web?: {
    client_id: string;
    client_secret: string;
    redirect_uris?: string[];
  };
};

function loadOAuthClientConfig(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} {
  const raw =
    fs.readFileSync(
      OAUTH_CLIENT_FILE!,
      "utf8"
    );

  const json =
    JSON.parse(raw) as OAuthClientFile;

  const config =
    json.installed ?? json.web;

  if (!config) {
    throw new Error(
      "OAuth client JSON does not contain an installed or web client configuration."
    );
  }

  const redirectUri =
    config.redirect_uris?.[0] ??
    "http://localhost";

  return {
    clientId: config.client_id,
    clientSecret:
      config.client_secret,
    redirectUri,
  };
}

export function createGoogleOAuthClient() {
  const {
    clientId,
    clientSecret,
    redirectUri,
  } = loadOAuthClientConfig();

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );
}

export function getAuthorizedGoogleClient() {
  if (
    !fs.existsSync(
      OAUTH_TOKEN_FILE!
    )
  ) {
    throw new Error(
      `Google OAuth token was not found at ${OAUTH_TOKEN_FILE}. Run the authorization script first.`
    );
  }

  const oauth2Client =
    createGoogleOAuthClient();

  const credentials =
    JSON.parse(
      fs.readFileSync(
        OAUTH_TOKEN_FILE!,
        "utf8"
      )
    );

  oauth2Client.setCredentials(
    credentials
  );

  return oauth2Client;
}