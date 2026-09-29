import { google } from "googleapis";

import {
  getAuthorizedGoogleClient,
} from "../services/googleOAuth.js";

async function main() {
  const auth =
    getAuthorizedGoogleClient();

  const calendar =
    google.calendar({
      version: "v3",
      auth,
    });

  const now =
    new Date();

  const oneHourLater =
    new Date(
      now.getTime() +
      60 * 60 * 1000
    );

  const result =
    await calendar.freebusy.query({
      requestBody: {
        timeMin:
          now.toISOString(),

        timeMax:
          oneHourLater.toISOString(),

        items: [
          {
            id: "primary",
          },
        ],
      },
    });

  console.log(
    "Google OAuth connection successful."
  );

  console.log(
    JSON.stringify(
      result.data.calendars,
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});