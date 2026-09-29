import {
  getGoogleWorkspaceUser,
} from "../services/googleAdmin.js";

async function main() {
  const user =
    await getGoogleWorkspaceUser(
      "anthony@cardiff.co"
    );

  console.log(
    "Google Admin SDK connection successful."
  );

  console.log({
    id: user.id,
    primaryEmail:
      user.primaryEmail,

    name:
      user.name?.fullName,

    suspended:
      user.suspended,

    orgUnitPath:
      user.orgUnitPath,
  });
}

main().catch((error) => {
  console.error(
    "Google Admin SDK test failed."
  );

  console.error(
    error?.response?.data ??
    error
  );

  process.exit(1);
});