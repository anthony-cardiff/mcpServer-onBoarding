import {
  getSalesforceAccessToken,
  salesforceFetch,
} from "../services/salesforceOAuth.js";


interface SalesforceApiVersion {
  label:
    string;

  url:
    string;

  version:
    string;
}


/*
 * ============================================
 * MAIN TEST
 * ============================================
 */

async function main() {

  /*
   * ============================================
   * TEST CLIENT CREDENTIALS AUTHENTICATION
   * ============================================
   */

  const token =
    await getSalesforceAccessToken();


  console.log(
    "Salesforce Client Credentials authentication: SUCCESS"
  );


  console.log(
    `Instance: ${token.instance_url}`
  );


  /*
   * NEVER print:
   *
   * token.access_token
   *
   * or the Consumer Secret.
   */


  /*
   * ============================================
   * TEST SALESFORCE REST API
   * ============================================
   */

  const versionsResponse =
    await salesforceFetch(
      "/services/data/"
    );


  if (
    !versionsResponse.ok
  ) {
    const body =
      await versionsResponse.text();

    throw new Error(
      `Salesforce REST API test failed (${versionsResponse.status}): ${body}`
    );
  }


  const versions:
    SalesforceApiVersion[] =
    await versionsResponse.json();


  if (
    !Array.isArray(
      versions
    ) ||
    versions.length === 0
  ) {
    throw new Error(
      "Salesforce returned no REST API versions."
    );
  }


  const latest =
    versions[
      versions.length - 1
    ];


  console.log(
    `Latest available API version: ${latest.version}`
  );


  /*
   * ============================================
   * TEST AUTHENTICATED USER
   * ============================================
   *
   * This should identify the Salesforce
   * user configured as the External Client
   * App's Run As user.
   */

  const identityResponse =
    await salesforceFetch(
      "/services/oauth2/userinfo"
    );


  if (
    !identityResponse.ok
  ) {
    const body =
      await identityResponse.text();

    throw new Error(
      `Salesforce user identity test failed (${identityResponse.status}): ${body}`
    );
  }


  const identity:
    any =
    await identityResponse.json();


  console.log("");
  console.log(
    "Authenticated Salesforce Run As user:"
  );


  console.log({
    userId:
      identity.user_id,

    organizationId:
      identity.organization_id,

    username:
      identity.preferred_username,

    name:
      identity.name,
  });


  console.log("");
  console.log(
    "Salesforce OAuth test completed successfully."
  );
}


/*
 * ============================================
 * ERROR HANDLING
 * ============================================
 */

main().catch(
  (error) => {

    const message =
      error instanceof Error
        ? error.message
        : String(error);


    console.error("");
    console.error(
      "Salesforce OAuth test failed:"
    );


    console.error(
      message
    );


    process.exitCode =
      1;
  }
);