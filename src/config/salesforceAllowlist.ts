/*
 * ============================================
 * SALESFORCE PROVISIONING ALLOWLISTS
 * ============================================
 *
 * Defense-in-depth protection for onboarding.
 *
 * Only explicitly approved values may be assigned,
 * even if the integration user has broader access.
 *
 * Names are exact and case-sensitive.
 */


/*
 * ============================================
 * ALLOWED PROFILES
 * ============================================
 *
 * Uses Profile.Name.
 */

export const ALLOWED_SALESFORCE_PROFILES:
  ReadonlySet<string> =
  new Set<string>([
    "Account Manager",
    "Cardiff User",
    "Commission Only",
    "Contract Manager",
    "Dashboard Only Access",
    "Disposition Only",
    "Engagement Manager",
    "Influencer",
    "Influencer Marketeer",
    "Leadership",
    "Manager",
    "Marketing Analytics - External",
    "Marketing Consultant",
    "Marketing User",
    "Minimum Access - Salesforce",
    "MX Sales",
    "New Hire",
    "Operations",
    "Operations Team",
    "OperationsTeam",
    "PPC",
    "Read Only",
    "Read Only Sys Admin",
    "Read Only Viewer",
    "Renewals",
    "Sales Account Executive",
    "Service Agent",
    "Service Supervisor",
    "Solution Manager",
    "Standard Cardiff User",
    "Standard User",
    "The Fraternity",
    "Underwriting",
  ]);


/*
 * ============================================
 * ALLOWED PERMISSION SET GROUPS
 * ============================================
 *
 * Uses PermissionSetGroup.DeveloperName.
 */

export const ALLOWED_SALESFORCE_PERMISSION_SET_GROUPS:
  ReadonlySet<string> =
  new Set<string>([
    "Commerce_Shopper",
    "CommerceUsers",
    "Equipment",
    "GeneralUsers",
    "Influencer",
    "LASER_Credit_Access",
    "Lead_Manager",
    "Leadership",
    "MarketingUsers",
    "MX_Sales",
    "Operations",
    "Renewals",
    "Sales",
    "SalesCloudCallCoachingSeller",
    "SalesCloudSeller",
    "Sales_New_Einstein",
    "Sales_Tools",
    "SalesWorkspacePSG",
    "SalesUsers",
    "ScaleCenterUsers",
  ]);


/*
 * ============================================
 * ALLOWED PERMISSION SETS
 * ============================================
 *
 * Uses PermissionSet.Name (API name), reserved for future assignment.
 */

export const ALLOWED_SALESFORCE_PERMISSION_SETS:
  ReadonlySet<string> =
  new Set<string>([
    "SlackServiceUser",
    "StandardEinsteinActivityCapturePsl",
    "StandardEinsteinActivityCapture2Psl",
    "StockRotationReadOnlyPsl",
    "Submissions_Module_Users",
    "Super_Users",
    "TableauNextLimitedViewer",
    "Temp_Modify_All_Access",
    "TransactionDisputeManagementAI",
    "TrustCardManagerPsl",
    "Turndown_Lender_Submissions",
    "Turndown_Lender_Submissions_No_Master_Permission",
    "Twillio_Administrator",
    "Twilio_Community_User",
    "Twilio_User",
    "TwilioUserOverride",
    "Update_Email_Messages",
    "UseChannelPartnerInvforExprcCloudPsl",
    "UseSetupWithAgentforce",
    "DealRiskInsightDetailForPipelineInspection",
    "SalesCloudAIForPartners",
    "View_Modify_All_Permission",
    "Waive_Multi_Factor_Authentication_for_Exempt_Users",
    "EinsteinGPTWorkSummaries",
    "Zapier_No_Auth_Webhook",
    "Zoom_Admin",
    "Zoom_Audit_Field_Editor",
    "Zoom_Contact_Center_Admin",
    "Zoom_Contact_Center_Agent",
    "Zoom_Event_User",
    "Zoom_Meeting_User",
    "Zoom_Phone_User",
    "Zoom_Revenue_Accelerator",
    "Zoom_Scheduler_User",
    "Zoom_Webinar_User",
  ]);


/*
 * ============================================
 * VALIDATE APPROVED SALESFORCE ACCESS
 * ============================================
 *
 * Reject unapproved values before provisioning.
 */


export function assertAllowedSalesforceProfile(
  profileName: string
): void {

  if (
    !ALLOWED_SALESFORCE_PROFILES.has(
      profileName
    )
  ) {
    throw new Error(
      `Salesforce Profile "${profileName}" is not approved for MCP provisioning.`
    );
  }
}


export function assertAllowedSalesforcePermissionSetGroup(
  developerName: string
): void {

  if (
    !ALLOWED_SALESFORCE_PERMISSION_SET_GROUPS.has(
      developerName
    )
  ) {
    throw new Error(
      `Salesforce Permission Set Group "${developerName}" is not approved for MCP provisioning.`
    );
  }
}


/*
 * ============================================
 * RESOLVE APPROVED PERMISSION SET GROUP INPUT
 * ============================================
 *
 * Explicit spreadsheet label aliases only.
 * Validate the DeveloperName before any lookup.
 */

export function resolveAllowedSalesforcePermissionSetGroup(
  groupName: string
): string {

  const developerName =
    groupName === "LASER Credit Access"
      ? "LASER_Credit_Access"
      : groupName;


  assertAllowedSalesforcePermissionSetGroup(
    developerName
  );


  return developerName;
}


export function assertAllowedSalesforcePermissionSet(
  permissionSetName: string
): void {

  if (
    !ALLOWED_SALESFORCE_PERMISSION_SETS.has(
      permissionSetName
    )
  ) {
    throw new Error(
      `Salesforce Permission Set "${permissionSetName}" is not approved for MCP provisioning.`
    );
  }
}
