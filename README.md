# Cardiff Onboarding MCP

A local TypeScript MCP server for automating new-hire onboarding from a Google Sheet.

This project is designed to let an MCP-compatible client such as Claude read a new-hire row from the **Rep Credentials** spreadsheet, preview the work that would be performed, and then execute approved onboarding actions through connected admin APIs.

The current implementation supports:

- Reading a new hire from a live Google Sheet
- Mapping onboarding fields into a normalized employee object
- Detecting whether a Google Workspace account already exists
- Previewing Google Workspace account creation
- Creating a Google Workspace account from the sheet
- Retrieving employee credentials internally without returning passwords to the MCP client
- Preventing duplicate Google account creation
- Authenticating to Salesforce with OAuth 2.0 Client Credentials Flow
- Running Salesforce API calls as an existing Salesforce administrator account
- Previewing Salesforce user provisioning against the production org
- Resolving Salesforce Profiles, Roles, and Permission Set Groups before creation
- Keeping destructive or write operations behind an explicit confirmation step

Current integration status:

- Google Workspace — **implemented and validated**
- Salesforce authentication + preview — **implemented and validated**
- Salesforce creation — **implementation in progress / validate before production use**
- Slack — **TBA**
- Zoom — **TBA**

---

## 1. Architecture Overview

The onboarding workflow is intentionally split into three layers:

```text
Google Sheet
   ↓
MCP Server
   ↓
Preview / validation tools
   ↓
Approved write tools
   ↓
External admin APIs
```

The Google Sheet is the source of truth for new-hire information.

The MCP server is responsible for:

1. Reading the employee row.
2. Normalizing spreadsheet fields.
3. Validating required values.
4. Checking the destination system.
5. Returning a preview.
6. Performing a write only after explicit approval.
7. Never returning passwords in normal MCP responses.

The current Google Workspace flow is:

```text
Rep Credentials row
   ↓
get_new_hire
   ↓
preview_google_user
   ↓
User reviews preview
   ↓
create_google_user with confirm=true
   ↓
Google Workspace Admin SDK
```

The current Salesforce flow is:

```text
Rep Credentials row
   ↓
preview_salesforce_user
   ↓
Salesforce REST API
   ↓
Check username
Resolve Profile
Resolve Role
Resolve Permission Set Groups
Check SF Password availability
   ↓
readyToCreate=true / false
```

Salesforce authentication is performed server-to-server with OAuth 2.0 Client Credentials Flow. The External Client App is configured with an existing Salesforce administrator as the **Run As** user, so a separate Salesforce integration-user license is not required.

---

## 2. Technology Stack

This project currently uses:

- Node.js
- TypeScript
- ESM modules
- MCP server SDK
- Zod v4
- Google Sheets API
- Google Admin SDK Directory API
- Google OAuth 2.0
- Google Calendar API
- Gmail API
- Salesforce REST API
- Salesforce External Client App / OAuth 2.0 Client Credentials Flow
- dotenv
- tsx

The project is designed to run locally over **stdio**, which is the standard transport used by many local MCP clients.

---

## 3. Prerequisites

Before cloning this project, install:

- Node.js 20+ recommended
- npm
- Git
- A Google Cloud project
- A Google Workspace administrator account
- Access to the onboarding spreadsheet
- An MCP-compatible client such as Claude

This project was developed on macOS.

---

## 4. Clone the Repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd Onboarding
```

Install dependencies:

```bash
npm install
```

Compile-check the TypeScript project:

```bash
npx tsc --noEmit
```

The project should compile with no errors before you attempt to connect it to an MCP client.

---

## 5. Recommended Project Structure

The project currently follows a structure similar to:

```text
Onboarding/
├── src/
│   ├── index.ts
│   │
│   ├── config/
│   │   └── columns.ts
│   │
│   ├── services/
│   │   ├── credentials.ts
│   │   ├── googleAdmin.ts
│   │   ├── googleOAuth.ts
│   │   ├── googleSheets.ts
│   │   ├── salesforceApi.ts
│   │   ├── salesforceOAuth.ts
│   │   └── spreadsheet.ts
│   │
│   ├── tools/
│   │   ├── googleUser.ts
│   │   ├── newHire.ts
│   │   └── salesforceUser.ts
│   │
│   ├── scripts/
│   │   ├── authorizeGoogle.ts
│   │   ├── testGoogleAdmin.ts
│   │   ├── testGoogleOAuth.ts
│   │   └── testSalesforceOAuth.ts
│   │
│   └── types/
│       └── employee.ts
│
├── .env
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

Do not commit service-account credentials, OAuth credentials, OAuth tokens, passwords, or exported onboarding data.

---

## 6. Environment Variables

Create a `.env` file in the project root.

Example:

```env
GOOGLE_SERVICE_ACCOUNT_FILE=/absolute/path/to/service-account.json
GOOGLE_SPREADSHEET_ID=<GOOGLE_SHEET_ID>
GOOGLE_ONBOARDING_SHEET=New Hires / New Creds
GOOGLE_CLOUD_PROJECT_ID=<GOOGLE_CLOUD_PROJECT_ID>
GOOGLE_OAUTH_CLIENT_FILE=/absolute/path/to/oauth-client.json
GOOGLE_OAUTH_TOKEN_FILE=/absolute/path/to/oauth-token.json
GOOGLE_WORKSPACE_DOMAIN=yourcompany.com

# Salesforce
SALESFORCE_LOGIN_URL=https://your-my-domain.my.salesforce.com
SALESFORCE_CLIENT_ID=<SALESFORCE_CONSUMER_KEY>
SALESFORCE_CLIENT_SECRET=<SALESFORCE_CONSUMER_SECRET>
```

For Salesforce Client Credentials Flow, use the organization's **My Domain** URL, not `https://login.salesforce.com` and not a Lightning URL. Example:

```env
SALESFORCE_LOGIN_URL=https://example.my.salesforce.com
```

Use absolute paths for credential files.

Do not put the actual credential JSON files inside the repository.

A recommended macOS location is:

```text
~/.config/<project-name>/
```

For example:

```text
~/.config/cardiff-onboarding/
├── service-account.json
├── oauth-client.json
└── oauth-token.json
```

---

## 7. `.gitignore`

At minimum, exclude:

```gitignore
node_modules/
.env
logs/
data/
*.log
.DS_Store
```

You may also explicitly exclude local credential files if you ever store them near the repository:

```gitignore
*.credentials.json
service-account.json
oauth-client.json
oauth-token.json
```

---

# Google Cloud Setup

## 8. Create a Google Cloud Project

Go to Google Cloud Console and create a project.

Example naming convention:

```text
Project name: Cardiff OB MCP
Project ID: cardiff-ob-mcp
```

Your project name and project ID do not need to match these values.

Use values appropriate for your organization.

---

## 9. Enable Required Google APIs

In Google Cloud Console:

**APIs & Services → Library**

Enable:

- Google Sheets API
- Admin SDK API
- Gmail API
- Google Calendar API

The current Google Workspace provisioning flow depends on:

- Google Sheets API
- Admin SDK Directory API

The OAuth portions depend on:

- Gmail API
- Google Calendar API

---

# Google Service Account Setup

## 10. Create the Service Account

In Google Cloud Console:

**IAM & Admin → Service Accounts → Create service account**

Example:

```text
Service account name:
Cardiff OB MCP
```

After creation, note the service-account email.

Example format:

```text
cardiff-onboarding@your-project-id.iam.gserviceaccount.com
```

---

## 11. Create a Service Account Key

Open the service account.

Go to:

**Keys → Add key → Create new key → JSON**

Download the JSON key.

Move it outside the project repository.

Example:

```text
~/.config/cardiff-onboarding/service-account.json
```

Then reference that file from `.env`:

```env
GOOGLE_SERVICE_ACCOUNT_FILE=/Users/yourname/.config/cardiff-onboarding/service-account.json
```

Never commit this file to GitHub.

---

# Google Workspace Admin Setup

## 12. Create a Custom Admin Role

The service account must also be authorized inside Google Workspace.

This is separate from permissions inside Google Cloud.

In Google Admin Console go to:

**Account → Admin roles**

Create a custom role such as:

```text
Cardiff Onboarding MCP Provisioner
```

For the current Google account workflow, grant only the minimum privileges required.

Recommended privileges:

```text
Users
  ✓ Read
  ✓ Create
  ✓ Update

Organizational Units
  ✓ Read
```

Do not grant Super Admin unless there is a specific documented requirement.

Do not grant delete privileges merely because the account can create users.

Use least privilege.

---

## 13. Assign the Service Account to the Admin Role

Open the custom role you created.

Assign the service-account email as an administrator/service account.

Example:

```text
cardiff-onboarding@your-project-id.iam.gserviceaccount.com
```

For initial testing, assign the role across all organizational units if the create-user operation is expected to create users in the root OU.

You can tighten the scope later.

### Where to update service-account privileges later

Return to:

**Google Admin Console → Account → Admin roles → <your custom MCP role>**

That is where Workspace privileges are changed.

Google Cloud IAM and Google Workspace Admin roles are separate permission systems.

---

## 14. Service Account vs User OAuth

This project intentionally uses two Google identities.

### Service account

Used for machine/admin operations such as:

- Reading Google Sheets
- Looking up Workspace users
- Creating Workspace users
- Future admin automation

### User OAuth

Used for actions that should happen as a real employee, such as:

- Sending onboarding email from the employee's Gmail account
- Reading calendar availability
- Creating the onboarding meeting

This separation keeps admin operations separate from user-level actions.

---

# Google OAuth Setup

## 15. Configure the OAuth Consent Screen

In Google Cloud Console:

**APIs & Services → OAuth consent screen**

Configure the application for your organization.

If the application is in testing mode, add the intended user as a test user.

---

## 16. Create an OAuth Client

Go to:

**APIs & Services → Credentials → Create credentials → OAuth client ID**

Create the OAuth client used by the employee who will send onboarding emails and own calendar events.

Example name:

```text
Cardiff OB MCP - Anthony
```

Download the OAuth client JSON and store it outside the repository.

Example:

```text
~/.config/cardiff-onboarding/oauth-client.json
```

Reference it in `.env`:

```env
GOOGLE_OAUTH_CLIENT_FILE=/Users/yourname/.config/cardiff-onboarding/oauth-client.json
GOOGLE_OAUTH_TOKEN_FILE=/Users/yourname/.config/cardiff-onboarding/oauth-token.json
```

The token file is generated by the authorization script.

Do not manually create an empty token file.

---

## 17. OAuth Scopes

The current project uses scopes similar to:

```typescript
export const GOOGLE_USER_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
];
```

These allow the authorized user to:

- Send Gmail messages
- Create/update calendar events
- Check free/busy availability

Add scopes only when a new workflow requires them.

---

## 18. Authorize the User

Run the authorization script:

```bash
npx tsx src/scripts/authorizeGoogle.ts
```

A browser window should open.

Sign in with the user account that should own the future onboarding email and calendar events.

After successful authorization, the OAuth token is saved to the configured token path.

---

## 19. Test User OAuth

Run:

```bash
npx tsx src/scripts/testGoogleOAuth.ts
```

A successful test confirms that the stored OAuth credentials can access the configured APIs.

---

## 20. Test Google Admin SDK Access

Run:

```bash
npx tsx src/scripts/testGoogleAdmin.ts
```

A successful test confirms that:

- The service account can authenticate
- Google Workspace recognizes the service account
- The assigned custom admin role is working

---

# Google Sheet Setup

## 21. Spreadsheet Requirements

The project currently expects a Google Sheet containing onboarding information.

The relevant sheet/tab name is configured through:

```env
GOOGLE_ONBOARDING_SHEET=New Hires / New Creds
```

The spreadsheet ID is configured with:

```env
GOOGLE_SPREADSHEET_ID=<GOOGLE_SHEET_ID>
```

The sheet should contain fields used by the employee mapper.

Current examples include:

```text
First Name
Last Name
Start Date
Cell
Personal Email
Department
Direct Supervisor
Title
Location
GM User
GM Password
Salesforce
SF Role
SF Profile
SF Password
Permission Set
Permission Set Groups
Managed Package
Slack User Mapping
Slack Password
Zoom
Direct Line
SMS
Zoom Password
Computer Password
ABM Password
```

Not every field is required for Google provisioning.

---

## 22. Google Account Fields

For the current Google account creation workflow, the important fields are:

```text
First Name
Last Name
GM User
GM Password
Personal Email
```

`GM User` is treated as the new Workspace account email.

`GM Password` is retrieved internally by the MCP server.

`Personal Email` can be used as the recovery email.

---

# Salesforce Setup

## 23. Create a Salesforce External Client App

In Salesforce Setup, create an **External Client App** for the onboarding MCP.

A typical configuration is:

```text
External Client App Name:
Cardiff Onboarding MCP

Enable OAuth:
✓

Enable Client Credentials Flow:
✓

OAuth Scope:
Manage user data via APIs (api)
```

For this project, Salesforce authentication is intentionally server-to-server. Interactive Device Flow is not required.

---

## 24. Configure the Run As User

Client Credentials Flow executes every API call as the External Client App's configured **Run As** user.

Use an existing administrator account when appropriate for your organization's licensing and security model. This avoids consuming another Salesforce user license solely for the integration.

Important: the MCP receives all API permissions available to the Run As user. Treat the Consumer Secret as a high-value credential.

---

## 25. Salesforce IP Restrictions

If the External Client App policy enforces IP restrictions, make sure the machine running the MCP is allowed by Salesforce.

Possible places to review include:

```text
Setup → Security → Network Access
Setup → Profiles → <Run As Profile> → Login IP Ranges
External Client App → Policies → IP Relaxation
```

No application-code change is required merely to whitelist an IP address.

---

## 26. Salesforce Environment Variables

Add the following to `.env`:

```env
SALESFORCE_LOGIN_URL=https://your-my-domain.my.salesforce.com
SALESFORCE_CLIENT_ID=<CONSUMER_KEY>
SALESFORCE_CLIENT_SECRET=<CONSUMER_SECRET>
```

Do not commit these values.

Client Credentials Flow does **not** require a Salesforce refresh-token file or an interactive browser authorization script. The MCP requests an access token directly from Salesforce when needed and can cache that token in memory for the life of the process.

---

## 27. Test Salesforce Authentication

Run:

```bash
npx tsx src/scripts/testSalesforceOAuth.ts
```

A successful test should confirm:

- Client Credentials authentication succeeded
- The correct Salesforce instance / My Domain is being used
- REST API access is available
- The expected Run As user is authenticated

Example safe output:

```text
Salesforce Client Credentials authentication: SUCCESS
Instance: https://your-domain.my.salesforce.com
Latest available API version: 68.0

Authenticated Salesforce Run As user:
{
  userId: '005...',
  organizationId: '00D...',
  username: 'admin@example.com',
  name: 'Example Admin'
}

Salesforce OAuth test completed successfully.
```

Never print or paste the Consumer Secret or access token.

---

## 28. Common Salesforce Authentication Error

If Client Credentials Flow returns:

```text
invalid_grant: request not supported on this domain
```

check `SALESFORCE_LOGIN_URL`. Client Credentials Flow should target the org's **My Domain** URL, for example:

```env
SALESFORCE_LOGIN_URL=https://example.my.salesforce.com
```

Do not use:

```text
https://login.salesforce.com
https://test.salesforce.com
https://example.lightning.force.com
```

---

## 29. Salesforce User Preview

The read-only MCP tool is:

```text
preview_salesforce_user
```

It reads the live onboarding row and checks:

- whether Salesforce provisioning is required
- whether the Salesforce username already exists
- whether `SF Password` is available
- whether the requested Profile exists
- whether the requested Role exists
- whether each requested Permission Set Group exists

Example input:

```json
{
  "row": 98
}
```

Example response:

```json
{
  "row": 98,
  "firstName": "MCP",
  "lastName": "Test",
  "salesforceRequired": true,
  "username": "mcptester@example.com",
  "passwordAvailable": true,
  "existingUser": false,
  "profile": {
    "requested": "OperationsTeam",
    "found": true,
    "id": "00e...",
    "name": "OperationsTeam"
  },
  "role": {
    "requested": "Underwriting",
    "found": true,
    "id": "00E...",
    "name": "Underwriting"
  },
  "permissionSetGroups": [
    {
      "requested": "Sales New_Einstein",
      "found": true,
      "id": "0PG...",
      "developerName": "Sales_New_Einstein",
      "label": "Sales New_Einstein"
    }
  ],
  "readyToCreate": true
}
```

No Salesforce records are changed by the preview tool.

---

## 30. Salesforce Password Handling

The Salesforce password comes from the onboarding sheet's **`SF Password`** column.

The intended flow is:

```text
Rep Credentials
   ↓
SF Password
   ↓
getEmployeeCredential(row, "sfPassword")
   ↓
Salesforce User creation
   ↓
Salesforce user-password endpoint
```

The password is not generated by the MCP, is not stored in `.env`, and must never be returned in an MCP response.

Salesforce user creation and password assignment are separate API operations. This means provisioning is not a single atomic transaction; if user creation succeeds and a later password or permission assignment fails, inspect and finish that partial user instead of blindly retrying creation.

---

## 31. Salesforce Defaults

The current implementation uses these Salesforce user defaults unless the onboarding model is expanded later:

```text
TimeZoneSidKey: America/Los_Angeles
LocaleSidKey: en_US
EmailEncodingKey: ISO-8859-1
LanguageLocaleKey: en_US
```

The Alias is generated from the employee's first initial plus last name and truncated to Salesforce's 8-character Alias limit.

---

# Credential Safety

## 32. Password Handling

The onboarding spreadsheet currently contains credential fields.

These credentials must never be returned by normal MCP tools.

The project uses a protected helper such as:

```typescript
await getEmployeeCredential(
  row,
  "gmPassword"
);
```

Other supported credential keys may include:

```text
gmPassword
sfPassword
computerPassword
abmPassword
slackPassword
zoomPassword
```

This provides one controlled place for credential access.

Normal tools should expose only whether a credential exists:

```json
{
  "passwordAvailable": true
}
```

They should never expose the actual password.

---

## 33. Never Log Credentials

Do not use:

```typescript
console.log(password);
```

Do not include credentials in:

- MCP tool responses
- structuredContent
- error messages
- logs
- GitHub issues
- screenshots

---

# Employee Mapping

## 34. Normalized Employee Model

Spreadsheet rows are mapped into a normalized structure before tools use them.

Example shape:

```typescript
export interface NewHire {
  row: number;
  firstName?: string;
  lastName?: string;
  startDate?: string;
  phone?: string;
  personalEmail?: string;
  cardiffEmail?: string;
  department?: string;
  manager?: string;
  title?: string;
  location?: string;

  salesforce: {
    username?: string;
    role?: string;
    profile?: string;
    userRequired?: boolean;
    permissionSetRequired?: boolean;
    permissionSetGroups: string[];
    managedPackageRequired?: boolean;
  };

  slack: {
    userMapping?: string;
  };

  zoom: {
    accountRequired?: boolean;
    directLineRequired?: boolean;
    smsRequired?: boolean;
  };

  credentialsAvailable: {
    gmPassword: boolean;
    sfPassword: boolean;
    computerPassword: boolean;
    abmPassword: boolean;
    slackPassword: boolean;
    zoomPassword: boolean;
  };
}
```

This prevents individual tools from needing to understand raw spreadsheet layout.

---

## 35. Column Mapping

Spreadsheet header names are centralized in:

```text
src/config/columns.ts
```

Example:

```typescript
export const COLUMNS = {
  firstName: "First Name",
  lastName: "Last Name",
  startDate: "Start Date",
  phone: "Cell",
  personalEmail: "Personal Email",
  cardiffEmail: "GM User",
  department: "Department",
  manager: "Direct Supervisor",
  title: "Title",
  location: "Location",

  salesforceUsername: "GM User",
  salesforceUserRequired: "Salesforce",
  salesforceRole: "SF Role",
  salesforceProfile: "SF Profile",
  permissionSetRequired: "Permission Set",
  permissionSetGroups: "Permission Set Groups",
  managedPackageRequired: "Managed Package",

  slackUserMapping: "Slack User Mapping",

  zoomAccountRequired: "Zoom",
  zoomDirectLineRequired: "Direct Line",
  zoomSmsRequired: "SMS",

  gmPassword: "GM Password",
  sfPassword: "SF Password",
  computerPassword: "Computer Password",
  abmPassword: "ABM Password",
  slackPassword: "Slack Password",
  zoomPassword: "Zoom Password",
};
```

Centralizing these values means the rest of the code does not need hard-coded spreadsheet column positions.

---

# MCP Server

## 36. What Is MCP?

MCP stands for **Model Context Protocol**.

It allows an AI client to discover and call tools provided by another process.

In this project, the onboarding application acts as an MCP server.

Claude or another MCP client acts as the MCP client.

The MCP client does not directly manipulate Google Workspace.

Instead:

```text
Claude
  ↓
MCP tool call
  ↓
Onboarding MCP server
  ↓
Google API
```

This makes the MCP server the enforcement layer for validation, approvals, and credential handling.

---

## 37. Stdio Transport

The server currently runs using stdio.

That means the MCP protocol communicates over the process's standard input and standard output streams.

Because stdout is reserved for MCP protocol traffic, avoid ordinary logging to stdout in server code.

Prefer:

```typescript
console.error("Cardiff Onboarding MCP running on stdio");
```

Avoid startup logging like:

```typescript
console.log("Server started");
```

A normal `console.log()` can corrupt the stdio MCP protocol stream.

Standalone scripts under `src/scripts/` may use `console.log()` because they are not running as the MCP server.

---

## 38. Start the MCP Server Directly

To verify that the server starts:

```bash
npx tsx src/index.ts
```

A healthy stdio MCP server normally appears to "sit there" waiting for an MCP client.

That is expected.

Stop it with:

```text
Control + C
```

---

# MCP Inspector

## 39. Launch MCP Inspector

MCP Inspector is extremely useful while developing tools.

Run:

```bash
npx @modelcontextprotocol/inspector npx tsx src/index.ts
```

The browser UI should open.

From Inspector you can:

- Connect to the server
- List tools
- Call tools manually
- Inspect structured responses
- Test input schemas

---

## 40. CLI Inspector Debugging

If the browser Inspector reports only a generic failure, test through CLI mode.

Handshake test:

```bash
npx @modelcontextprotocol/inspector --cli npx tsx src/index.ts --method initialize
```

Tool-list test:

```bash
npx @modelcontextprotocol/inspector --cli npx tsx src/index.ts --method tools/list
```

This helps separate:

```text
Server startup problem
vs.
MCP protocol problem
vs.
Tool registration/schema problem
vs.
Browser Inspector problem
```

---

# Current MCP Tools

## 41. `get_new_hire`

Reads a new-hire row from the live Google Sheet.

Example input:

```json
{
  "row": 98
}
```

The result contains normalized employee data but does not return passwords.

Instead it reports credential availability.

---

## 42. `preview_google_user`

Read-only tool.

It:

1. Reads the live employee row.
2. Maps the employee.
3. Checks whether a GM password exists.
4. Checks Google Workspace for the requested account.
5. Reports whether account creation is ready.

Example response:

```json
{
  "row": 98,
  "firstName": "MCP",
  "lastName": "Test",
  "primaryEmail": "mcptester@example.com",
  "personalEmail": "employee@example.net",
  "passwordAvailable": true,
  "changePasswordAtNextLogin": false,
  "existingAccount": false,
  "readyToCreate": true
}
```

No write is performed.

---

## 43. `create_google_user`

Write tool.

Requires explicit confirmation.

Example input:

```json
{
  "row": 98,
  "confirm": true
}
```

The tool retrieves the GM password internally and calls Google Workspace Admin SDK `users.insert`.

The password is not returned.

Successful response example:

```json
{
  "success": true,
  "created": true,
  "reason": "USER_CREATED",
  "row": 98,
  "userCreated": {
    "id": "<GOOGLE_USER_ID>",
    "primaryEmail": "mcptester@example.com",
    "fullName": "MCP Test",
    "orgUnitPath": "/"
  },
  "passwordReturned": false
}
```

---

## 44. Duplicate User Protection

Account creation checks for an existing Workspace account before attempting creation.

If the account already exists, the tool returns a normal structured response rather than a tool failure:

```json
{
  "success": false,
  "created": false,
  "reason": "USER_ALREADY_EXISTS",
  "primaryEmail": "mcptester@example.com"
}
```

The create flow also handles a possible HTTP 409 race condition in case the account is created between the existence check and the `users.insert` call.

This makes repeated runs safer and more idempotent.

---

# Google Workspace User Lookup

## 45. Existing User Check

The project uses the Workspace domain configured in:

```env
GOOGLE_WORKSPACE_DOMAIN=yourcompany.com

# Salesforce
SALESFORCE_LOGIN_URL=https://your-my-domain.my.salesforce.com
SALESFORCE_CLIENT_ID=<SALESFORCE_CONSUMER_KEY>
SALESFORCE_CLIENT_SECRET=<SALESFORCE_CONSUMER_SECRET>
```

For Salesforce Client Credentials Flow, use the organization's **My Domain** URL, not `https://login.salesforce.com` and not a Lightning URL. Example:

```env
SALESFORCE_LOGIN_URL=https://example.my.salesforce.com
```

A list/search approach can be used to determine whether a user exists.

This avoids depending entirely on a direct `users.get()` call for unknown addresses.

After creating an account, rerunning the preview should normally show:

```json
{
  "existingAccount": true,
  "readyToCreate": false
}
```

---

# Claude / MCP Client Setup

## 46. Connecting Claude to the Local MCP Server

The exact MCP configuration depends on which Claude client you use.

A typical local stdio configuration looks conceptually like:

```json
{
  "mcpServers": {
    "cardiff-onboarding": {
      "command": "npx",
      "args": [
        "tsx",
        "/absolute/path/to/Onboarding/src/index.ts"
      ],
      "cwd": "/absolute/path/to/Onboarding"
    }
  }
}
```

Use absolute paths.

If your client supports environment variables in the MCP configuration, they may be passed there. Otherwise, the project loads them from `.env`.

After changing MCP client configuration, fully restart the client so the MCP process is relaunched.

---

## 47. Claude Workflow

A recommended operator workflow is:

```text
User asks Claude to onboard employee row X
   ↓
Claude calls get_new_hire
   ↓
Claude calls preview_google_user
   ↓
Claude explains what will happen
   ↓
Human approves
   ↓
Claude calls create_google_user with confirm=true
```

Do not allow the AI client to bypass preview/approval for administrative write operations.

---

# Development Workflow

## 48. Compile Before Restarting Inspector

Before restarting the MCP server:

```bash
npx tsc --noEmit
```

This catches TypeScript issues before runtime.

---

## 49. Restart Inspector After Code Changes

When changing MCP tool definitions or schemas, restart the MCP server/Inspector.

A running process does not automatically reload source changes unless you intentionally use a watch/reload setup.

---

## 50. Debugging Tool Registration

If the MCP server starts normally but Inspector fails when connecting, temporarily disable newly added tools.

For example:

```typescript
registerNewHireTools(server);
// registerGoogleUserTools(server);
```

Then test `tools/list` again.

This can quickly isolate a schema or registration problem.

---

## 51. TypeScript Import Casing

Be consistent with filename casing.

For example, if the file is:

```text
src/services/googleSheets.ts
```

then import it as:

```typescript
import {
  getGoogleSheetRow,
} from "../services/googleSheets.js";
```

Do not mix:

```text
googleSheets.ts
googlesheets.ts
```

macOS can sometimes hide casing mistakes that later fail in TypeScript or on Linux.

---

# Common Errors

## 52. `Not Authorized to access this resource/api`

This usually indicates a Google Workspace Admin authorization issue.

Check:

1. Admin SDK API is enabled.
2. The service account is assigned to the Workspace custom admin role.
3. The role includes the required Users privileges.
4. The role assignment covers the relevant organizational unit.
5. The service-account email is the same one referenced by the key file.

Remember that Google Cloud IAM access and Google Workspace Admin privileges are separate.

---

## 53. `Invalid Input` During User Lookup

If a Directory API list call fails with `Invalid Input`, verify:

- The configured Workspace domain is correct.
- The API request uses that domain.
- The email lookup syntax is valid.
- The email belongs to the intended Workspace domain.

Use:

```env
GOOGLE_WORKSPACE_DOMAIN=yourcompany.com

# Salesforce
SALESFORCE_LOGIN_URL=https://your-my-domain.my.salesforce.com
SALESFORCE_CLIENT_ID=<SALESFORCE_CONSUMER_KEY>
SALESFORCE_CLIENT_SECRET=<SALESFORCE_CONSUMER_SECRET>
```

For Salesforce Client Credentials Flow, use the organization's **My Domain** URL, not `https://login.salesforce.com` and not a Lightning URL. Example:

```env
SALESFORCE_LOGIN_URL=https://example.my.salesforce.com
```

rather than hard-coding the domain throughout the codebase.

---

## 54. MCP Inspector Shows `Failed`

First test the server directly:

```bash
npx tsx src/index.ts
```

If it remains running, the MCP process is likely healthy.

Then test:

```bash
npx @modelcontextprotocol/inspector --cli npx tsx src/index.ts --method initialize
```

and:

```bash
npx @modelcontextprotocol/inspector --cli npx tsx src/index.ts --method tools/list
```

Also verify that server code is not using `console.log()` during stdio execution.

---

# Security Model

## 55. Principles

This project should follow these rules:

- Preview before write.
- Explicit confirmation before provisioning.
- Never return passwords.
- Never log passwords.
- Keep secrets outside Git.
- Use least-privilege admin roles.
- Use separate identities for machine/admin actions and user-owned actions.
- Make create operations safe to retry.
- Return structured reasons such as `USER_ALREADY_EXISTS` instead of unnecessary tool failures.

---

## 56. Production Hardening Ideas

Before treating this as a production onboarding platform, consider adding:

- Audit logging without secrets
- Per-action timestamps
- Approval records
- Row-level onboarding status
- Retry handling
- API rate-limit handling
- Better validation of corporate email domains
- Protected secret storage instead of spreadsheet passwords
- Role-based access to the MCP client
- Test and sandbox environments
- Automated integration tests
- Idempotency checks for every destination system

---

# Planned Integrations

## 57. Salesforce — Current Status

Implemented and validated:

- OAuth 2.0 Client Credentials authentication
- External Client App configured with an existing admin as Run As user
- Production REST API connectivity
- Read-only `preview_salesforce_user`
- Existing-user lookup
- Profile lookup by name
- Role lookup by name
- Permission Set Group lookup by label or DeveloperName
- SF Password availability check without exposing the password

Next / validate before production use:

- `create_salesforce_user`
- Set the password from `SF Password`
- Assign requested Permission Set Groups
- Add partial-provisioning recovery / retry behavior
- Verify the final Salesforce user
- Add any required individual Permission Sets or managed-package handling

Target tool pattern:

```text
preview_salesforce_user
create_salesforce_user
verify_salesforce_user
```

---

## 58. Slack — TBA

Planned responsibilities may include:

- Preview Slack provisioning
- Invite/create user
- Map employee information
- Assign relevant channels or groups where appropriate
- Verify account status
- Avoid duplicate invites/accounts

Likely tool pattern:

```text
preview_slack_user
create_slack_user
verify_slack_user
```

**Implementation: TBA**

---

## 59. Zoom — TBA

Planned responsibilities may include:

- Preview Zoom user creation
- Create the Zoom user
- Assign licensing
- Configure direct phone number when requested
- Configure SMS when requested
- Verify provisioning

Sheet flags already support concepts such as:

```text
Zoom
Direct Line
SMS
```

Likely tool pattern:

```text
preview_zoom_user
create_zoom_user
verify_zoom_user
```

**Implementation: TBA**

---

# Future Final Onboarding Workflow

Once Salesforce, Slack, and Zoom are implemented, the target workflow is approximately:

```text
Read employee row
   ↓
Validate onboarding data
   ↓
Preview Google account
   ↓
Create Google account
   ↓
Preview Salesforce user
   ↓
Create Salesforce user
   ↓
Preview Slack user
   ↓
Create Slack user
   ↓
Preview Zoom user
   ↓
Create Zoom user
   ↓
Send onboarding email from authorized Gmail account
   ↓
Check onboarding owner's Calendar availability
   ↓
Create one-hour onboarding meeting on employee start date
   ↓
Invite employee personal email + new company email
   ↓
Verify onboarding completion
```

The AI should propose actions and times, while sensitive writes remain behind explicit human approval.

---

# Example Setup Checklist

Use this when setting up the repository on a new machine.

```text
[ ] Install Node.js and npm
[ ] Clone repository
[ ] npm install
[ ] Create .env
[ ] Create Google Cloud project
[ ] Enable Sheets API
[ ] Enable Admin SDK API
[ ] Enable Gmail API
[ ] Enable Calendar API
[ ] Create service account
[ ] Download service-account JSON
[ ] Store service-account JSON outside repo
[ ] Create Google Workspace custom admin role
[ ] Assign service account to admin role
[ ] Create OAuth client
[ ] Store OAuth client JSON outside repo
[ ] Run authorizeGoogle.ts
[ ] Run testGoogleOAuth.ts
[ ] Run testGoogleAdmin.ts
[ ] Configure spreadsheet ID
[ ] Configure sheet tab name
[ ] Configure Workspace domain
[ ] npx tsc --noEmit
[ ] Start MCP server directly
[ ] Test MCP Inspector initialize
[ ] Test MCP Inspector tools/list
[ ] Test get_new_hire
[ ] Test preview_google_user on existing account
[ ] Test preview_google_user on non-existing account
[ ] Test create_google_user with a controlled test row
[ ] Verify account in Google Admin
[ ] Rerun preview and confirm existingAccount=true
[ ] Configure Claude / MCP client
[ ] Create Salesforce External Client App
[ ] Enable OAuth + Client Credentials Flow
[ ] Add OAuth scope: Manage user data via APIs (api)
[ ] Configure Salesforce Run As user
[ ] Whitelist MCP host IP if Salesforce policy requires it
[ ] Set SALESFORCE_LOGIN_URL to the org My Domain URL
[ ] Add Salesforce Consumer Key and Consumer Secret to .env
[ ] Run testSalesforceOAuth.ts
[ ] Confirm authenticated Salesforce Run As user
[ ] Test preview_salesforce_user on an existing user
[ ] Test preview_salesforce_user on a non-existing user
[ ] Verify Profile, Role, and Permission Set Group resolution
[ ] Validate create_salesforce_user in a controlled test before production use
```

---

# Maintainer Notes

The project is intentionally being built incrementally.

Do not rush directly into a single "onboard everything" tool.

Keep integrations modular so each system can be previewed, tested, and verified independently.

A strong pattern for each integration is:

```text
Read
  ↓
Preview
  ↓
Approve
  ↓
Create / Update
  ↓
Verify
```

This keeps the automation understandable, testable, and much safer to operate.

---

## Status

### Implemented

- Google Sheet ingestion
- Employee normalization
- Protected credential retrieval
- Google Workspace user lookup
- Google Workspace user preview
- Google Workspace user creation
- Duplicate-user handling
- Explicit confirmation for Google account creation
- Google OAuth foundation
- Gmail/Calendar authorization foundation
- MCP Inspector development workflow
- Salesforce Client Credentials authentication
- Salesforce production REST API connection
- Salesforce Run As administrator authentication
- Salesforce user preview
- Salesforce Profile resolution
- Salesforce Role resolution
- Salesforce Permission Set Group resolution

### In Progress

- Salesforce user creation / password / Permission Set Group assignment validation

### TBA

- Slack provisioning
- Zoom provisioning
- Onboarding email send workflow
- Automated Calendar event scheduling
- End-to-end onboarding orchestration



## Current MCP Tools

The MCP currently exposes the following tools:

- `test_connection` — verifies that the MCP server is running and reachable.
- `get_new_hire` — reads a new-hire row from the live Rep Credentials Google Sheet without returning passwords.
- `preview_google_user` — read-only preview of the Google Workspace account that would be created, including duplicate detection and password availability.
- `create_google_user` — creates the Google Workspace account from the live sheet, using the stored `GM Password` internally and returning a normal `USER_ALREADY_EXISTS` result when appropriate.
- `preview_salesforce_user` — read-only Salesforce preview that checks whether Salesforce is required, verifies the username is available, resolves the requested Profile and Role, resolves Permission Set Groups, and checks whether an `SF Password` is available.
- `create_salesforce_user` — creates the Salesforce User record, sets the password from the `SF Password` column, assigns requested Permission Set Groups, and prevents duplicate user creation.

Planned tools / integrations:

- Salesforce post-provisioning refinements — TBA
- Slack provisioning — TBA
- Zoom provisioning — TBA
- Final onboarding email and Calendar scheduling workflow — TBA
