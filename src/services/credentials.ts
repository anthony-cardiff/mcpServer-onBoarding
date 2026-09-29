import {
  getGoogleSheetRow,
} from "./googleSheets.js";

import {
  COLUMNS,
} from "../config/columns.js";

export type EmployeeCredential =
  | "gmPassword"
  | "sfPassword"
  | "computerPassword"
  | "abmPassword"
  | "slackPassword"
  | "zoomPassword";

const CREDENTIAL_COLUMNS = {
  gmPassword: COLUMNS.gmPassword,
  sfPassword: COLUMNS.sfPassword,
  computerPassword: COLUMNS.computerPassword,
  abmPassword: COLUMNS.abmPassword,
  slackPassword: COLUMNS.slackPassword,
  zoomPassword: COLUMNS.zoomPassword,
} as const;

export async function getEmployeeCredential(
  row: number,
  credential: EmployeeCredential
): Promise<string | undefined> {
  const rawRow =
    await getGoogleSheetRow(row);

  const column =
    CREDENTIAL_COLUMNS[credential];

  const value =
    rawRow[column];

  if (
    value === undefined ||
    value === null
  ) {
    return undefined;
  }

  const cleaned =
    String(value).trim();

  return cleaned === ""
    ? undefined
    : cleaned;
}