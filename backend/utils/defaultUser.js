const User = require("../models/User");
const { normalizeWorkspaceId } = require("./workspace");

const LEGACY_DEFAULT_EMAIL = "admin@company.com";
const DEFAULT_ADMIN_PASSWORD =
  process.env.ADMIN_DEFAULT_PASSWORD || "admin123";

const DEFAULT_USER = {
  name: "Admin User",
  email: "admin@example.com",
  password: DEFAULT_ADMIN_PASSWORD,
  role: "Admin",
  workspaceId: normalizeWorkspaceId(),
};

const ensureDefaultUser = async () => {
  const existingUser = await User.findOne({
    email: {
      $in: [DEFAULT_USER.email, LEGACY_DEFAULT_EMAIL],
    },
  }).select("+password");

  if (!existingUser) {
    await User.create(DEFAULT_USER);
    console.log(`[seed] Default user created: ${DEFAULT_USER.email}`);
    return;
  }

  const passwordMatches = await existingUser.comparePassword(
    DEFAULT_USER.password
  );

  let updated = false;

  if (existingUser.name !== DEFAULT_USER.name) {
    existingUser.name = DEFAULT_USER.name;
    updated = true;
  }

  if (existingUser.email !== DEFAULT_USER.email) {
    existingUser.email = DEFAULT_USER.email;
    updated = true;
  }

  if (existingUser.role !== DEFAULT_USER.role) {
    existingUser.role = DEFAULT_USER.role;
    updated = true;
  }

  if (existingUser.workspaceId !== DEFAULT_USER.workspaceId) {
    existingUser.workspaceId = DEFAULT_USER.workspaceId;
    updated = true;
  }

  if (!passwordMatches) {
    existingUser.password = DEFAULT_USER.password;
    updated = true;
  }

  if (updated) {
    await existingUser.save();
    console.log(
      `[seed] Default user refreshed and ready: ${DEFAULT_USER.email}`
    );
    return;
  }

  console.log(`[seed] Default user already ready: ${DEFAULT_USER.email}`);
};

const resetDefaultUser = async () => {
  await User.deleteMany({
    email: {
      $in: [DEFAULT_USER.email, LEGACY_DEFAULT_EMAIL],
    },
  });
  const user = await User.create(DEFAULT_USER);

  console.log(`[seed] Default user reset: ${DEFAULT_USER.email}`);

  return user;
};

module.exports = {
  DEFAULT_USER,
  ensureDefaultUser,
  resetDefaultUser,
};
