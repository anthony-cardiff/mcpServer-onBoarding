import * as XLSX from "xlsx";
import * as fs from "node:fs";

import { COLUMNS } from "../config/columns.js";
import type {
  NewHire,
  EmployeeCredentials,
} from "../types/employee.js";

const DEFAULT_SHEET_NAME = "New Hires  New Creds";

function cleanValue(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const result = String(value).trim();

  return result === "" ? undefined : result;
}

function hasValue(value: unknown): boolean {
  return cleanValue(value) !== undefined;
}


// ======================
// ---- List Parser ----
// ======================

function parseList(value: unknown): string[] {
  const cleaned = cleanValue(value);

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
    .filter((item) => item.length > 0);
}


// ========================
// ---- Boolean Parser ----
// ========================

function parseBoolean(value: unknown): boolean | undefined {
  const cleaned = cleanValue(value)?.toLowerCase();

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

// ========================
// ---- Excel Parser -----
// ========================

function parseExcelDate(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const text = cleanValue(value);

  if (!text) {
    return undefined;
  }

  const numericValue = Number(text);

  // Handle Excel serial dates such as 46968
  if (
    !Number.isNaN(numericValue) &&
    numericValue > 20000 &&
    numericValue < 100000
  ) {
    const excelEpoch = Date.UTC(1899, 11, 30);

    const date = new Date(
      excelEpoch + numericValue * 24 * 60 * 60 * 1000
    );

    return date.toISOString().slice(0, 10);
  }

  // Already a normal date/string — leave it alone.
  return text;
}


function loadRows(
  workbookPath: string,
  sheetName = DEFAULT_SHEET_NAME
): Record<string, unknown>[] {
const fileBuffer = fs.readFileSync(workbookPath);

const workbook = XLSX.read(fileBuffer, {
  type: "buffer",
});

  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    throw new Error(
      `Worksheet "${sheetName}" was not found in ${workbookPath}`
    );
  }

  return XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: undefined,
  });
}

export function getNewHireFromSpreadsheet(
  workbookPath: string,
  spreadsheetRow: number
): NewHire {
  const rows = loadRows(workbookPath);

  /*
   * sheet_to_json() begins with the first data row after the header.
   *
   * Excel:
   * Row 1 = headers
   * Row 2 = rows[0]
   * Row 3 = rows[1]
   *
   * Therefore:
   * spreadsheetRow - 2
   */
  const arrayIndex = spreadsheetRow - 2;

  if (arrayIndex < 0) {
    throw new Error(
      `Row ${spreadsheetRow} is not a valid employee row.`
    );
  }

  const row = rows[arrayIndex];

  if (!row) {
    throw new Error(
      `No employee data was found on spreadsheet row ${spreadsheetRow}.`
    );
  }

  return {
    
    row: spreadsheetRow,

    firstName: cleanValue(row[COLUMNS.firstName]),
    lastName: cleanValue(row[COLUMNS.lastName]),
    startDate: parseExcelDate(row[COLUMNS.startDate]),

    phone: cleanValue(row[COLUMNS.phone]),
    personalEmail: cleanValue(row[COLUMNS.personalEmail]),
    cardiffEmail: cleanValue(row[COLUMNS.cardiffEmail]),

    department: cleanValue(row[COLUMNS.department]),
    manager: cleanValue(row[COLUMNS.manager]),
    title: cleanValue(row[COLUMNS.title]),
    location: cleanValue(row[COLUMNS.location]),


    // ===========================
    // ------- Salesforce --------
    // ===========================

    salesforce: {
      username: cleanValue(row[COLUMNS.salesforceUsername]),
      role: cleanValue(row[COLUMNS.salesforceRole]),
      profile: cleanValue(row[COLUMNS.salesforceProfile]),

      userRequired: parseBoolean(
        row[COLUMNS.salesforceUserRequired]
      ),

      permissionSetRequired: parseBoolean(
        row[COLUMNS.permissionSetRequired]
      ),

      permissionSetGroups: parseList(
        row[COLUMNS.permissionSetGroups]
      ),

      managedPackageRequired: parseBoolean(
        row[COLUMNS.managedPackageRequired]
      ),
    },


    // ======================
    // ------- Slack --------
    // ======================

    slack: {
      userMapping: cleanValue(row[COLUMNS.slackUserMapping]),
    },


    // ======================
    // ------- Zoom --------
    // ======================

    zoom: {
      accountRequired: parseBoolean(
      row[COLUMNS.zoomAccountRequired]
      ),

      directLineRequired: parseBoolean(
      row[COLUMNS.zoomDirectLineRequired]
      ),

      smsRequired: parseBoolean(
      row[COLUMNS.zoomSmsRequired]
      ),
    },


    // ======================
    // ------- Passw --------
    // ======================

    credentialsAvailable: {
      gmPassword: hasValue(row[COLUMNS.gmPassword]),
      sfPassword: hasValue(row[COLUMNS.sfPassword]),
      computerPassword: hasValue(row[COLUMNS.computerPassword]),
      abmPassword: hasValue(row[COLUMNS.abmPassword]),
      slackPassword: hasValue(row[COLUMNS.slackPassword]),
      zoomPassword: hasValue(row[COLUMNS.zoomPassword]),
    },
  };
}

export function getEmployeeCredentialsFromSpreadsheet(
  workbookPath: string,
  spreadsheetRow: number
): EmployeeCredentials {
  const rows = loadRows(workbookPath);

  const arrayIndex = spreadsheetRow - 2;
  const row = rows[arrayIndex];

  if (!row) {
    throw new Error(
      `No employee data was found on spreadsheet row ${spreadsheetRow}.`
    );
  }

  return {
    gmPassword: cleanValue(row[COLUMNS.gmPassword]),
    sfPassword: cleanValue(row[COLUMNS.sfPassword]),
    computerPassword: cleanValue(row[COLUMNS.computerPassword]),
    abmPassword: cleanValue(row[COLUMNS.abmPassword]),
    slackPassword: cleanValue(row[COLUMNS.slackPassword]),
    zoomPassword: cleanValue(row[COLUMNS.zoomPassword]),
  };
}