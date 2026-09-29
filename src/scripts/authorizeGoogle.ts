import { authenticate } from "@google-cloud/local-auth";
import fs from "node:fs";
import "dotenv/config";

import {
  GOOGLE_USER_SCOPES,
} from "../services/googleOAuth.js";

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `${name} is not configured in .env.`
    );
  }

  return value;
}

const OAUTH_CLIENT_FILE = requireEnv(
  "GOOGLE_OAUTH_CLIENT_FILE"
);

const OAUTH_TOKEN_FILE = requireEnv(
  "GOOGLE_OAUTH_TOKEN_FILE"
);

async function main() {
  const authClient =
    await authenticate({
      scopes: GOOGLE_USER_SCOPES,
      keyfilePath: OAUTH_CLIENT_FILE,
    });

  if (!authClient.credentials) {
    throw new Error(
      "Google did not return OAuth credentials."
    );
  }

  fs.writeFileSync(
    OAUTH_TOKEN_FILE,
    JSON.stringify(
      authClient.credentials,
      null,
      2
    ),
    {
      mode: 0o600,
    }
  );

  console.log(
    `Google OAuth token saved to ${OAUTH_TOKEN_FILE}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});