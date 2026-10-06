import {
  testSlackScimConnection,
} from "../services/slackScim.js";


async function main() {

  await testSlackScimConnection();


  console.log(
    "Slack SCIM connection: SUCCESS"
  );


  console.log(
    "Slack Business+ provisioning API is available."
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
      "Slack SCIM test failed:"
    );


    console.error(
      message
    );


    process.exitCode =
      1;
  }
);