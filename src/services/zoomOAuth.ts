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


const ZOOM_ACCOUNT_ID =
  requireEnv(
    "ZOOM_ACCOUNT_ID"
  );


const ZOOM_CLIENT_ID =
  requireEnv(
    "ZOOM_CLIENT_ID"
  );


const ZOOM_CLIENT_SECRET =
  requireEnv(
    "ZOOM_CLIENT_SECRET"
  );


const ZOOM_TOKEN_URL =
  "https://zoom.us/oauth/token";


const ZOOM_API_BASE_URL =
  "https://api.zoom.us/v2";


/*
 * ============================================
 * ZOOM TOKEN TYPE
 * ============================================
 */

export interface ZoomAccessToken {
  access_token:
    string;

  token_type:
    string;

  expires_in:
    number;

  scope?:
    string;

  expiresAt:
    number;
}


/*
 * ============================================
 * IN-MEMORY TOKEN CACHE
 * ============================================
 */

let cachedToken:
  ZoomAccessToken |
  undefined;


/*
 * ============================================
 * GET ZOOM ACCESS TOKEN
 * ============================================
 */

export async function getZoomAccessToken(
  forceRefresh:
    boolean = false
): Promise<ZoomAccessToken> {

  /*
   * Reuse the token while it still has
   * at least 60 seconds remaining.
   */
  if (
    cachedToken &&
    !forceRefresh &&
    cachedToken.expiresAt >
      Date.now() + 60_000
  ) {
    return cachedToken;
  }


  const credentials =
    Buffer
      .from(
        `${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`
      )
      .toString(
        "base64"
      );


  const body =
    new URLSearchParams({
      grant_type:
        "account_credentials",

      account_id:
        ZOOM_ACCOUNT_ID,
    });


  const response =
    await fetch(
      ZOOM_TOKEN_URL,
      {
        method:
          "POST",

        headers: {
          Authorization:
            `Basic ${credentials}`,

          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          body.toString(),
      }
    );


  const responseText =
    await response.text();


  let data:
    any;


  try {
    data =
      JSON.parse(
        responseText
      );
  } catch {
    throw new Error(
      `Zoom returned a token response that was not valid JSON: ${responseText}`
    );
  }


  if (!response.ok) {
    throw new Error(
      `Zoom OAuth failed (${response.status}): ${responseText}`
    );
  }


  if (!data?.access_token) {
    throw new Error(
      "Zoom did not return an access token."
    );
  }


  const expiresIn =
    Number(
      data.expires_in ??
      3600
    );


  cachedToken = {
    access_token:
      data.access_token,

    token_type:
      data.token_type ??
      "bearer",

    expires_in:
      expiresIn,

    scope:
      data.scope,

    expiresAt:
      Date.now() +
      expiresIn * 1000,
  };


  return cachedToken;
}


/*
 * ============================================
 * CLEAR TOKEN CACHE
 * ============================================
 */

export function clearZoomAccessToken():
void {

  cachedToken =
    undefined;
}


/*
 * ============================================
 * AUTHENTICATED ZOOM REQUEST
 * ============================================
 */

export async function zoomFetch(
  path: string,

  init:
    RequestInit = {}
): Promise<Response> {

  let token =
    await getZoomAccessToken();


  const makeRequest =
    async (
      currentToken:
        ZoomAccessToken
    ) => {

      const url =
        path.startsWith(
          "http"
        )
          ? path
          : `${ZOOM_API_BASE_URL}${path}`;


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
   * Retry once if the access token
   * expired or became invalid.
   */
  if (
    response.status === 401
  ) {

    clearZoomAccessToken();


    token =
      await getZoomAccessToken(
        true
      );


    response =
      await makeRequest(
        token
      );
  }


  return response;
}