const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const { DEFAULT_USER } = require("../utils/defaultUser");
const generateToken = require("../utils/generateToken");
const {
  createWorkspaceId,
  normalizeWorkspaceId,
} = require("../utils/workspace");

const passwordHasLetter = /[A-Za-z]/;
const passwordHasNumber = /\d/;

const isAdminDefaultLoginAllowed = () =>
  process.env.ENABLE_ADMIN_DEFAULT_LOGIN === "true";

const getAdminDefaultPassword = () =>
  typeof process.env.ADMIN_DEFAULT_PASSWORD === "string"
    ? process.env.ADMIN_DEFAULT_PASSWORD
    : "";

const isDefaultAdminCredentialAttempt = (email, password) =>
  email === DEFAULT_USER.email &&
  Boolean(getAdminDefaultPassword()) &&
  password === getAdminDefaultPassword();

const getPasswordValidationMessage = (password) => {
  const normalizedPassword = typeof password === "string" ? password : "";

  if (normalizedPassword.length < 8) {
    return "Password must be at least 8 characters long";
  }

  if (
    !passwordHasLetter.test(normalizedPassword) ||
    !passwordHasNumber.test(normalizedPassword)
  ) {
    return "Password must include at least one letter and one number";
  }

  return "";
};

const buildAuthPayload = (user) => ({
  token: generateToken(user._id, normalizeWorkspaceId(user.workspaceId)),
  user: {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    workspaceId: normalizeWorkspaceId(user.workspaceId),
  },
});

const syncUserForAuth = async (user, password) => {
  let requiresSave = false;

  if (!user.workspaceId) {
    user.workspaceId = normalizeWorkspaceId();
    requiresSave = true;
  }

  if (!User.isPasswordHashed(user.password)) {
    user.password = password;
    requiresSave = true;
  }

  if (requiresSave) {
    await user.save();
  }

  return user;
};

const register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  const normalizedName = typeof name === "string" ? name.trim() : "";
  const normalizedEmail = typeof email === "string" ? email.toLowerCase().trim() : "";
  const normalizedRole = typeof role === "string" ? role.trim() : "";

  console.log("[auth] Register request body:", {
    ...req.body,
    name: normalizedName || null,
    email: normalizedEmail || null,
    role: normalizedRole || null,
    password: password ? "[redacted]" : null,
  });

  if (!normalizedName || !normalizedEmail || !password || !normalizedRole) {
    res.status(400);
    throw new Error("Name, email, password, and role are required");
  }

  const passwordValidationMessage = getPasswordValidationMessage(password);

  if (passwordValidationMessage) {
    res.status(400);
    throw new Error(passwordValidationMessage);
  }

  if (!User.availableRoles.includes(normalizedRole)) {
    res.status(400);
    throw new Error(`Role must be one of ${User.availableRoles.join(", ")}`);
  }

  const existingUser = await User.findOne({ email: normalizedEmail });

  if (existingUser) {
    res.status(409);
    throw new Error("An account with that email already exists");
  }

  const workspaceId = createWorkspaceId();

  const user = await User.create({
    name: normalizedName,
    email: normalizedEmail,
    password,
    role: normalizedRole,
    workspaceId,
  });

  res.status(201).json({
    message: "Account created successfully. Please sign in.",
    ...buildAuthPayload(user),
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = email?.toLowerCase().trim();

  console.log("[auth] Login request:", {
    email: normalizedEmail || null,
  });

  if (!normalizedEmail || !password) {
    res.status(400);
    throw new Error("Email and password are required");
  }

  if (isDefaultAdminCredentialAttempt(normalizedEmail, password)) {
    res.status(403);
    throw new Error("Default admin password is only available via /admin access");
  }

  const user = await User.findOne({ email: normalizedEmail }).select("+password");

  console.log("[auth] User found:", Boolean(user));

  const passwordMatches = user ? await user.comparePassword(password) : false;

  console.log("[auth] Password match:", passwordMatches);

  if (!user || !passwordMatches) {
    res.status(401);
    throw new Error("Invalid credentials");
  }

  await syncUserForAuth(user, password);
  res.status(200).json(buildAuthPayload(user));
});

const adminLogin = asyncHandler(async (req, res) => {
  if (!isAdminDefaultLoginAllowed()) {
    res.status(403);
    throw new Error("Admin default password access is disabled");
  }

  const adminDefaultPassword = getAdminDefaultPassword();

  if (!adminDefaultPassword) {
    res.status(500);
    throw new Error("Admin default password is not configured");
  }

  const user = await User.findOne({
    email: DEFAULT_USER.email,
    role: "Admin",
  }).select("+password");

  if (!user) {
    res.status(404);
    throw new Error("Default admin account is unavailable");
  }

  const passwordMatches = await user.comparePassword(adminDefaultPassword);

  if (!passwordMatches) {
    res.status(403);
    throw new Error("Default admin password is not available");
  }

  await syncUserForAuth(user, adminDefaultPassword);
  res.status(200).json(buildAuthPayload(user));
});

const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find({
    workspaceId: normalizeWorkspaceId(req.user.workspaceId),
  })
    .select("name email role createdAt workspaceId")
    .sort({ name: 1 });

  console.log(
    "[auth] Returning users:",
    users.map((user) => ({
      id: String(user._id),
      name: user.name,
      role: user.role,
    }))
  );

  res.status(200).json(users);
});

const changePassword = asyncHandler(async (req, res) => {
  const currentPassword =
    typeof req.body.currentPassword === "string" ? req.body.currentPassword : "";
  const newPassword =
    typeof req.body.newPassword === "string" ? req.body.newPassword : "";

  if (!currentPassword || !newPassword) {
    res.status(400);
    throw new Error("Current password and new password are required");
  }

  if (currentPassword === newPassword) {
    res.status(400);
    throw new Error("New password must be different from the current password");
  }

  const passwordValidationMessage = getPasswordValidationMessage(newPassword);

  if (passwordValidationMessage) {
    res.status(400);
    throw new Error(passwordValidationMessage);
  }

  const user = await User.findById(req.user._id).select("+password");

  if (!user) {
    res.status(401);
    throw new Error("Unauthorized");
  }

  const currentPasswordMatches = await user.comparePassword(currentPassword);

  if (!currentPasswordMatches) {
    res.status(400);
    throw new Error("Current password is incorrect");
  }

  user.password = newPassword;
  await user.save();

  res.status(200).json({
    message: "Password updated successfully",
  });
});

module.exports = {
  register,
  login,
  adminLogin,
  getUsers,
  changePassword,
};
