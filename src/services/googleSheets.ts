import { google } from "googleapis";
import "dotenv/config";

const SERVICE_ACCOUNT_FILE =
  process.env.GOOGLE_SERVICE_ACCOUNT_FILE;

const SPREADSHEET_ID =
  process.env.GOOGLE_SPREADSHEET_ID;

const SHEET_NAME =
  process.env.GOOGLE_ONBOARDING_SHEET ??
  "New Hires / New Creds";

if (!SERVICE_ACCOUNT_FILE) {
  throw new Error(
    "GOOGLE_SERVICE_ACCOUNT_FILE is not configured in .env."
  );
}

if (!SPREADSHEET_ID) {
  throw new Error(
    "GOOGLE_SPREADSHEET_ID is not configured in .env."
  );
}

const auth = new google.auth.GoogleAuth({
  keyFile: SERVICE_ACCOUNT_FILE,
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets.readonly",
  ],
});

const sheets = google.sheets({
  version: "v4",
  auth,
});

/**
 * Reads one row directly from the live Google Sheet.
 *
 * This function does NOT know anything about Cardiff employee fields.
 * It simply returns:
 *
 * {
 *   "First Name": "Angel",
 *   "Last Name": "Gaytan",
 *   "SF Role": "Funding",
 *   ...
 * }
 */
export async function getGoogleSheetRow(
  spreadsheetRow: number
): Promise<Record<string, unknown>> {
  if (
    !Number.isInteger(spreadsheetRow) ||
    spreadsheetRow < 2
  ) {
    throw new Error(
      `Row ${spreadsheetRow} is not a valid employee row.`
    );
  }

  const response =
    await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_ID,

      ranges: [
        `'${SHEET_NAME}'!1:1`,
        `'${SHEET_NAME}'!${spreadsheetRow}:${spreadsheetRow}`,
      ],

      valueRenderOption: "FORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    });

  const valueRanges =
    response.data.valueRanges ?? [];

  const headers =
    valueRanges[0]?.values?.[0] ?? [];

  const values =
    valueRanges[1]?.values?.[0] ?? [];

  if (headers.length === 0) {
    throw new Error(
      `No headers were found in worksheet "${SHEET_NAME}".`
    );
  }

  if (values.length === 0) {
    throw new Error(
      `No employee data was found on spreadsheet row ${spreadsheetRow}.`
    );
  }

  const row: Record<string, unknown> = {};

  headers.forEach((header, index) => {
    const headerName =
      String(header ?? "").trim();

    if (!headerName) {
      return;
    }

    const value = values[index];

    row[headerName] =
      value === undefined || value === ""
        ? undefined
        : value;
  });

  return row;
}