import {
  salesforceFetch,
} from "./salesforceOAuth.js";


/*
 * ============================================
 * SALESFORCE API VERSION
 * ============================================
 */

const SALESFORCE_API_VERSION =
  "68.0";


/*
 * ============================================
 * DEFAULT SALESFORCE USER SETTINGS
 * ============================================
 *
 * Based on the current Cardiff Salesforce
 * administrator configuration.
 */

export const SALESFORCE_USER_DEFAULTS = {
  timeZoneSidKey:
    "America/Los_Angeles",

  localeSidKey:
    "en_US",

  emailEncodingKey:
    "ISO-8859-1",

  languageLocaleKey:
    "en_US",
};


/*
 * ============================================
 * SALESFORCE QUERY RESULT
 * ============================================
 */

export interface SalesforceQueryResult<T> {
  totalSize:
    number;

  done:
    boolean;

  records:
    T[];
}


/*
 * ============================================
 * SALESFORCE RECORD TYPES
 * ============================================
 */

export interface SalesforceUserRecord {
  Id:
    string;

  Username:
    string;

  Name:
    string;

  IsActive:
    boolean;

  ProfileId?:
    string;

  UserRoleId?:
    string;
}


export interface SalesforceProfileRecord {
  Id:
    string;

  Name:
    string;
}


export interface SalesforceRoleRecord {
  Id:
    string;

  Name:
    string;
}


export interface SalesforcePermissionSetGroupRecord {
  Id:
    string;

  DeveloperName:
    string;

  MasterLabel:
    string;

  Status?:
    string;
}


export interface CreateSalesforceUserInput {
  firstName:
    string;

  lastName:
    string;

  username:
    string;

  email:
    string;

  profileId:
    string;

  userRoleId?:
    string;
}


export interface SalesforcePermissionSetAssignmentRecord {
  Id:
    string;

  AssigneeId:
    string;

  PermissionSetGroupId?:
    string;
}


/*
 * ============================================
 * ESCAPE SOQL STRING
 * ============================================
 */

export function escapeSoqlString(
  value: string
): string {

  return value
    .replace(
      /\\/g,
      "\\\\"
    )
    .replace(
      /'/g,
      "\\'"
    );
}


/*
 * ============================================
 * GENERIC SALESFORCE QUERY
 * ============================================
 */

export async function salesforceQuery<T>(
  soql: string
): Promise<SalesforceQueryResult<T>> {

  const encodedQuery =
    encodeURIComponent(
      soql
    );


  const response =
    await salesforceFetch(
      `/services/data/v${SALESFORCE_API_VERSION}/query/?q=${encodedQuery}`
    );


  if (!response.ok) {
    const body =
      await response.text();

    throw new Error(
      `Salesforce query failed (${response.status}): ${body}`
    );
  }


  const data:
    SalesforceQueryResult<T> =
    await response.json();


  return data;
}


/*
 * ============================================
 * FIND USER BY USERNAME
 * ============================================
 */

export async function findSalesforceUserByUsername(
  username: string
): Promise<SalesforceUserRecord | undefined> {

  const escapedUsername =
    escapeSoqlString(
      username
    );


  const result =
    await salesforceQuery<SalesforceUserRecord>(
      `
        SELECT
          Id,
          Username,
          Name,
          IsActive,
          ProfileId,
          UserRoleId
        FROM User
        WHERE Username = '${escapedUsername}'
        LIMIT 1
      `
    );


  return result.records[0];
}


/*
 * ============================================
 * FIND PROFILE BY NAME
 * ============================================
 */

export async function findSalesforceProfileByName(
  profileName: string
): Promise<SalesforceProfileRecord | undefined> {

  const escapedName =
    escapeSoqlString(
      profileName
    );


  const result =
    await salesforceQuery<SalesforceProfileRecord>(
      `
        SELECT
          Id,
          Name
        FROM Profile
        WHERE Name = '${escapedName}'
        LIMIT 1
      `
    );


  return result.records[0];
}


/*
 * ============================================
 * FIND ROLE BY NAME
 * ============================================
 */

export async function findSalesforceRoleByName(
  roleName: string
): Promise<SalesforceRoleRecord | undefined> {

  const escapedName =
    escapeSoqlString(
      roleName
    );


  const result =
    await salesforceQuery<SalesforceRoleRecord>(
      `
        SELECT
          Id,
          Name
        FROM UserRole
        WHERE Name = '${escapedName}'
        LIMIT 1
      `
    );


  return result.records[0];
}


/*
 * ============================================
 * FIND PERMISSION SET GROUP
 * ============================================
 */

export async function findSalesforcePermissionSetGroup(
  groupName: string
): Promise<SalesforcePermissionSetGroupRecord | undefined> {

  const escapedName =
    escapeSoqlString(
      groupName
    );


  const result =
    await salesforceQuery<SalesforcePermissionSetGroupRecord>(
      `
        SELECT
          Id,
          DeveloperName,
          MasterLabel,
          Status
        FROM PermissionSetGroup
        WHERE
          DeveloperName = '${escapedName}'
          OR
          MasterLabel = '${escapedName}'
        LIMIT 1
      `
    );


  return result.records[0];
}


/*
 * ============================================
 * GENERATE SALESFORCE ALIAS
 * ============================================
 *
 * Salesforce Alias is limited to 8 characters.
 *
 * Example:
 *
 * MCP Test
 * -> mtest
 *
 * Anthony Daddario
 * -> adaddari
 */

export function generateSalesforceAlias(
  firstName: string,
  lastName: string
): string {

  const firstInitial =
    firstName
      .trim()
      .charAt(0);


  const cleanedLastName =
    lastName
      .replace(
        /[^a-zA-Z0-9]/g,
        ""
      );


  const alias =
    `${firstInitial}${cleanedLastName}`
      .toLowerCase()
      .slice(
        0,
        8
      );


  if (!alias) {
    throw new Error(
      "Could not generate a Salesforce Alias."
    );
  }


  return alias;
}


/*
 * ============================================
 * CREATE SALESFORCE USER
 * ============================================
 */

export async function createSalesforceUser(
  input: CreateSalesforceUserInput
) {

  const alias =
    generateSalesforceAlias(
      input.firstName,
      input.lastName
    );


  const requestBody:
    Record<string, unknown> = {

      FirstName:
        input.firstName,

      LastName:
        input.lastName,

      Username:
        input.username,

      Email:
        input.email,

      Alias:
        alias,

      ProfileId:
        input.profileId,

      TimeZoneSidKey:
        SALESFORCE_USER_DEFAULTS
          .timeZoneSidKey,

      LocaleSidKey:
        SALESFORCE_USER_DEFAULTS
          .localeSidKey,

      EmailEncodingKey:
        SALESFORCE_USER_DEFAULTS
          .emailEncodingKey,

      LanguageLocaleKey:
        SALESFORCE_USER_DEFAULTS
          .languageLocaleKey,

      IsActive:
        true,
    };


  if (input.userRoleId) {
    requestBody.UserRoleId =
      input.userRoleId;
  }


  const response =
    await salesforceFetch(
      `/services/data/v${SALESFORCE_API_VERSION}/sobjects/User`,
      {
        method:
          "POST",

        body:
          JSON.stringify(
            requestBody
          ),
      }
    );


  const data:
    any =
    await response.json();


  if (!response.ok) {
    throw new Error(
      `Salesforce user creation failed (${response.status}): ${JSON.stringify(data)}`
    );
  }


  if (!data?.id) {
    throw new Error(
      "Salesforce created the user but did not return a User Id."
    );
  }


  return {
    id:
      data.id as string,

    success:
      Boolean(
        data.success
      ),

    alias,
  };
}


/*
 * ============================================
 * SET SALESFORCE USER PASSWORD
 * ============================================
 *
 * Password is sent directly to Salesforce
 * and is never returned by our MCP.
 *
 * If Salesforce reports "invalid repeated
 * password", that means the requested password
 * is already the user's current password.
 *
 * Treat that as success so repair operations
 * remain idempotent.
 */

export async function setSalesforceUserPassword(
  userId: string,
  password: string
): Promise<{
  passwordSet: boolean;
  alreadyCurrent: boolean;
}> {

  const response =
    await salesforceFetch(
      `/services/data/v${SALESFORCE_API_VERSION}/sobjects/User/${userId}/password`,
      {
        method:
          "POST",

        body:
          JSON.stringify({
            NewPassword:
              password,
          }),
      }
    );


  if (response.ok) {
    return {
      passwordSet:
        true,

      alreadyCurrent:
        false,
    };
  }


  const body =
    await response.text();


  /*
   * ============================================
   * PASSWORD ALREADY MATCHES
   * ============================================
   *
   * Salesforce rejects setting the exact same
   * password again with:
   *
   * "invalid repeated password"
   *
   * For our onboarding repair workflow,
   * this means the password step is already
   * complete.
   */
  if (
    body
      .toLowerCase()
      .includes(
        "invalid repeated password"
      )
  ) {
    return {
      passwordSet:
        true,

      alreadyCurrent:
        true,
    };
  }


  throw new Error(
    `Salesforce password setup failed (${response.status}): ${body}`
  );
}


/*
 * ============================================
 * FIND PERMISSION SET GROUP ASSIGNMENT
 * ============================================
 *
 * Determines whether a Salesforce User already
 * has a particular Permission Set Group.
 */

export async function findSalesforcePermissionSetGroupAssignment(
  userId: string,
  permissionSetGroupId: string
): Promise<SalesforcePermissionSetAssignmentRecord | undefined> {

  const escapedUserId =
    escapeSoqlString(
      userId
    );


  const escapedGroupId =
    escapeSoqlString(
      permissionSetGroupId
    );


  const result =
    await salesforceQuery<SalesforcePermissionSetAssignmentRecord>(
      `
        SELECT
          Id,
          AssigneeId,
          PermissionSetGroupId
        FROM PermissionSetAssignment
        WHERE
          AssigneeId = '${escapedUserId}'
          AND
          PermissionSetGroupId = '${escapedGroupId}'
        LIMIT 1
      `
    );


  return result.records[0];
}


/*
 * ============================================
 * ENSURE PERMISSION SET GROUP ASSIGNMENT
 * ============================================
 *
 * Idempotent helper.
 *
 * If the User already has the Permission Set
 * Group, return the existing assignment.
 *
 * Otherwise create the assignment.
 */

export async function ensureSalesforcePermissionSetGroup(
  userId: string,
  permissionSetGroupId: string
) {

  const existing =
    await findSalesforcePermissionSetGroupAssignment(
      userId,
      permissionSetGroupId
    );


  if (existing) {
    return {
      assignmentId:
        existing.Id,

      created:
        false,
    };
  }


  const assignmentId =
    await assignSalesforcePermissionSetGroup(
      userId,
      permissionSetGroupId
    );


  return {
    assignmentId,

    created:
      true,
  };
}


/*
 * ============================================
 * ASSIGN PERMISSION SET GROUP
 * ============================================
 *
 * Permission Set Groups are assigned through
 * PermissionSetAssignment.
 */

export async function assignSalesforcePermissionSetGroup(
  userId: string,
  permissionSetGroupId: string
): Promise<string> {

  const response =
    await salesforceFetch(
      `/services/data/v${SALESFORCE_API_VERSION}/sobjects/PermissionSetAssignment`,
      {
        method:
          "POST",

        body:
          JSON.stringify({
            AssigneeId:
              userId,

            PermissionSetGroupId:
              permissionSetGroupId,
          }),
      }
    );


  const data:
    any =
    await response.json();


  if (!response.ok) {
    throw new Error(
      `Salesforce Permission Set Group assignment failed (${response.status}): ${JSON.stringify(data)}`
    );
  }


  if (!data?.id) {
    throw new Error(
      "Salesforce did not return a PermissionSetAssignment Id."
    );
  }


  return data.id;
}