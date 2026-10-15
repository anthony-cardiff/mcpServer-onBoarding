# Cardiff Onboarding MCP

A local TypeScript MCP server that automates new-hire onboarding from a Google Sheet through Google Workspace, Salesforce, Slack, Gmail, and Zoom, with Apple Business Manager account creation now in working - testing.

The design is intentionally simple:

```text
Rep Credentials Google Sheet
        ↓
MCP server
        ↓
Preview / validation tools
        ↓
Explicitly approved write tools
        ↓
Google / Salesforce / Slack / Zoom / Gmail APIs
```

The spreadsheet is the source of truth. Passwords are read only when needed, are never returned in normal MCP responses, and write actions require explicit confirmation.

## Current Status

| Integration | Status |
| --- | --- |
| Google Workspace account creation | Implemented + validated |
| Salesforce account creation / repair | Implemented + validated |
| Slack SCIM provisioning | Implemented + validated |
| Slack access email | Implemented + validated |
| Zoom + phone number provisioning | Implemented + validated |
| Apple Business Manager | Working - Testing |
| Full onboarding email / Calendar workflow | TBA |

---

# 1. Prerequisites

Install:

- Node.js 20+
- npm
- Git
- An MCP-compatible client such as Claude
- Google Workspace admin access
- Google Cloud access
- Salesforce admin access
- Slack Business+ admin access
- Zoom Business+ admin access

Clone the repo:

```bash
git clone <YOUR_REPOSITORY_URL>
cd Onboarding
npm install
npx tsc --noEmit
```

A clean compile should produce no output.

---

# 2. Project Structure

```text
Onboarding/
├── src/
│   ├── index.ts
│   ├── config/
│   │   └── columns.ts
│   ├── services/
│   │   ├── credentials.ts
│   │   ├── gmail.ts
│   │   ├── googleAdmin.ts
│   │   ├── googleOAuth.ts
│   │   ├── googleSheets.ts
│   │   ├── salesforceApi.ts
│   │   ├── salesforceOAuth.ts
│   │   ├── slackScim.ts
│   │   ├── spreadsheet.ts
│   │   ├── zoomApi.ts
│   │   └── zoomOAuth.ts
│   ├── templates/
│   │   └── slackInviteEmail.ts
│   ├── tools/
│   │   ├── googleUser.ts
│   │   ├── newHire.ts
│   │   ├── salesforceUser.ts
│   │   ├── slackInviteEmail.ts
│   │   ├── slackUser.ts
│   │   └── zoomUser.ts
│   ├── scripts/
│   │   ├── authorizeGoogle.ts
│   │   ├── testGoogleAdmin.ts
│   │   ├── testGoogleOAuth.ts
│   │   ├── testSalesforceOAuth.ts
│   │   ├── testSlackScim.ts
│   │   └── testZoomOAuth.ts
│   └── types/
│       └── employee.ts
├── .env
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

Never commit `.env`, OAuth tokens, service-account JSON, passwords, or exported onboarding data.

Recommended `.gitignore` entries:

```gitignore
node_modules/
.env
logs/
data/
*.log
.DS_Store
```

---

# 3. Environment Variables

Create `.env` in the project root.

```env
# Google
GOOGLE_SERVICE_ACCOUNT_FILE=/absolute/path/service-account.json
GOOGLE_SPREADSHEET_ID=<GOOGLE_SHEET_ID>
GOOGLE_ONBOARDING_SHEET=New Hires / New Creds
GOOGLE_CLOUD_PROJECT_ID=<GOOGLE_CLOUD_PROJECT_ID>
GOOGLE_OAUTH_CLIENT_FILE=/absolute/path/oauth-client.json
GOOGLE_OAUTH_TOKEN_FILE=/absolute/path/oauth-token.json
GOOGLE_WORKSPACE_DOMAIN=yourcompany.com

# Salesforce
SALESFORCE_LOGIN_URL=https://<company>.my.salesforce.com
SALESFORCE_CLIENT_ID=<CONSUMER_KEY>
SALESFORCE_CLIENT_SECRET=<CONSUMER_SECRET>

# Slack
SLACK_SCIM_TOKEN=<SLACK_USER_OAUTH_TOKEN>
SLACK_WORKSPACE_URL=https://your-workspace.slack.com/

# Slack access email
SLACK_INVITE_FROM_EMAIL=you@yourcompany.com
SLACK_INVITE_FROM_NAME=Your Name

# Zoom Server-to-Server OAuth
ZOOM_ACCOUNT_ID=<ZOOM_ACCOUNT_ID>
ZOOM_CLIENT_ID=<ZOOM_CLIENT_ID>
ZOOM_CLIENT_SECRET=<ZOOM_CLIENT_SECRET>
```

Store credential files outside the repo, for example:

```text
~/.config/cardiff-onboarding/
├── service-account.json
├── oauth-client.json
└── oauth-token.json
```

---

# 4. Google Cloud + Google Workspace Setup

## Create the Google Cloud project

In Google Cloud Console:

1. Create a project.
2. Enable:
   - Google Sheets API
   - Admin SDK API
   - Gmail API
   - Google Calendar API
3. Create a service account.
4. Download its JSON key and store it outside the repo.

## Give the service account Workspace admin privileges

In Google Admin:

**Account → Admin roles**

Create a custom role with the minimum required privileges.

For the current Google user creation workflow:

```text
Users
✓ Read
✓ Create
✓ Update

Organizational Units
✓ Read
```

Assign that custom admin role to the service account.

This is where service-account privileges are updated later if the MCP needs additional Workspace capabilities.

## Create user OAuth credentials

Google user OAuth is used for actions performed as your personal Google account, such as Gmail and Calendar.

Create an OAuth client in Google Cloud and authorize these scopes:

```text
https://www.googleapis.com/auth/gmail.send
https://www.googleapis.com/auth/calendar.events
https://www.googleapis.com/auth/calendar.freebusy
```

Run:

```bash
npx tsx src/scripts/authorizeGoogle.ts
```

Then test:

```bash
npx tsx src/scripts/testGoogleOAuth.ts
npx tsx src/scripts/testGoogleAdmin.ts
```

---

# 5. Google Sheet Setup

The current source is a Google Sheet containing one new hire per row.

Important mapped fields include:

```text
First Name
Last Name
Start Date
Personal Email
GM User
GM Password
Department
Direct Supervisor
Title
Salesforce
SF Role
SF Profile
SF Password
Permission Set Groups
Zoom
Direct Line
Slack Password
Location
```

The code maps these headers in:

```text
src/config/columns.ts
```

Passwords are accessed through:

```typescript
getEmployeeCredential(row, "gmPassword")
getEmployeeCredential(row, "sfPassword")
```

This keeps credentials out of normal preview responses.

---

# 6. Google Workspace Provisioning

Current tools:

```text
preview_google_user
create_google_user
```

Typical flow:

```text
Spreadsheet row
   ↓
preview_google_user
   ↓
Check fields + existing account
   ↓
create_google_user confirm=true
```

The Google account uses:

- First Name
- Last Name
- GM User as the primary email
- GM Password from the sheet
- Personal Email as recovery email

Duplicate users return a normal structured result instead of failing.

Example:

```json
{
  "success": false,
  "created": false,
  "reason": "USER_ALREADY_EXISTS",
  "primaryEmail": "user@cardiff.co"
}
```

---

# 7. Salesforce Setup

## External Client App

Use a Salesforce **External Client App** with:

```text
Enable OAuth                     ✓
Enable Client Credentials Flow   ✓
OAuth Scope:
Manage user data via APIs        ✓
```

Set the **Run As** user to an existing Salesforce admin account.

This avoids consuming a separate Salesforce license for the integration itself.

## Important: use My Domain

Client Credentials Flow must use your Salesforce My Domain URL.

Correct:

```env
SALESFORCE_LOGIN_URL=https://<company>.my.salesforce.com
```

Do not use:

```text
https://login.salesforce.com
https://test.salesforce.com
*.lightning.force.com
```

## Test Salesforce authentication

```bash
npx tsx src/scripts/testSalesforceOAuth.ts
```

Expected result:

```text
Salesforce Client Credentials authentication: SUCCESS
Authenticated Salesforce Run As user: ...
```

---

# 8. Salesforce Provisioning

Current tools:

```text
preview_salesforce_user
create_salesforce_user
```

The preview resolves:

- Username
- Profile
- Role
- Permission Set Groups
- Existing user status
- SF Password availability

The create tool:

1. Creates the User if missing.
2. Sets the password from the `SF Password` column.
3. Assigns missing Permission Set Groups.
4. Reuses an existing user if a previous provisioning attempt only partially completed.

The flow is idempotent.

If the user already exists, the tool can repair the provisioning instead of stopping:

```json
{
  "success": true,
  "created": false,
  "repaired": true,
  "reason": "USER_REPAIRED"
}
```

It also handles Salesforce's `invalid repeated password` response as success when the requested password is already current.

Current default user settings:

```text
TimeZoneSidKey: America/Los_Angeles
LocaleSidKey: en_US
EmailEncodingKey: ISO-8859-1
LanguageLocaleKey: en_US
```

---

# 9. Slack Setup

Slack provisioning currently uses the **SCIM API** on the Business+ plan.

Create a Slack app and obtain a **User OAuth Token** with the required admin/SCIM access.

Store the token in:

```env
SLACK_SCIM_TOKEN=xoxp-...
```

Test it with:

```bash
npx tsx src/scripts/testSlackScim.ts
```

Current tools:

```text
preview_slack_user
create_slack_user
```

The SCIM flow creates the Slack member. Cardiff users then authenticate with Google Workspace SSO.

No Slack password is generated by the MCP.

---

# 10. Slack Access Email

SCIM provisioning does not reliably send Slack's standard invitation email, so this project sends a separate access email through Gmail.

Current tools:

```text
preview_slack_invite_email
send_slack_invite_email
```

The email:

- Is sent from the configured Cardiff Gmail account.
- Is sent to the employee's new `@cardiff.co` mailbox.
- Contains the Slack workspace link.
- Tells the user to sign in with Google SSO.

Template:

```text
src/templates/slackInviteEmail.ts
```

The template can use a large HTML button for the Slack link.

---


# 11. Zoom Setup + User + Phone Number Provisioning

**Status: Implemented + validated**

## Zoom App Marketplace + scopes

1. Sign in to the [Zoom App Marketplace](https://marketplace.zoom.us/) with admin access. Open **Developers → Created Apps → Build an app**, select **Server-to-Server OAuth**, and create the app.
2. Complete the required app information. In **Scopes → Add Scopes**, add user-management permissions and the group permissions needed to read groups and add members, plus the phone scopes below, to this same app.
3. Activate the app and copy its credentials into `.env`:

```env
ZOOM_ACCOUNT_ID=<ZOOM_ACCOUNT_ID>
ZOOM_CLIENT_ID=<ZOOM_CLIENT_ID>
ZOOM_CLIENT_SECRET=<ZOOM_CLIENT_SECRET>
```

Required phone scopes:

| Access | Granular admin scope |
| --- | --- |
| List numbers | `number_management:read:list_numbers:admin` |
| Read number details | `number_management:read:numbers:admin` |
| Update number details | `number_management:update:numbers:admin` |
| Read phone users | `phone:read:user:admin` |
| Assign calling plans | `phone:write:calling_plan:admin` |
| Assign phone numbers | `phone:write:user_number:admin` |

For an existing app, add these scopes to that app. Admin role permissions must allow the selected scopes. Campaign and consent-policy scopes are not used.

Test authentication and Users API access:

```bash
npx tsx src/scripts/testZoomOAuth.ts
```

Setup reference: [Zoom Server-to-Server OAuth app guide](https://developers.zoom.us/docs/internal-apps/create/).

## User provisioning

```text
preview_zoom_user
create_zoom_user
```

Preview checks the spreadsheet row, existing account, Direct Line request, job title, and `Everyone` group. Creation sends Zoom's activation email and reuses or repairs existing users.

Standard settings: **Zoom Workplace unassigned**, **Zoom Phone Basic enabled**, job title from the sheet, and membership in **Everyone**. The user activates the account and signs in with their Cardiff Google account before phone provisioning.

## Phone number provisioning

- `preview_zoom_phone_options`: takes `row` and optional `phoneNumber`; lists available Zoom Phone toll numbers or validates the selected number and current assignments.
- `provision_zoom_phone`: requires `row`, `phoneNumber`, and `confirm: true`; checks the active user and **Direct Line** flag, ensures **US/CA Unlimited**, sets Display Name, assigns the number, and verifies the result.
- Existing plans and matching assignments are reused; conflicting assignments stop for review. Display Name is limited to 32 characters.
- Acquire new numbers manually in Zoom using area code **858**, city **All locations**. Caller ID Name, SMS setup, LOA, and campaign assignment remain manual; the former spreadsheet SMS flag is not read.

### Validation

```bash
node tests/zoomPhoneWorkflow.mjs
npx tsc --noEmit
```

These checks use no live API requests or credentials.

---

# 12. MCP Server + Claude / Inspector

Compile first:

```bash
npx tsc --noEmit
```

Run the MCP directly:

```bash
npx tsx src/index.ts
```

A healthy stdio server should remain running.

Do not use `console.log()` inside normal MCP server startup/tool code because stdout is the MCP protocol channel. Use `console.error()` for server diagnostics.

For development, launch MCP Inspector:

```bash
npx @modelcontextprotocol/inspector npx tsx src/index.ts
```

Useful CLI checks:

```bash
npx @modelcontextprotocol/inspector --cli npx tsx src/index.ts --method initialize
npx @modelcontextprotocol/inspector --cli npx tsx src/index.ts --method tools/list
```

For Claude Desktop or another MCP client, configure the server command to run:

```text
npx tsx /absolute/path/to/Onboarding/src/index.ts
```

---

# 13. Current MCP Tools

## Core

```text
test_connection
get_new_hire
```

## Google Workspace

```text
preview_google_user
create_google_user
```

## Salesforce

```text
preview_salesforce_user
create_salesforce_user
```

## Slack

```text
preview_slack_user
create_slack_user
preview_slack_invite_email
send_slack_invite_email
```

## Zoom

```text
preview_zoom_user
create_zoom_user
preview_zoom_phone_options
provision_zoom_phone
```

All write tools require an explicit confirmation input.

---

# 14. Common Troubleshooting

## MCP Inspector shows Failed

Run the server directly:

```bash
npx tsx src/index.ts
```

If it stays running, test MCP initialization and tool listing with Inspector CLI.

Also make sure startup/tool code is not writing to stdout with `console.log()`.

## Google `Not Authorized`

Check the service account's custom admin role in Google Admin and confirm its OU scope allows the target user.

## Google `Invalid Input`

For user searches, use the Workspace domain explicitly rather than relying on `my_customer` if your environment rejects it.

## Salesforce `invalid_grant: request not supported on this domain`

Use your Salesforce My Domain URL in `SALESFORCE_LOGIN_URL`.

## Salesforce `invalid repeated password`

The supplied password is already the current password. The provisioning code treats this as success during repair runs.

## Slack user created but no invite email arrives

Expected with SCIM. Use `send_slack_invite_email` to send the Cardiff Slack sign-in link separately.

---

# 15. Security Model

This project intentionally separates read-only and write behavior.

Recommended rules:

- Always preview before writing.
- Require `confirm: true` for create/send tools.
- Never log passwords or OAuth tokens.
- Keep `.env` and credential files out of Git.
- Use the minimum necessary admin privileges.
- Store Google credential files outside the repository.
- Treat Salesforce Consumer Secrets and Slack OAuth tokens as production secrets.

---

# 16. Apple Business Manager — Working - Testing

Apple Business account creation is the current integration focus. Implementation and testing are in progress. The provisioning approach, configuration, and tools will be documented as testing confirms them.

---

# 17. Full Onboarding Email / Calendar — TBA

A future workflow will be separate from the Slack access email and may include:

- Google credentials / instructions
- Salesforce information
- Zoom information
- Apple Business information
- Onboarding instructions
- A scheduled one-hour Google Calendar onboarding meeting

---

# 18. Recommended Development Pattern

For every new integration, follow the same sequence:

```text
1. Authenticate
2. Test read-only API access
3. Build preview_<system> tool
4. Validate against real data
5. Build confirmed write tool
6. Add duplicate / retry protection
7. Test with a controlled onboarding row
8. Update this README
```

That pattern has worked well for Google Workspace, Salesforce, Slack, and Zoom and keeps onboarding automation safe and predictable.
