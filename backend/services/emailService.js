const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "..", ".env"),
});

const nodemailer = require("nodemailer");
const User = require("../models/User");
const UserEmailConfig = require("../models/UserEmailConfig");
const WorkspaceSetting = require("../models/WorkspaceSetting");
const { decryptSecret } = require("../utils/emailCrypto");
const { isEligibleWorkspaceSenderRole } = require("../utils/roles");
const { getWorkspaceSenderState } = require("../utils/workspaceSender");
const { normalizeWorkspaceId } = require("../utils/workspace");
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ipv4Regex =
  /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;
const hostnameRegex =
  /^(?=.{1,253}$)(?:localhost|(?:(?!-)[a-z0-9-]{1,63}(?<!-)\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59}))$/i;
const normalizeSmtpText = (value = "") =>
  String(value || "").replace(/\r?\n/g, "").trim();

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatDateTime = (value) => {
  if (!value) {
    return "Not set";
  }

  return new Date(value).toLocaleString();
};

const getStatusLabel = (status = "") => {
  if (!status) {
    return "N/A";
  }

  return String(status)
    .split("_")
    .filter(Boolean)
    .map((segment) => segment.charAt(0) + segment.slice(1).toLowerCase())
    .join(" ");
};

const normalizeTransportPort = (value, fallback = 465) => {
  const parsedValue = Number.parseInt(String(value || fallback), 10);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
};

const normalizeTransportSecure = (value, port) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase();

    if (normalizedValue === "true") {
      return true;
    }

    if (normalizedValue === "false") {
      return false;
    }
  }

  return port === 465;
};

const parseFromHeader = (value = "", fallbackEmail = "") => {
  const normalizedValue = String(value || "").trim();
  const fallback = String(fallbackEmail || "").trim();
  const matchedValue = normalizedValue.match(/^(.*)<([^>]+)>$/);

  if (!matchedValue) {
    return {
      fromName: "",
      fromEmail: normalizedValue || fallback,
    };
  }

  const [, rawName, rawEmail] = matchedValue;

  return {
    fromName: rawName.replace(/^"+|"+$/g, "").trim(),
    fromEmail: String(rawEmail || "").trim() || fallback,
  };
};

const buildFromHeader = ({ fromName, fromEmail, username }) => {
  const normalizedFromEmail = String(fromEmail || username || "").trim();
  const normalizedFromName = String(fromName || "").trim();

  if (!normalizedFromEmail) {
    return "";
  }

  return normalizedFromName
    ? `${normalizedFromName} <${normalizedFromEmail}>`
    : normalizedFromEmail;
};

const buildReplyToHeader = ({ fromEmail, username }) =>
  String(fromEmail || username || "").trim();

const normalizeEmailAddress = (value = "") =>
  normalizeSmtpText(value).toLowerCase();

const isValidEmailAddress = (value = "") =>
  emailRegex.test(normalizeEmailAddress(value));

const normalizeSmtpHost = (value = "") =>
  normalizeSmtpText(value).toLowerCase();

const isValidSmtpHost = (value = "") => {
  const normalizedHost = normalizeSmtpHost(value);

  return Boolean(
    normalizedHost &&
      !/[,\s]/.test(normalizedHost) &&
      (hostnameRegex.test(normalizedHost) || ipv4Regex.test(normalizedHost))
  );
};

const resolveSmtpUsername = (
  username,
  fromEmail,
  { allowFromEmailFallback = true } = {}
) => {
  const normalizedUsername = normalizeEmailAddress(username);
  const normalizedFromEmail = normalizeEmailAddress(fromEmail);

  if (isValidEmailAddress(normalizedUsername)) {
    return normalizedUsername;
  }

  if (allowFromEmailFallback && isValidEmailAddress(normalizedFromEmail)) {
    return normalizedFromEmail;
  }

  return normalizedUsername;
};

const normalizeEmailConfig = (
  config = {},
  { allowUsernameFallback = true } = {}
) => {
  const port = normalizeTransportPort(config.port);
  const requestedFromEmail = normalizeEmailAddress(config.fromEmail);
  const username = resolveSmtpUsername(config.username, requestedFromEmail, {
    allowFromEmailFallback: allowUsernameFallback,
  });
  const fromEmail = requestedFromEmail || username;
  const fromName = String(config.fromName || "").trim();

  return {
    host: normalizeSmtpHost(config.host),
    port,
    secure: normalizeTransportSecure(config.secure, port),
    username,
    password: typeof config.password === "string" ? config.password : "",
    fromName,
    fromEmail,
  };
};

const hasCompleteEmailConfig = (config = {}, { requirePassword = true } = {}) => {
  const normalizedConfig = normalizeEmailConfig(config);

  return Boolean(
    isValidSmtpHost(normalizedConfig.host) &&
      Number.isFinite(normalizedConfig.port) &&
      normalizedConfig.port > 0 &&
      isValidEmailAddress(normalizedConfig.username) &&
      isValidEmailAddress(normalizedConfig.fromEmail) &&
      normalizedConfig.fromName &&
      (!requirePassword || normalizedConfig.password)
  );
};

const getDefaultEmailConfig = () => {
  const username = String(process.env.EMAIL_USER || "").trim();
  const parsedFromHeader = parseFromHeader(process.env.EMAIL_FROM, username);
  const port = normalizeTransportPort(process.env.EMAIL_PORT, 465);

  return normalizeEmailConfig({
    host: process.env.EMAIL_HOST,
    port,
    secure: normalizeTransportSecure(process.env.EMAIL_SECURE, port),
    username,
    password: process.env.EMAIL_PASS,
    fromName: parsedFromHeader.fromName || "Pirnav Workspace",
    fromEmail: parsedFromHeader.fromEmail || username,
  });
};

const createTransporterFromConfig = (config = {}) => {
  const rawHost = String(config?.host || "");
  const normalizedConfig = normalizeEmailConfig(config);

  console.log("smtpHost raw:", `[${rawHost}]`);
  console.log("smtpHost trimmed:", `[${normalizedConfig.host}]`);

  if (!normalizedConfig.host) {
    throw new Error("SMTP host is required");
  }

  if (!isValidSmtpHost(normalizedConfig.host)) {
    throw new Error("SMTP host must be a valid hostname or IPv4 address");
  }

  if (!hasCompleteEmailConfig(normalizedConfig)) {
    throw new Error(
      "SMTP host, port, username, password, from name, and from email must be configured"
    );
  }

  return {
    transporter: nodemailer.createTransport({
      host: normalizedConfig.host.trim(),
      port: normalizedConfig.port,
      secure: normalizedConfig.secure,
      auth: {
        user: normalizedConfig.username,
        pass: normalizedConfig.password,
      },
    }),
    config: normalizedConfig,
    from: buildFromHeader(normalizedConfig),
    replyTo: buildReplyToHeader(normalizedConfig),
  };
};

const buildTransportDebugPayload = ({
  config,
  senderSource,
  workspaceId = "",
}) => {
  const normalizedConfig = normalizeEmailConfig(config);
  const normalizedWorkspaceId = workspaceId ? normalizeWorkspaceId(workspaceId) : "";

  return {
    workspaceId: normalizedWorkspaceId || "default",
    senderSource,
    smtpHostRaw: `[${String(config?.host || "")}]`,
    smtpHost: normalizedConfig.host,
    smtpPort: normalizedConfig.port,
    smtpSecure: normalizedConfig.secure,
    smtpUser: normalizedConfig.username,
    fromEmail: normalizedConfig.fromEmail,
    hasPassword: Boolean(normalizedConfig.password),
    passwordLength: String(normalizedConfig.password || "").length,
  };
};

const createMailerTransportKey = (mailer) =>
  [
    mailer?.config?.host || "",
    String(mailer?.config?.port || ""),
    mailer?.config?.secure ? "true" : "false",
    mailer?.config?.username || "",
    mailer?.from || "",
  ].join("|");

const appendUniqueMailer = (mailers, seenKeys, mailer) => {
  if (!mailer) {
    return;
  }

  const transportKey = createMailerTransportKey(mailer);

  if (seenKeys.has(transportKey)) {
    return;
  }

  seenKeys.add(transportKey);
  mailers.push(mailer);
};

const shouldFallbackToNextMailer = (error) =>
  Boolean(
    error &&
      (error.code === "EAUTH" ||
        error.code === "ENOTFOUND" ||
        error.code === "EAI_AGAIN" ||
        String(error.response || "").includes("535"))
  );

const buildMailerResult = ({
  config,
  fallbackReason = "",
  senderSource,
  senderUser = null,
  workspaceId = "",
}) => {
  const normalizedWorkspaceId = workspaceId ? normalizeWorkspaceId(workspaceId) : "";
  console.log(
    "[email] Transporter config preview",
    buildTransportDebugPayload({
      config,
      senderSource,
      workspaceId: normalizedWorkspaceId,
    })
  );
  const { transporter, from, replyTo, config: resolvedConfig } =
    createTransporterFromConfig(config);

  console.log("Email sender source:", senderSource);
  console.log("From address:", from);
  console.log("Workspace ID:", normalizedWorkspaceId || "default");
  console.log("SMTP host:", resolvedConfig.host);
  console.log("SMTP user:", resolvedConfig.username);
  console.log("Transporter auth user:", resolvedConfig.username);

  if (replyTo) {
    console.log("Reply-To address:", replyTo);
  }

  if (senderUser?.email) {
    console.log("Resolved sender email:", senderUser.email);
  }

  if (senderUser?.role) {
    console.log("Resolved sender role:", senderUser.role);
  }

  if (fallbackReason) {
    console.log("Mailer fallback reason:", fallbackReason);
  }

  return {
    transporter,
    config: resolvedConfig,
    from,
    replyTo,
    senderSource,
    senderUser,
    fallbackReason,
    workspaceId: normalizedWorkspaceId,
  };
};

const getDefaultMailer = ({ workspaceId = "", fallbackReason = "" } = {}) =>
  buildMailerResult({
    config: getDefaultEmailConfig(),
    fallbackReason,
    senderSource: "default",
    senderUser: null,
    workspaceId,
  });

const serializeMailerUser = (user) =>
  user
    ? {
        _id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        workspaceId: user.workspaceId,
      }
    : null;

const clearOwnerManualSenderPreference = async ({
  workspaceId,
  ownerUserId,
  matchSenderUserId = null,
}) => {
  const normalizedWorkspaceId = workspaceId ? normalizeWorkspaceId(workspaceId) : "";

  if (!normalizedWorkspaceId || !ownerUserId) {
    return null;
  }

  const query = {
    _id: ownerUserId,
    workspaceId: normalizedWorkspaceId,
  };

  if (matchSenderUserId) {
    query["senderPreference.userId"] = matchSenderUserId;
  }

  return User.updateOne(query, {
    $set: {
      senderPreference: {
        userId: null,
        updatedBy: ownerUserId,
        updatedAt: new Date(),
      },
    },
  });
};

const loadUserMailerConfig = async ({
  userId,
  workspaceId,
  sourceLabel = "Sender",
}) => {
  const normalizedWorkspaceId = workspaceId ? normalizeWorkspaceId(workspaceId) : "";

  if (!normalizedWorkspaceId) {
    return {
      config: null,
      fallbackReason: `No workspace ID was provided for ${sourceLabel.toLowerCase()} lookup.`,
      senderUser: null,
      workspaceId: "",
    };
  }

  if (!userId) {
    return {
      config: null,
      fallbackReason: `No ${sourceLabel.toLowerCase()} user is configured.`,
      senderUser: null,
      workspaceId: normalizedWorkspaceId,
    };
  }

  const senderUser = await User.findOne({
    _id: userId,
    workspaceId: normalizedWorkspaceId,
  })
    .select("_id name email role workspaceId")
    .lean();

  console.log(`[email] ${sourceLabel} lookup`, {
    workspaceId: normalizedWorkspaceId,
    requestedUserId: String(userId),
    user: serializeMailerUser(senderUser),
  });

  if (!senderUser) {
    return {
      config: null,
      fallbackReason: `The ${sourceLabel.toLowerCase()} user was not found in workspace ${normalizedWorkspaceId}.`,
      senderUser: null,
      workspaceId: normalizedWorkspaceId,
    };
  }

  if (!isEligibleWorkspaceSenderRole(senderUser.role)) {
    return {
      config: null,
      fallbackReason: `${sourceLabel} ${senderUser.email} has ineligible role ${senderUser.role}.`,
      senderUser,
      workspaceId: normalizedWorkspaceId,
    };
  }

  const emailConfig = await UserEmailConfig.findOne({
    workspaceId: normalizedWorkspaceId,
    userId: senderUser._id,
  })
    .select("+passwordEncrypted host port secure username fromName fromEmail userId workspaceId")
    .lean();

  console.log(`[email] ${sourceLabel} SMTP config lookup`, {
    workspaceId: normalizedWorkspaceId,
    senderUserId: String(senderUser._id),
    senderEmail: senderUser.email,
    senderRole: senderUser.role,
    smtpHost: emailConfig?.host || "",
    smtpPort: emailConfig?.port || "",
    smtpSecure:
      typeof emailConfig?.secure === "boolean" ? emailConfig.secure : null,
    smtpUser: emailConfig?.username || "",
    smtpFromEmail: emailConfig?.fromEmail || "",
    hasPasswordEncrypted: Boolean(emailConfig?.passwordEncrypted),
  });

  if (!emailConfig?.passwordEncrypted) {
    return {
      config: null,
      fallbackReason: `${sourceLabel} ${senderUser.email} does not have SMTP credentials.`,
      senderUser,
      workspaceId: normalizedWorkspaceId,
    };
  }

  let password = "";

  try {
    password = decryptSecret(emailConfig.passwordEncrypted);
  } catch (error) {
    return {
      config: null,
      fallbackReason: `The SMTP password for ${sourceLabel.toLowerCase()} ${senderUser.email} could not be decrypted.`,
      senderUser,
      workspaceId: normalizedWorkspaceId,
    };
  }

  const storedUsername = normalizeEmailAddress(emailConfig.username);
  const fallbackUsername = resolveSmtpUsername(
    emailConfig.username,
    emailConfig.fromEmail,
    {
      allowFromEmailFallback: true,
    }
  );

  if (fallbackUsername && fallbackUsername !== storedUsername) {
    console.warn("[email] Invalid stored SMTP username detected. Using fromEmail as auth user.", {
      workspaceId: normalizedWorkspaceId,
      senderEmail: senderUser.email,
      storedSmtpUser: emailConfig.username || "",
      fallbackSmtpUser: fallbackUsername,
      fromEmail: emailConfig.fromEmail || "",
    });
  }

  const resolvedConfig = normalizeEmailConfig(
    {
    host: emailConfig.host,
    port: emailConfig.port,
    secure: emailConfig.secure,
    username: emailConfig.username,
    password,
    fromName: emailConfig.fromName,
    fromEmail: emailConfig.fromEmail,
    },
    {
      allowUsernameFallback: true,
    }
  );

  if (!hasCompleteEmailConfig(resolvedConfig)) {
    return {
      config: null,
      fallbackReason: `${sourceLabel} ${senderUser.email} has incomplete SMTP configuration.`,
      senderUser,
      workspaceId: normalizedWorkspaceId,
    };
  }

  return {
    config: resolvedConfig,
    fallbackReason: "",
    senderUser,
    workspaceId: normalizedWorkspaceId,
  };
};

const loadWorkspaceMailerConfig = async (workspaceId) => {
  const normalizedWorkspaceId = normalizeWorkspaceId(workspaceId);

  const settings = await WorkspaceSetting.findOne({
    workspaceId: normalizedWorkspaceId,
  })
    .select("workspaceSender")
    .lean();
  const { workspaceSender, workspaceSenderUserId, hasWorkspaceSender } =
    getWorkspaceSenderState(settings);

  console.log("[email] Workspace sender settings lookup", {
    workspaceId: normalizedWorkspaceId,
    settingsDocument: settings
      ? {
          workspaceId: settings.workspaceId || normalizedWorkspaceId,
          workspaceSender: workspaceSender || null,
        }
      : null,
  });

  if (!hasWorkspaceSender) {
    console.log("[email] Workspace sender fallback engaged", {
      workspaceId: normalizedWorkspaceId,
      reason: workspaceSender
        ? "workspaceSender disabled or missing userId"
        : "settings or workspaceSender missing",
    });

    return {
      config: null,
      fallbackReason: "No workspace default sender is configured.",
      senderUser: null,
      workspaceId: normalizedWorkspaceId,
    };
  }

  return loadUserMailerConfig({
    userId: workspaceSenderUserId,
    workspaceId: normalizedWorkspaceId,
    sourceLabel: "Workspace default sender",
  });
};

const loadManualSenderPreferenceConfig = async ({
  ownerUserId,
  workspaceId,
}) => {
  const normalizedWorkspaceId = workspaceId ? normalizeWorkspaceId(workspaceId) : "";

  if (!normalizedWorkspaceId) {
    return {
      config: null,
      fallbackReason:
        "No workspace ID was provided for user-specific sender preference lookup.",
      senderUser: null,
      workspaceId: "",
      ownerUser: null,
    };
  }

  if (!ownerUserId) {
    return {
      config: null,
      fallbackReason: "No owner user ID was provided for sender preference lookup.",
      senderUser: null,
      workspaceId: normalizedWorkspaceId,
      ownerUser: null,
    };
  }

  const ownerUser = await User.findOne({
    _id: ownerUserId,
    workspaceId: normalizedWorkspaceId,
  })
    .select("_id name email role workspaceId senderPreference")
    .lean();

  console.log("[email] Manual sender preference owner lookup", {
    workspaceId: normalizedWorkspaceId,
    ownerUserId: String(ownerUserId),
    ownerUser: serializeMailerUser(ownerUser),
    savedSenderUserId: ownerUser?.senderPreference?.userId
      ? String(ownerUser.senderPreference.userId)
      : "",
  });

  if (!ownerUser) {
    return {
      config: null,
      fallbackReason: `The owner user ${String(ownerUserId)} was not found in workspace ${normalizedWorkspaceId}.`,
      senderUser: null,
      workspaceId: normalizedWorkspaceId,
      ownerUser: null,
    };
  }

  if (!ownerUser.senderPreference?.userId) {
    return {
      config: null,
      fallbackReason: `No user-specific sender is saved for ${ownerUser.email}.`,
      senderUser: null,
      workspaceId: normalizedWorkspaceId,
      ownerUser,
    };
  }

  const manualSenderConfig = await loadUserMailerConfig({
    userId: ownerUser.senderPreference.userId,
    workspaceId: normalizedWorkspaceId,
    sourceLabel: "User-selected sender",
  });

  if (!manualSenderConfig.config) {
    await clearOwnerManualSenderPreference({
      workspaceId: normalizedWorkspaceId,
      ownerUserId: ownerUser._id,
      matchSenderUserId: ownerUser.senderPreference.userId,
    });
  }

  return {
    ...manualSenderConfig,
    ownerUser,
  };
};

const getWorkspaceMailer = async (workspaceId, { overrideConfig = null } = {}) => {
  const normalizedWorkspaceId = workspaceId ? normalizeWorkspaceId(workspaceId) : "";

  if (overrideConfig) {
    const normalizedOverrideConfig = normalizeEmailConfig(overrideConfig, {
      allowUsernameFallback: false,
    });

    if (!hasCompleteEmailConfig(normalizedOverrideConfig)) {
      throw new Error(
        "SMTP host, port, username, password, from name, and from email must be configured"
      );
    }

    return buildMailerResult({
      config: normalizedOverrideConfig,
      fallbackReason: "",
      senderSource: "override",
      senderUser: null,
      workspaceId: normalizedWorkspaceId,
    });
  }

  if (normalizedWorkspaceId) {
    const workspaceMailerConfig = await loadWorkspaceMailerConfig(normalizedWorkspaceId);

    if (workspaceMailerConfig.config) {
      return buildMailerResult({
        config: workspaceMailerConfig.config,
        fallbackReason: "",
        senderSource: "workspace",
        senderUser: workspaceMailerConfig.senderUser,
        workspaceId: normalizedWorkspaceId,
      });
    }

    return getDefaultMailer({
      workspaceId: normalizedWorkspaceId,
      fallbackReason: workspaceMailerConfig.fallbackReason,
    });
  }

  return getDefaultMailer({
    workspaceId: "",
    fallbackReason: "No workspace ID was provided. Using default SMTP sender.",
  });
};

const getNotificationMailer = async ({ creatorUserId, workspaceId }) => {
  const normalizedWorkspaceId = workspaceId ? normalizeWorkspaceId(workspaceId) : "";
  const [manualSenderConfig, workspaceMailerConfig] = await Promise.all([
    creatorUserId
      ? loadManualSenderPreferenceConfig({
          ownerUserId: creatorUserId,
          workspaceId: normalizedWorkspaceId,
        })
      : Promise.resolve({
          config: null,
          fallbackReason: "No owner user ID was provided for sender preference lookup.",
          senderUser: null,
          workspaceId: normalizedWorkspaceId,
          ownerUser: null,
        }),
    normalizedWorkspaceId
      ? loadWorkspaceMailerConfig(normalizedWorkspaceId)
      : Promise.resolve({
          config: null,
          fallbackReason:
            "No workspace ID was provided for workspace default sender lookup.",
          senderUser: null,
          workspaceId: "",
        }),
  ]);

  const manualMailer = manualSenderConfig.config
    ? buildMailerResult({
        config: manualSenderConfig.config,
        fallbackReason: "",
        senderSource: "manual",
        senderUser: manualSenderConfig.senderUser,
        workspaceId: normalizedWorkspaceId,
      })
    : null;
  const workspaceMailer = workspaceMailerConfig.config
    ? buildMailerResult({
        config: workspaceMailerConfig.config,
        fallbackReason: manualSenderConfig.fallbackReason,
        senderSource: "workspace",
        senderUser: workspaceMailerConfig.senderUser,
        workspaceId: normalizedWorkspaceId,
      })
    : null;
  const defaultMailer = getDefaultMailer({
    workspaceId: normalizedWorkspaceId,
    fallbackReason: [
      manualSenderConfig.fallbackReason,
      workspaceMailerConfig.fallbackReason,
    ]
      .filter(Boolean)
      .join(" "),
  });
  const mailerResult = manualMailer || workspaceMailer || defaultMailer;
  const attemptMailers = [];
  const seenTransportKeys = new Set();

  appendUniqueMailer(attemptMailers, seenTransportKeys, manualMailer || null);
  appendUniqueMailer(attemptMailers, seenTransportKeys, workspaceMailer || null);
  appendUniqueMailer(attemptMailers, seenTransportKeys, defaultMailer);

  console.log("[email] Issue notification sender resolution", {
    workspaceId: normalizedWorkspaceId,
    ownerUserId: manualSenderConfig.ownerUser?._id
      ? String(manualSenderConfig.ownerUser._id)
      : String(creatorUserId || ""),
    ownerUserEmail: manualSenderConfig.ownerUser?.email || "",
    ownerUserRole: manualSenderConfig.ownerUser?.role || "",
    manualSenderEmail: manualSenderConfig.senderUser?.email || "",
    manualSenderRole: manualSenderConfig.senderUser?.role || "",
    manualSenderSmtpUser: manualSenderConfig.config?.username || "",
    workspaceDefaultSenderEmail: workspaceMailerConfig.senderUser?.email || "",
    finalSenderSource: mailerResult.senderSource,
    finalFrom: mailerResult.from,
    finalAuthUser: mailerResult.config.username,
    fallbackAttemptSources: attemptMailers.map((mailer) => mailer.senderSource),
  });

  console.log("senderPreferenceOwnerUserId:", creatorUserId ? String(creatorUserId) : "");
  console.log("manualSenderEmail:", manualSenderConfig.senderUser?.email || "");
  console.log("manualSenderRole:", manualSenderConfig.senderUser?.role || "");
  console.log(
    "manualSenderHasSmtp:",
    Boolean(
      manualSenderConfig.config?.host &&
        manualSenderConfig.config?.port &&
        manualSenderConfig.config?.username &&
        manualSenderConfig.config?.password
    )
  );
  console.log(
    "workspaceDefaultSenderEmail:",
    workspaceMailerConfig.senderUser?.email || ""
  );
  console.log("finalSenderSource:", mailerResult.senderSource);
  console.log("finalFrom:", mailerResult.from);
  console.log("finalAuthUser:", mailerResult.config.username);

  return {
    ...mailerResult,
    authUser: mailerResult.config.username,
    senderPreferenceOwnerUser: manualSenderConfig.ownerUser || null,
    manualSenderUser: manualSenderConfig.senderUser || null,
    workspaceSenderUser: workspaceMailerConfig.senderUser || null,
    attemptMailers,
  };
};

const getIssueNotificationMailer = getNotificationMailer;

const normalizeRecipientList = (value) =>
  (Array.isArray(value) ? value : [value])
    .flat()
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);

const sendMailWithMailer = async ({
  mailer,
  workspaceId,
  to,
  cc,
  bcc,
  subject,
  html,
  text,
  logLabel = "sendMailWithMailer",
}) => {
  const toRecipients = [...new Set(normalizeRecipientList(to))];
  const ccRecipients = [...new Set(normalizeRecipientList(cc))];
  const bccRecipients = [...new Set(normalizeRecipientList(bcc))];

  if (!toRecipients.length && !ccRecipients.length && !bccRecipients.length) {
    return null;
  }

  console.log(`[email] ${logLabel} resolved mailer`, {
    workspaceId: mailer.workspaceId || normalizeWorkspaceId(workspaceId || ""),
    senderSource: mailer.senderSource,
    from: mailer.from,
    replyTo: mailer.replyTo,
    transporterAuthUser: mailer.config.username,
    smtpHost: mailer.config.host,
    smtpUser: mailer.config.username,
    toRecipients,
    ccRecipients,
    bccRecipients,
  });

  const info = await mailer.transporter.sendMail({
    from: mailer.from,
    to: toRecipients.length ? toRecipients.join(",") : undefined,
    cc: ccRecipients.length ? ccRecipients.join(",") : undefined,
    bcc: bccRecipients.length ? bccRecipients.join(",") : undefined,
    replyTo: mailer.replyTo || undefined,
    subject,
    html,
    text,
  });

  return {
    info,
    from: mailer.from,
    replyTo: mailer.replyTo,
    authUser: mailer.config.username,
    senderSource: mailer.senderSource,
    senderUser: mailer.senderUser,
    workspaceId: mailer.workspaceId,
  };
};

const sendWorkspaceEmail = async ({
  workspaceId,
  to,
  cc,
  bcc,
  subject,
  html,
  text,
  overrideConfig = null,
}) => {
  const toRecipients = [...new Set(normalizeRecipientList(to))];
  const ccRecipients = [...new Set(normalizeRecipientList(cc))];
  const bccRecipients = [...new Set(normalizeRecipientList(bcc))];

  if (!toRecipients.length && !ccRecipients.length && !bccRecipients.length) {
    return null;
  }

  const workspaceMailer = await getWorkspaceMailer(workspaceId, {
    overrideConfig,
  });

  return sendMailWithMailer({
    mailer: workspaceMailer,
    workspaceId,
    to: toRecipients,
    cc: ccRecipients,
    bcc: bccRecipients,
    subject,
    html,
    text,
    logLabel: "sendWorkspaceEmail",
  });
};

const sendIssueNotificationEmail = async ({
  creatorUserId,
  workspaceId,
  to,
  cc,
  bcc,
  subject,
  html,
  text,
}) => {
  const issueNotificationMailer = await getNotificationMailer({
    creatorUserId,
    workspaceId,
  });
  const attemptedMailers =
    issueNotificationMailer.attemptMailers?.length
      ? issueNotificationMailer.attemptMailers
      : [issueNotificationMailer];
  let lastError = null;

  for (let index = 0; index < attemptedMailers.length; index += 1) {
    const candidateMailer = attemptedMailers[index];
    const isLastAttempt = index === attemptedMailers.length - 1;

    try {
      return await sendMailWithMailer({
        mailer: candidateMailer,
        workspaceId,
        to,
        cc,
        bcc,
        subject,
        html,
        text,
        logLabel: `sendIssueNotificationEmail attempt ${index + 1}`,
      });
    } catch (error) {
      lastError = error;

      console.error("[email] Issue notification send attempt failed", {
        attempt: index + 1,
        senderSource: candidateMailer?.senderSource || "unknown",
        from: candidateMailer?.from || "",
        authUser: candidateMailer?.config?.username || "",
        smtpHost: candidateMailer?.config?.host || "",
        smtpPort: candidateMailer?.config?.port || "",
        smtpSecure:
          typeof candidateMailer?.config?.secure === "boolean"
            ? candidateMailer.config.secure
            : null,
        code: error.code || "",
        response: error.response || "",
        message: error.message,
        willFallback: !isLastAttempt && shouldFallbackToNextMailer(error),
      });

      if (isLastAttempt || !shouldFallbackToNextMailer(error)) {
        throw error;
      }
    }
  }

  throw lastError;
};

const sendIssueEmail = async (emails, issue, options = {}) => {
  const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  const issueUrl = `${appUrl}/issues/${issue._id}`;

  return sendIssueNotificationEmail({
    creatorUserId: options.creatorUserId,
    workspaceId: options.workspaceId,
    to: emails,
    subject: `New Issue Created: ${issue.title}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #2563EB;">New Issue Created</h2>

        <p><b>Title:</b> ${escapeHtml(issue.title)}</p>
        <p><b>Description:</b> ${escapeHtml(issue.description || "N/A")}</p>

        <hr />

        <p><b>Project:</b> ${escapeHtml(issue.projectName || "N/A")}</p>
        <p><b>Assigned To:</b> ${escapeHtml(issue.assigneeName || "Unassigned")}</p>
        <p><b>Priority:</b> ${escapeHtml(issue.priority || "Medium")}</p>
        <p><b>Status:</b> ${escapeHtml(getStatusLabel(issue.status))}</p>

        <hr />

        <p><b>Created At:</b> ${escapeHtml(formatDateTime(issue.createdAt))}</p>
        <p><b>Due Date:</b> ${escapeHtml(formatDateTime(issue.dueDate))}</p>

        <br />

        <a
          href="${escapeHtml(issueUrl)}"
          style="background: #2563EB; color: #fff; padding: 10px 16px; border-radius: 6px; text-decoration: none;"
        >
          View Issue
        </a>

        <p style="margin-top: 20px; color: #888; font-size: 12px;">
          Automated notification from Pirnav Workspace
        </p>
      </div>
    `,
  });
};

const sendProjectMeetingInviteEmail = async (emails, meeting, options = {}) => {
  const meetingTitleText = String(meeting?.subject || "Project team meeting").trim();
  const meetingTitle = escapeHtml(meetingTitleText || "Project team meeting");
  const projectName = escapeHtml(meeting?.projectName || "Project");
  const joinUrl = String(meeting?.joinUrl || "").trim();
  const hasJoinUrl = Boolean(joinUrl);

  return sendWorkspaceEmail({
    workspaceId: options.workspaceId,
    to: emails,
    subject: `Meeting Scheduled: ${meetingTitleText || "Project team meeting"}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #2563EB;">Team Meeting Scheduled</h2>

        <p><b>Project:</b> ${projectName}</p>
        <p><b>Title:</b> ${meetingTitle}</p>
        <p><b>Start:</b> ${escapeHtml(formatDateTime(meeting?.startDateTime))}</p>
        <p><b>End:</b> ${escapeHtml(formatDateTime(meeting?.endDateTime))}</p>

        ${
          hasJoinUrl
            ? `
          <br />
          <a
            href="${escapeHtml(joinUrl)}"
            style="background: #2563EB; color: #fff; padding: 10px 16px; border-radius: 6px; text-decoration: none;"
          >
            Join Microsoft Teams Meeting
          </a>
          <p style="margin-top: 12px; font-size: 12px; color: #64748B;">
            If the button does not work, copy this URL:
            <br />
            <a href="${escapeHtml(joinUrl)}">${escapeHtml(joinUrl)}</a>
          </p>
        `
            : ""
        }

        <p style="margin-top: 20px; color: #888; font-size: 12px;">
          Automated notification from Pirnav Workspace
        </p>
      </div>
    `,
  });
};

const sendTestEmail = async ({ to, workspaceId, overrideConfig = null }) =>
  sendWorkspaceEmail({
    workspaceId,
    to,
    overrideConfig,
    subject: "Workspace mail sender test",
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #2563EB;">SMTP Configuration Test</h2>
        <p>This message confirms that the saved SMTP configuration can send email.</p>
        <p style="margin-top: 16px; color: #64748B; font-size: 13px;">
          Sent from the bug tracker settings panel.
        </p>
      </div>
    `,
    text: "SMTP configuration test successful.",
  });

module.exports = {
  getWorkspaceMailer,
  getNotificationMailer,
  getIssueNotificationMailer,
  sendWorkspaceEmail,
  sendIssueNotificationEmail,
  normalizeEmailConfig,
  hasCompleteEmailConfig,
  isValidEmailAddress,
  isValidSmtpHost,
  sendIssueEmail,
  sendProjectMeetingInviteEmail,
  sendTestEmail,
};
