import * as XLSX from "xlsx";
import * as fs from "node:fs";

import { COLUMNS } from "../config/columns.js";

import type {
  NewHire,
  EmployeeCredentials,
} from "../types/employee.js";

const DEFAULT_SHEET_NAME =
  "New Hires  New Creds";


/**
 * Convert a spreadsheet value into a cleaned string.
 */
function cleanValue(
  value: unknown
): string | undefined {
  if (
    value === undefined ||
    value === null
  ) {
    return undefined;
  }

  const result =
    String(value).trim();

  return result === ""
    ? undefined
    : result;
}


/**
 * Returns true if a spreadsheet cell
 * contains something.
 */
function hasValue(
  value: unknown
): boolean {
  return cleanValue(value) !== undefined;
}


/**
 * Convert TRUE / FALSE spreadsheet values
 * into real JavaScript booleans.
 *
 * Works with:
 *
 * TRUE
 * FALSE
 * true
 * false
 */
function parseBoolean(
  value: unknown
): boolean | undefined {
  const cleaned =
    cleanValue(value)?.toLowerCase();

  if (cleaned === undefined) {
    return undefined;
  }

  if (cleaned === "true") {
    return true;
  }

  if (cleaned === "false") {
    return false;
  }

  return undefined;
}


/**
 * Convert a list from the spreadsheet into
 * a string array.
 *
 * Supports:
 *
 * Operations
 * LASER Credit Access
 *
 * OR:
 *
 * Operations, LASER Credit Access
 *
 * OR:
 *
 * • Operations
 * • LASER Credit Access
 */
function parseList(
  value: unknown
): string[] {
  const cleaned =
    cleanValue(value);

  if (!cleaned) {
    return [];
  }

  return cleaned
    .split(/[\n,;]+/)
    .map((item) =>
      item
        .replace(/^[•\-]\s*/, "")
        .trim()
    )
    .filter(
      (item) => item.length > 0
    );
}


/**
 * Normalizes dates.
 *
 * This primarily exists for our local
 * Excel fallback because Excel may return
 * dates as serial numbers like:
 *
 * 46968
 *
 * Google Sheets normally returns a formatted
 * date such as:
 *
 * 8/3/2028
 */
function normalizeDate(
  value: unknown
): string | undefined {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return undefined;
  }

  const text =
    cleanValue(value);

  if (!text) {
    return undefined;
  }

  const numericValue =
    Number(text);

  /*
   * Excel serial-date handling.
   */
  if (
    !Number.isNaN(numericValue) &&
    numericValue > 20000 &&
    numericValue < 100000
  ) {
    const excelEpoch =
      Date.UTC(
        1899,
        11,
        30
      );

    const date =
      new Date(
        excelEpoch +
        numericValue *
        24 *
        60 *
        60 *
        1000
      );

    return date
      .toISOString()
      .slice(0, 10);
  }

  /*
   * Google Sheets may return:
   *
   * 8/3/2028
   *
   * Convert that to:
   *
   * 2028-08-03
   */
  const usDateMatch =
    text.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
    );

  if (usDateMatch) {
    const month =
      usDateMatch[1].padStart(
        2,
        "0"
      );

    const day =
      usDateMatch[2].padStart(
        2,
        "0"
      );

    const year =
      usDateMatch[3];

    return `${year}-${month}-${day}`;
  }

  /*
   * If it is already normalized or uses
   * some other representation, leave it alone.
   */
  return text;
}


/**
 * THIS IS THE IMPORTANT FUNCTION.
 *
 * Both the local Excel reader and live Google
 * Sheets reader ultimately send their raw row
 * here.
 *
 * This is the single source of truth for
 * translating spreadsheet columns into the
 * NewHire object Claude receives.
 */
export function mapRowToNewHire(
  row: Record<string, unknown>,
  spreadsheetRow: number
): NewHire {
  return {
    row: spreadsheetRow,

    firstName: cleanValue(
      row[COLUMNS.firstName]
    ),

    lastName: cleanValue(
      row[COLUMNS.lastName]
    ),

    startDate: normalizeDate(
      row[COLUMNS.startDate]
    ),

    phone: cleanValue(
      row[COLUMNS.phone]
    ),

    personalEmail: cleanValue(
      row[COLUMNS.personalEmail]
    ),

    cardiffEmail: cleanValue(
      row[COLUMNS.cardiffEmail]
    ),

    department: cleanValue(
      row[COLUMNS.department]
    ),

    manager: cleanValue(
      row[COLUMNS.manager]
    ),

    title: cleanValue(
      row[COLUMNS.title]
    ),

    location: cleanValue(
      row[COLUMNS.location]
    ),

    // ======================
    // ------- SForce --------
    // ======================


    salesforce: {
      username: cleanValue(
        row[COLUMNS.salesforceUsername]
      ),

      role: cleanValue(
        row[COLUMNS.salesforceRole]
      ),

      profile: cleanValue(
        row[COLUMNS.salesforceProfile]
      ),

      userRequired: parseBoolean(
        row[
          COLUMNS.salesforceUserRequired
        ]
      ),

      permissionSetRequired:
        parseBoolean(
          row[
            COLUMNS.permissionSetRequired
          ]
        ),

      permissionSetGroups:
        parseList(
          row[
            COLUMNS.permissionSetGroups
          ]
        ),

      managedPackageRequired:
        parseBoolean(
          row[
            COLUMNS.managedPackageRequired
          ]
        ),
    },

    // ======================
    // ------- Slack --------
    // ======================

    slack: {
      userMapping: cleanValue(
        row[
          COLUMNS.slackUserMapping
        ]
      ),
    },

    // ======================
    // ------- Zoom ---------
    // ======================

    zoom: {
      accountRequired:
        parseBoolean(
          row[
            COLUMNS.zoomAccountRequired
          ]
        ),

      directLineRequired:
        parseBoolean(
          row[
            COLUMNS.zoomDirectLineRequired
          ]
        ),

      smsRequired:
        parseBoolean(
          row[
            COLUMNS.zoomSmsRequired
          ]
        ),
    },

    // ======================
    // ------- PWords --------
    // ======================

    credentialsAvailable: {
      gmPassword: hasValue(
        row[COLUMNS.gmPassword]
      ),

      sfPassword: hasValue(
        row[COLUMNS.sfPassword]
      ),

      computerPassword: hasValue(
        row[
          COLUMNS.computerPassword
        ]
      ),

      abmPassword: hasValue(
        row[COLUMNS.abmPassword]
      ),

      slackPassword: hasValue(
        row[
          COLUMNS.slackPassword
        ]
      ),

      zoomPassword: hasValue(
        row[
          COLUMNS.zoomPassword
        ]
      ),
    },
  };
}


/*
 * =====================================================
 * LOCAL EXCEL FALLBACK
 * =====================================================
 *
 * Everything below here is kept so we can still
 * read your local Excel copy if we ever need it.
 *
 * get_new_hire will no longer use this once we
 * switch it to Google Sheets.
 */


function loadRows(
  workbookPath: string,
  sheetName = DEFAULT_SHEET_NAME
): Record<string, unknown>[] {
  const fileBuffer =
    fs.readFileSync(
      workbookPath
    );

  const workbook =
    XLSX.read(
      fileBuffer,
      {
        type: "buffer",
      }
    );

  const worksheet =
    workbook.Sheets[
      sheetName
    ];

  if (!worksheet) {
    throw new Error(
      `Worksheet "${sheetName}" was not found in ${workbookPath}`
    );
  }

  return XLSX.utils
    .sheet_to_json<
      Record<string, unknown>
    >(
      worksheet,
      {
        defval: undefined,
      }
    );
}


/**
 * Local Excel version of getNewHire.
 *
 * This is now just a fallback/testing function.
 */
export function getNewHireFromSpreadsheet(
  workbookPath: string,
  spreadsheetRow: number
): NewHire {
  const rows =
    loadRows(
      workbookPath
    );

  /*
   * Excel:
   *
   * Row 1 = headers
   * Row 2 = rows[0]
   * Row 3 = rows[1]
   *
   * Therefore:
   *
   * spreadsheetRow - 2
   */
  const arrayIndex =
    spreadsheetRow - 2;

  if (arrayIndex < 0) {
    throw new Error(
      `Row ${spreadsheetRow} is not a valid employee row.`
    );
  }

  const row =
    rows[arrayIndex];

  if (!row) {
    throw new Error(
      `No employee data was found on spreadsheet row ${spreadsheetRow}.`
    );
  }

  return mapRowToNewHire(
    row,
    spreadsheetRow
  );
}


/**
 * Reads the protected credential fields from
 * the LOCAL Excel copy.
 *
 * We are keeping credentials separate from
 * get_new_hire so ordinary employee reads do
 * not expose passwords.
 *
 * Later we'll create the equivalent protected
 * Google Sheets credential function.
 */
export function getEmployeeCredentialsFromSpreadsheet(
  workbookPath: string,
  spreadsheetRow: number
): EmployeeCredentials {
  const rows =
    loadRows(
      workbookPath
    );

  const arrayIndex =
    spreadsheetRow - 2;

  if (arrayIndex < 0) {
    throw new Error(
      `Row ${spreadsheetRow} is not a valid employee row.`
    );
  }

  const row =
    rows[arrayIndex];

  if (!row) {
    throw new Error(
      `No employee data was found on spreadsheet row ${spreadsheetRow}.`
    );
  }

  return {
    gmPassword: cleanValue(
      row[COLUMNS.gmPassword]
    ),

    sfPassword: cleanValue(
      row[COLUMNS.sfPassword]
    ),

    computerPassword:
      cleanValue(
        row[
          COLUMNS.computerPassword
        ]
      ),

    abmPassword: cleanValue(
      row[COLUMNS.abmPassword]
    ),

    slackPassword:
      cleanValue(
        row[
          COLUMNS.slackPassword
        ]
      ),

    zoomPassword: cleanValue(
      row[COLUMNS.zoomPassword]
    ),
  };
}