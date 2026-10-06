import {
  google,
} from "googleapis";

import {
  readFile,
} from "node:fs/promises";

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


const GOOGLE_OAUTH_CLIENT_FILE =
  requireEnv(
    "GOOGLE_OAUTH_CLIENT_FILE"
  );


const GOOGLE_OAUTH_TOKEN_FILE =
  requireEnv(
    "GOOGLE_OAUTH_TOKEN_FILE"
  );


/*
 * ============================================
 * LOAD GOOGLE OAUTH CLIENT
 * ============================================
 */

async function getGmailOAuthClient() {

  const clientFile =
    await readFile(
      GOOGLE_OAUTH_CLIENT_FILE,
      "utf8"
    );


  const clientJson =
    JSON.parse(
      clientFile
    );


  const config =
    clientJson.installed ??
    clientJson.web;


  if (!config) {
    throw new Error(
      "Google OAuth client file does not contain installed or web credentials."
    );
  }


  const oauth2Client =
    new google.auth.OAuth2(
      config.client_id,
      config.client_secret,
      config.redirect_uris?.[0]
    );


  const tokenFile =
    await readFile(
      GOOGLE_OAUTH_TOKEN_FILE,
      "utf8"
    );


  const tokenJson =
    JSON.parse(
      tokenFile
    );


  oauth2Client.setCredentials(
    tokenJson
  );


  return oauth2Client;
}


/*
 * ============================================
 * BASE64 URL ENCODING
 * ============================================
 */

function encodeBase64Url(
  value: string
): string {

  return Buffer
    .from(
      value
    )
    .toString(
      "base64"
    )
    .replace(
      /\+/g,
      "-"
    )
    .replace(
      /\//g,
      "_"
    )
    .replace(
      /=+$/g,
      ""
    );
}


/*
 * ============================================
 * SEND GMAIL MESSAGE
 * ============================================
 */

export async function sendGmailMessage(
  input: {
    fromEmail:
      string;

    fromName:
      string;

    to:
      string;

    subject:
      string;

    text:
      string;

    html:
      string;
  }
) {

  const auth =
    await getGmailOAuthClient();


  const gmail =
    google.gmail({
      version:
        "v1",

      auth,
    });


  const boundary =
    `cardiff_email_${Date.now()}`;


  const message = [
    `From: ${input.fromName} <${input.fromEmail}>`,
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    input.text,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    input.html,
    "",
    `--${boundary}--`,
  ].join(
    "\r\n"
  );


  const raw =
    encodeBase64Url(
      message
    );


  const response =
    await gmail.users.messages.send({
      userId:
        "me",

      requestBody: {
        raw,
      },
    });


  return {
    messageId:
      response.data.id,

    threadId:
      response.data.threadId,
  };
}