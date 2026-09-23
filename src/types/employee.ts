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


    // ===========================
    // ------- Salesforce --------
    // ===========================

salesforce: {
  username?: string;
  role?: string;
  profile?: string;
  userRequired?: boolean;
  permissionSetRequired?: boolean;
  permissionSetGroups: string[];
  managedPackageRequired?: boolean;
};


    // ======================
    // ------- Slack --------
    // ======================

  slack: {
    userMapping?: string;
  };


    // ======================
    // ------- Zoom --------
    // ======================

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

export interface EmployeeCredentials {
  gmPassword?: string;
  sfPassword?: string;
  computerPassword?: string;
  abmPassword?: string;
  slackPassword?: string;
  zoomPassword?: string;
}