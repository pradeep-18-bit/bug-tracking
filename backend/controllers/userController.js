const crypto = require("crypto");
const bcrypt = require("bcrypt");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const {
  normalizeEmail,
  normalizeText,
  parseUserImportCsv,
} = require("../utils/userImportCsv");
const { normalizeWorkspaceId } = require("../utils/workspace");

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_IMPORTED_PASSWORD = "pirnav@2025";
const DEFAULT_IMPORTED_ROLE = "Developer";
const normalizeRole = (value) => normalizeText(value);

const toTitleCase = (value) =>
  value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const buildNameFromEmail = (email) => {
  const localPart = email.split("@")[0] || "";
  const cleaned = localPart.replace(/[._-]+/g, " ").trim();

  return cleaned ? toTitleCase(cleaned) : "Invited User";
};

const generateTemporaryPassword = () =>
  `${crypto.randomBytes(4).toString("hex")}A9!`;

const serializeInvitedUser = (user, temporaryPassword) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  employeeId: user.employeeId || "",
  designation: user.designation || "",
  role: user.role,
  temporaryPassword,
});

const createInvitedUser = async ({
  email,
  role,
  name,
  employeeId,
  designation,
  password,
  workspaceId,
}) => {
  const temporaryPassword = generateTemporaryPassword();
  const user = await User.create({
    name: name || buildNameFromEmail(email),
    email,
    employeeId: employeeId || undefined,
    designation: designation || "",
    password: password || temporaryPassword,
    role,
    workspaceId: normalizeWorkspaceId(workspaceId),
  });

  return serializeInvitedUser(user, password ? undefined : temporaryPassword);
};

const getManagedUsers = asyncHandler(async (req, res) => {
  const workspaceId = normalizeWorkspaceId(req.user.workspaceId);

  const users = await User.find({
    workspaceId,
  })
    .select("name email employeeId designation role createdAt workspaceId")
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json(users);
});

const inviteUser = asyncHandler(async (req, res) => {
  const workspaceId = normalizeWorkspaceId(req.user.workspaceId);
  const email = normalizeEmail(req.body.email);
  const role = normalizeRole(req.body.role);

  if (!email || !role) {
    res.status(400);
    throw new Error("Email and role are required");
  }

  if (!emailRegex.test(email)) {
    res.status(400);
    throw new Error("Please provide a valid email address");
  }

  if (!User.availableRoles.includes(role)) {
    res.status(400);
    throw new Error(`Role must be one of ${User.availableRoles.join(", ")}`);
  }

  const existingUser = await User.findOne({ email }).select("_id").lean();

  if (existingUser) {
    res.status(409);
    throw new Error("A user with that email already exists");
  }

  const invitedUser = await createInvitedUser({ email, role, workspaceId });

  res.status(201).json({
    message: "User invited successfully",
    invitedUser,
  });
});

const bulkInviteUsers = asyncHandler(async (req, res) => {
  const workspaceId = normalizeWorkspaceId(req.user.workspaceId);
  const role = normalizeRole(req.body.role);
  const rawEmails = Array.isArray(req.body.emails)
    ? req.body.emails.join(",")
    : typeof req.body.emails === "string"
      ? req.body.emails
      : "";

  if (!rawEmails.trim() || !role) {
    res.status(400);
    throw new Error("Emails and role are required");
  }

  if (!User.availableRoles.includes(role)) {
    res.status(400);
    throw new Error(`Role must be one of ${User.availableRoles.join(", ")}`);
  }

  const parsedEmails = Array.from(
    new Set(
      rawEmails
        .split(/[,\n;]+/)
        .map((value) => normalizeEmail(value))
        .filter(Boolean)
    )
  );

  if (!parsedEmails.length) {
    res.status(400);
    throw new Error("Please provide at least one valid email to import");
  }

  const existingUsers = await User.find({
    email: {
      $in: parsedEmails,
    },
  })
    .select("email")
    .lean();

  const existingEmailSet = new Set(
    existingUsers.map((user) => normalizeEmail(user.email))
  );
  const created = [];
  const skipped = [];
  const invalid = [];

  for (const email of parsedEmails) {
    if (!emailRegex.test(email)) {
      invalid.push(email);
      continue;
    }

    if (existingEmailSet.has(email)) {
      skipped.push({
        email,
        reason: "User already exists",
      });
      continue;
    }

    const invitedUser = await createInvitedUser({ email, role, workspaceId });
    created.push(invitedUser);
    existingEmailSet.add(email);
  }

  res.status(201).json({
    message: created.length
      ? `${created.length} user${created.length === 1 ? "" : "s"} invited successfully`
      : "No new users were imported",
    created,
    skipped,
    invalid,
  });
});

const importUsers = asyncHandler(async (req, res) => {
  const workspaceId = normalizeWorkspaceId(req.user.workspaceId);

  if (!req.file?.buffer?.length) {
    res.status(400);
    throw new Error("Please upload a CSV file");
  }

  const originalName = String(req.file.originalname || "").toLowerCase();

  if (!originalName.endsWith(".csv")) {
    res.status(400);
    throw new Error("Only .csv files are supported");
  }

  let parsedCsv;

  try {
    parsedCsv = await parseUserImportCsv(req.file.buffer);
  } catch (error) {
    res.status(400);
    throw new Error("Unable to parse the CSV file");
  }

  if (!parsedCsv.headers.length) {
    res.status(400);
    throw new Error("The uploaded CSV file is empty");
  }

  if (!parsedCsv.emailKey) {
    res.status(400);
    throw new Error("CSV must include an Email Address or email column");
  }

  if (!parsedCsv.nameKey) {
    res.status(400);
    throw new Error("CSV must include a Full Name or name column");
  }

  if (!parsedCsv.rows.length) {
    res.status(400);
    throw new Error("The uploaded CSV file does not contain any data rows");
  }

  const candidateEmails = Array.from(
    new Set(parsedCsv.rows.map((row) => row.email).filter(Boolean))
  );
  const existingUsers = candidateEmails.length
    ? await User.find({
        email: {
          $in: candidateEmails,
        },
      })
        .select("email")
        .lean()
    : [];
  const existingEmailSet = new Set(
    existingUsers.map((user) => normalizeEmail(user.email))
  );
  const seenEmails = new Set();
  const errors = [];

  const hashedPassword = await bcrypt.hash(DEFAULT_IMPORTED_PASSWORD, 10);
  const usersToCreate = [];

  // Validate row-by-row first so the response can explain exactly what was
  // skipped before we do a single bulk insert for the valid users.
  parsedCsv.rows.forEach((row) => {
    if (row.isEmpty) {
      return;
    }

    if (!row.name) {
      errors.push({
        row: row.row,
        message: "Name is required",
      });
      return;
    }

    if (!row.email) {
      errors.push({
        row: row.row,
        message: "Email is required",
      });
      return;
    }

    if (!emailRegex.test(row.email)) {
      errors.push({
        row: row.row,
        message: "Invalid email format",
      });
      return;
    }

    if (existingEmailSet.has(row.email) || seenEmails.has(row.email)) {
      errors.push({
        row: row.row,
        message: "Duplicate email",
      });
      return;
    }

    seenEmails.add(row.email);
    usersToCreate.push({
      name: row.name,
      email: row.email,
      password: hashedPassword,
      role: DEFAULT_IMPORTED_ROLE,
      workspaceId,
    });
  });

  let successCount = 0;

  if (usersToCreate.length) {
    try {
      const insertedUsers = await User.insertMany(usersToCreate, {
        ordered: false,
      });
      successCount = insertedUsers.length;
    } catch (error) {
      const writeErrors = error.writeErrors || [];
      const duplicateCode = 11000;

      successCount = error.insertedDocs?.length || 0;

      writeErrors.forEach((writeError) => {
        const failedOperation = writeError.err?.op || writeError.err?.insertedDoc || {};
        const failedEmail = normalizeEmail(failedOperation.email);
        const failedRow = parsedCsv.rows.find(
          (row) => !row.isEmpty && normalizeEmail(row.email) === failedEmail
        );

        errors.push({
          row: failedRow?.row || 0,
          message:
            writeError.code === duplicateCode
              ? "Duplicate email"
              : "Unable to create user from this row",
        });
      });

      if (!writeErrors.length) {
        throw error;
      }
    }
  }

  res.status(200).json({
    successCount,
    failedCount: errors.length,
    errors,
    message: "Import completed",
  });
});

module.exports = {
  getManagedUsers,
  inviteUser,
  bulkInviteUsers,
  importUsers,
};
