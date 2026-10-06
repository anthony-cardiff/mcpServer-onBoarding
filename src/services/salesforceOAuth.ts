import "dotenv/config";


/*
 * ============================================
 * ENVIRONMENT CONFIGURATION
 * ============================================
 */

function requireEnv(
  name: string
): string {
  const value =
    process.env[name];

  if (!value) {
    throw new Error(
      `${name} is not configured in .env.`
    );
  }

  return value;
}


const SALESFORCE_LOGIN_URL =
  requireEnv(
    "SALESFORCE_LOGIN_URL"
  ).replace(/\/+$/, "");


const SALESFORCE_CLIENT_ID =
  requireEnv(
    "SALESFORCE_CLIENT_ID"
  );


const SALESFORCE_CLIENT_SECRET =
  requireEnv(
    "SALESFORCE_CLIENT_SECRET"
  );


const TOKEN_ENDPOINT =
  `${SALESFORCE_LOGIN_URL}/services/oauth2/token`;


/*
 * ============================================
 * SALESFORCE TOKEN TYPE
 * ============================================
 */

export interface SalesforceAccessToken {
  access_token:
    string;

  instance_url:
    string;

  token_type?:
    string;

  issued_at?:
    string;

  signature?:
    string;

  scope?:
    string;
}


/*
 * ============================================
 * IN-MEMORY TOKEN CACHE
 * ============================================
 *
 * Client Credentials Flow does not use
 * refresh tokens.
 *
 * We request an access token when needed
 * and keep it in memory while the MCP server
 * is running.
 */

let cachedToken:
  SalesforceAccessToken |
  undefined;


/*
 * ============================================
 * REQUEST SALESFORCE ACCESS TOKEN
 * ============================================
 *
 * Uses OAuth 2.0 Client Credentials Flow.
 *
 * All Salesforce API requests run as the
 * "Run As" user configured on the
 * External Client App.
 */

export async function getSalesforceAccessToken(
  forceRefresh:
    boolean = false
): Promise<SalesforceAccessToken> {

  if (
    cachedToken &&
    !forceRefresh
  ) {
    return cachedToken;
  }


  const body =
    new URLSearchParams({
      grant_type:
        "client_credentials",

      client_id:
        SALESFORCE_CLIENT_ID,

      client_secret:
        SALESFORCE_CLIENT_SECRET,
    });


  const response =
    await fetch(
      TOKEN_ENDPOINT,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          body.toString(),
      }
    );


  let data:
    any;

  try {
    data =
      await response.json();
  } catch {
    throw new Error(
      "Salesforce returned a token response that was not valid JSON."
    );
  }


  if (!response.ok) {
    const error =
      data?.error ??
      "UNKNOWN_ERROR";

    const description =
      data?.error_description ??
      "Salesforce rejected the Client Credentials request.";

    throw new Error(
      `${error}: ${description}`
    );
  }


  if (
    !data?.access_token ||
    !data?.instance_url
  ) {
    throw new Error(
      "Salesforce did not return an access token or instance URL."
    );
  }


  cachedToken = {
    access_token:
      data.access_token,

    instance_url:
      data.instance_url,

    token_type:
      data.token_type,

    issued_at:
      data.issued_at,

    signature:
      data.signature,

    scope:
      data.scope,
  };


  return cachedToken;
}


/*
 * ============================================
 * CLEAR SALESFORCE TOKEN CACHE
 * ============================================
 *
 * Useful if Salesforce invalidates an
 * access token while the MCP server is
 * still running.
 */

export function clearSalesforceAccessToken():
void {

  cachedToken =
    undefined;
}


/*
 * ============================================
 * AUTHENTICATED SALESFORCE REQUEST
 * ============================================
 *
 * Makes an authenticated Salesforce REST
 * API request.
 *
 * If Salesforce returns HTTP 401,
 * request a new Client Credentials token
 * once and retry automatically.
 */

export async function salesforceFetch(
  path: string,

  init:
    RequestInit = {}
): Promise<Response> {

  let token =
    await getSalesforceAccessToken();


  const makeRequest =
    async (
      currentToken:
        SalesforceAccessToken
    ) => {

      const url =
        path.startsWith(
          "http"
        )
          ? path
          : `${currentToken.instance_url}${path}`;


      const headers =
        new Headers(
          init.headers
        );


      headers.set(
        "Authorization",
        `Bearer ${currentToken.access_token}`
      );


      headers.set(
        "Accept",
        "application/json"
      );


      if (
        init.body &&
        !headers.has(
          "Content-Type"
        )
      ) {
        headers.set(
          "Content-Type",
          "application/json"
        );
      }


      return fetch(
        url,
        {
          ...init,

          headers,
        }
      );
    };


  let response =
    await makeRequest(
      token
    );


  /*
   * ============================================
   * RETRY ON EXPIRED / INVALID TOKEN
   * ============================================
   */

  if (
    response.status === 401
  ) {
    clearSalesforceAccessToken();


    token =
      await getSalesforceAccessToken(
        true
      );


    response =
      await makeRequest(
        token
      );
  }


  return response;
}