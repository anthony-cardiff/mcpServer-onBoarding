import {
  getZoomAccessToken,
  zoomFetch,
} from "../services/zoomOAuth.js";


async function main() {

  /*
   * ============================================
   * TEST SERVER-TO-SERVER OAUTH
   * ============================================
   */

  const token =
    await getZoomAccessToken();


  console.log(
    "Zoom Server-to-Server OAuth: SUCCESS"
  );


  console.log(
    `Token expires in: ${token.expires_in} seconds`
  );


  /*
   * NEVER print:
   *
   * token.access_token
   * ZOOM_CLIENT_SECRET
   */


  /*
   * ============================================
   * TEST ZOOM USERS API
   * ============================================
   *
   * Only requests one user.
   *
   * This verifies that the app has
   * permission to read account users.
   */

  const response =
    await zoomFetch(
      "/users?page_size=1"
    );


  const body =
    await response.text();


  if (!response.ok) {
    throw new Error(
      `Zoom Users API test failed (${response.status}): ${body}`
    );
  }


  const data:
    any =
    JSON.parse(
      body
    );


  console.log(
    "Zoom Users API connection: SUCCESS"
  );


  console.log({
    pageSize:
      data.page_size,

    totalRecords:
      data.total_records,

    userReturned:
      Boolean(
        data.users?.[0]
      ),
  });


  console.log("");
  console.log(
    "Zoom OAuth test completed successfully."
  );
}


main().catch(
  (error) => {

    const message =
      error instanceof Error
        ? error.message
        : String(error);


    console.error("");
    console.error(
      "Zoom OAuth test failed:"
    );


    console.error(
      message
    );


    process.exitCode =
      1;
  }
);