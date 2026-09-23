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

    // ===========================
    // ------- Salesforce --------
    // ===========================

  salesforceUsername: "GM User",  
  salesforceUserRequired: "Salesforce",
  salesforceRole: "SF Role",
  salesforceProfile: "SF Profile",
  permissionSetRequired: "Permission Set",
  permissionSetGroups: "Permission Set Groups",
  managedPackageRequired: "Managed Package",


    // ======================
    // ------- Slack --------
    // ======================

  slackUserMapping: "Slack User Mapping",


    // ======================
    // ------- Zoom --------
    // ======================

  zoomAccountRequired: "Zoom",
  zoomDirectLineRequired: "Direct Line",
  zoomSmsRequired: "SMS",


    // ======================
    // ------- PassW --------
    // ======================

  gmPassword: "GM Password",
  sfPassword: "SF Password",
  computerPassword: "Computer Password",
  abmPassword: "ABM Password",
  slackPassword: "Slack Password",
  zoomPassword: "Zoom Password",

} as const;