const mongoose = require("mongoose");
const User = require("../models/User");
const UserEmailConfig = require("../models/UserEmailConfig");
const WorkspaceSetting = require("../models/WorkspaceSetting");
const {
  hasCompleteEmailConfig,
  isValidEmailAddress,
  isValidSmtpHost,
  normalizeEmailConfig,
  sendTestEmail,
} = require("../services/emailService");
const asyncHandler = require("../utils/asyncHandler");
const { decryptSecret, encryptSecret } = require("../utils/emailCrypto");
const {
  ROLE_ADMIN,
  ROLE_MANAGER,
  isEligibleWorkspaceSenderRole,
} = require("../utils/roles");
const { normalizeWorkspaceId } = require("../utils/workspace");

const MASKED_PASSWORD_PATTERN = /^(?:\*|â€¢|â—|âˆ™){6,}$/u;

const getEmailSendFailureMessage = (error) => {
  if (error?.code === "EAUTH" || String(error?.response || "").includes("535")) {
    return "Invalid SMTP username/password";
  }

  if (error?.code === "ENOTFOUND" || error?.code === "EAI_AGAIN") {
    return "SMTP host could not be resolved. Check the SMTP host spelling or the server DNS.";
  }

  return error?.message || "Unable to send test email right now.";
};

const normalizeSubmittedPassword = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  if (MASKED_PASSWORD_PATTERN.test(value.trim())) {
    return "";
  }

  return value;
};

const getValidationErrors = (config = {}, { requirePassword = true } = {}) => {
  const errors = {};

  if (!config.host) {
    errors.host = "SMTP host is required";
  } else if (!isValidSmtpHost(config.host)) {
    errors.host = "SMTP host must be a valid hostname or IPv4 address";
  }

  if (!Number.isFinite(config.port) || config.port < 1 || config.port > 65535) {
    errors.port = "SMTP port must be between 1 and 65535";
  }

  if (!config.username) {
    errors.username = "Email username is required";
  } else if (!isValidEmailAddress(config.username)) {
    errors.username = "Email username must be a valid email address";
  }

  if (requirePassword && !config.password) {
    errors.password = "Email password is required";
  }

  if (!config.fromName) {
    errors.fromName = "From name is required";
  }

  if (!config.fromEmail) {
    errors.fromEmail = "From email is required";
  } else if (!isValidEmailAddress(config.fromEmail)) {
    errors.fromEmail = "Please provide a valid from email address";
  }

  return errors;
};

const getFirstValidationMessage = (errors = {}) => Object.values(errors)[0] || "";

const serializeEmailConfig = (config) => {
  if (!config) {
    return null;
  }

  const normalizedConfig = normalizeEmailConfig(config, {
    allowUsernameFallback: true,
  });

  return {
    host: normalizedConfig.host,
    port: normalizedConfig.port,
    secure: Boolean(normalizedConfig.secure),
    username: normalizedConfig.username,
    fromName: normalizedConfig.fromName,
    fromEmail: normalizedConfig.fromEmail,
    hasPassword: Boolean(config.passwordEncrypted),
    updatedAt: config.updatedAt || null,
  };
};

const serializeSenderUser = (user, smtpConfigured = false) => {
  if (!user) {
    return null;
  }

  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    smtpConfigured,
  };
};

const hasStoredSmtpConfig = (config) =>
  Boolean(config?.passwordEncrypted) &&
  hasCompleteEmailConfig({
    host: config?.host,
    port: config?.port,
    secure: config?.secure,
    username: config?.username,
    password: "stored",
    fromName: config?.fromName,
    fromEmail: config?.fromEmail,
  });

const getUserSmtpConfigState = async ({ workspaceId, userId }) => {
  const config = await UserEmailConfig.findOne({
    workspaceId,
    userId,
  })
    .select("+passwordEncrypted host port secure username fromName fromEmail")
    .lean();

  return {
    config,
    smtpConfigured: hasStoredSmtpConfig(config),
  };
};

const buildSenderSelectionPayload = ({
  enabled = false,
  userId = "",
  user = null,
}) => ({
  enabled,
  userId: enabled && userId ? String(userId) : "",
  user: enabled ? user : null,
});

const resolveEligibleSenderUser = async (userId, workspaceId, res) => {
  if (!mongoose.isValidObjectId(userId)) {
    res.status(400);
    throw new Error("Please provide a valid sender user");
  }

  const user = await User.findOne({
    _id: userId,
    workspaceId,
  })
    .select("_id name email role workspaceId senderPreference")
    .lean();

  if (!user) {
    res.status(404);
    throw new Error("Selected sender user was not found in this workspace");
  }

  if (!isEligibleWorkspaceSenderRole(user.role)) {
    res.status(400);
    throw new Error("Only Admin and Manager users can be configured as senders");
  }

  return user;
};

const buildConfigFromRequest = ({ body, existingConfig }) => {
  const normalizedPayload = normalizeEmailConfig(
    {
      host: body?.host,
      port: body?.port,
      secure: body?.secure,
      username: body?.username,
      password: normalizeSubmittedPassword(body?.password),
      fromName: body?.fromName,
      fromEmail: body?.fromEmail,
    },
    {
      allowUsernameFallback: false,
    }
  );
  const resolvedPassword =
    normalizedPayload.password ||
    (typeof existingConfig?.password === "string" ? existingConfig.password : "");

  return {
    ...normalizedPayload,
    password: resolvedPassword,
  };
};

const saveWorkspaceSenderSelection = async ({
  workspaceId,
  senderUserId,
  updatedByUserId,
}) =>
  WorkspaceSetting.findOneAndUpdate(
    {
      workspaceId,
    },
    {
      $set: {
        workspaceId,
        workspaceSender: {
          userId: senderUserId,
          enabled: true,
          updatedBy: updatedByUserId || null,
          updatedAt: new Date(),
        },
        updatedAt: new Date(),
      },
      $setOnInsert: {
        createdAt: new Date(),
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  ).lean();

const clearWorkspaceSenderSelection = async ({
  workspaceId,
  userId,
  matchUserId = null,
}) => {
  const query = {
    workspaceId,
  };

  if (matchUserId) {
    query["workspaceSender.userId"] = matchUserId;
  }

  return WorkspaceSetting.findOneAndUpdate(
    {
      ...query,
    },
    {
      $set: {
        workspaceId,
        workspaceSender: {
          userId: null,
          enabled: false,
          updatedBy: userId || null,
          updatedAt: new Date(),
        },
        updatedAt: new Date(),
      },
      $setOnInsert: {
        createdAt: new Date(),
      },
    },
    {
      upsert: !matchUserId,
      new: true,
      setDefaultsOnInsert: true,
    }
  ).lean();
};

const saveUserSenderPreference = async ({
  workspaceId,
  ownerUserId,
  senderUserId,
  updatedByUserId,
}) =>
  User.findOneAndUpdate(
    {
      _id: ownerUserId,
      workspaceId,
    },
    {
      $set: {
        senderPreference: {
          userId: senderUserId,
          updatedBy: updatedByUserId || null,
          updatedAt: new Date(),
        },
      },
    },
    {
      new: true,
    }
  )
    .select("_id senderPreference")
    .lean();

const clearUserSenderPreference = async ({
  workspaceId,
  ownerUserId,
  updatedByUserId,
  matchSenderUserId = null,
}) => {
  const query = {
    _id: ownerUserId,
    workspaceId,
  };

  if (matchSenderUserId) {
    query["senderPreference.userId"] = matchSenderUserId;
  }

  return User.findOneAndUpdate(
    query,
    {
      $set: {
        senderPreference: {
          userId: null,
          updatedBy: updatedByUserId || null,
          updatedAt: new Date(),
        },
      },
    },
    {
      new: true,
    }
  )
    .select("_id senderPreference")
    .lean();
};

const clearUserSenderSelectionsForSender = async ({
  workspaceId,
  senderUserId,
  updatedByUserId,
}) =>
  User.updateMany(
    {
      workspaceId,
      "senderPreference.userId": senderUserId,
    },
    {
      $set: {
        senderPreference: {
          userId: null,
          updatedBy: updatedByUserId || null,
          updatedAt: new Date(),
        },
      },
    }
  );

const loadWorkspaceDefaultSenderSelection = async ({
  workspaceId,
  updatedByUserId = null,
  clearInvalid = false,
}) => {
  const normalizedWorkspaceId = normalizeWorkspaceId(workspaceId);
  const settings = await WorkspaceSetting.findOne({
    workspaceId: normalizedWorkspaceId,
  })
    .select("workspaceSender")
    .lean();

  if (!settings?.workspaceSender?.enabled || !settings.workspaceSender.userId) {
    return {
      ...buildSenderSelectionPayload(),
      source: "workspace-default",
      note: "",
    };
  }

  const senderUser = await User.findOne({
    _id: settings.workspaceSender.userId,
    workspaceId: normalizedWorkspaceId,
  })
    .select("_id name email role")
    .lean();

  if (!senderUser || !isEligibleWorkspaceSenderRole(senderUser.role)) {
    if (clearInvalid) {
      await clearWorkspaceSenderSelection({
        workspaceId: normalizedWorkspaceId,
        userId: updatedByUserId,
        matchUserId: settings.workspaceSender.userId,
      });
    }

    return {
      ...buildSenderSelectionPayload(),
      source: "workspace-default",
      note:
        "The workspace default sender is no longer eligible, so the app will use the global fallback sender.",
    };
  }

  const { smtpConfigured } = await getUserSmtpConfigState({
    workspaceId: normalizedWorkspaceId,
    userId: senderUser._id,
  });

  if (!smtpConfigured) {
    if (clearInvalid) {
      await clearWorkspaceSenderSelection({
        workspaceId: normalizedWorkspaceId,
        userId: updatedByUserId,
        matchUserId: senderUser._id,
      });
    }

    return {
      ...buildSenderSelectionPayload(),
      source: "workspace-default",
      note:
        "The workspace default sender needs SMTP setup, so the app will use the global fallback sender.",
    };
  }

  return {
    ...buildSenderSelectionPayload({
      enabled: true,
      userId: senderUser._id,
      user: serializeSenderUser(senderUser, true),
    }),
    source: "workspace-default",
    note: "",
  };
};

const loadUserManualSenderSelection = async ({
  workspaceId,
  ownerUserId,
  updatedByUserId = null,
  clearInvalid = false,
}) => {
  const normalizedWorkspaceId = normalizeWorkspaceId(workspaceId);

  if (!mongoose.isValidObjectId(ownerUserId)) {
    return {
      ...buildSenderSelectionPayload(),
      source: "manual",
      note: "",
    };
  }

  const ownerUser = await User.findOne({
    _id: ownerUserId,
    workspaceId: normalizedWorkspaceId,
  })
    .select("_id senderPreference")
    .lean();

  if (!ownerUser?.senderPreference?.userId) {
    return {
      ...buildSenderSelectionPayload(),
      source: "manual",
      note: "",
    };
  }

  const senderUser = await User.findOne({
    _id: ownerUser.senderPreference.userId,
    workspaceId: normalizedWorkspaceId,
  })
    .select("_id name email role")
    .lean();

  if (!senderUser || !isEligibleWorkspaceSenderRole(senderUser.role)) {
    if (clearInvalid) {
      await clearUserSenderPreference({
        workspaceId: normalizedWorkspaceId,
        ownerUserId,
        updatedByUserId,
        matchSenderUserId: ownerUser.senderPreference.userId,
      });
    }

    return {
      ...buildSenderSelectionPayload(),
      source: "manual",
      note:
        "Your saved active sender is no longer eligible, so the app reverted to the workspace default sender.",
    };
  }

  const { smtpConfigured } = await getUserSmtpConfigState({
    workspaceId: normalizedWorkspaceId,
    userId: senderUser._id,
  });

  if (!smtpConfigured) {
    if (clearInvalid) {
      await clearUserSenderPreference({
        workspaceId: normalizedWorkspaceId,
        ownerUserId,
        updatedByUserId,
        matchSenderUserId: senderUser._id,
      });
    }

    return {
      ...buildSenderSelectionPayload(),
      source: "manual",
      note:
        "Your saved active sender needs SMTP setup, so the app reverted to the workspace default sender.",
    };
  }

  return {
    ...buildSenderSelectionPayload({
      enabled: true,
      userId: senderUser._id,
      user: serializeSenderUser(senderUser, true),
    }),
    source: "manual",
    note: "",
  };
};

const resolveEffectiveSenderSelection = async ({
  workspaceId,
  ownerUserId,
  updatedByUserId = null,
  clearInvalid = false,
}) => {
  const normalizedWorkspaceId = normalizeWorkspaceId(workspaceId);
  const [manualSelection, workspaceDefault] = await Promise.all([
    loadUserManualSenderSelection({
      workspaceId: normalizedWorkspaceId,
      ownerUserId,
      updatedByUserId,
      clearInvalid,
    }),
    loadWorkspaceDefaultSenderSelection({
      workspaceId: normalizedWorkspaceId,
      updatedByUserId,
      clearInvalid,
    }),
  ]);
  const note = [manualSelection.note, workspaceDefault.note]
    .filter(Boolean)
    .join(" ");

  if (manualSelection.enabled) {
    return {
      ...buildSenderSelectionPayload({
        enabled: true,
        userId: manualSelection.userId,
        user: manualSelection.user,
      }),
      source: "manual",
      manualSelection: buildSenderSelectionPayload({
        enabled: true,
        userId: manualSelection.userId,
        user: manualSelection.user,
      }),
      workspaceDefault: buildSenderSelectionPayload(workspaceDefault),
      note,
    };
  }

  if (workspaceDefault.enabled) {
    return {
      ...buildSenderSelectionPayload({
        enabled: true,
        userId: workspaceDefault.userId,
        user: workspaceDefault.user,
      }),
      source: "workspace-default",
      manualSelection: buildSenderSelectionPayload(manualSelection),
      workspaceDefault: buildSenderSelectionPayload(workspaceDefault),
      note,
    };
  }

  return {
    ...buildSenderSelectionPayload(),
    source: "global-default",
    manualSelection: buildSenderSelectionPayload(manualSelection),
    workspaceDefault: buildSenderSelectionPayload(workspaceDefault),
    note:
      note ||
      "No saved sender is available, so the app will use the global fallback sender.",
  };
};

const getEmailConfig = asyncHandler(async (req, res) => {
  const workspaceId = normalizeWorkspaceId(req.user.workspaceId);
  const userId = String(req.query.userId || "").trim();

  if (!userId) {
    res.status(400);
    throw new Error("A sender user id is required");
  }

  const user = await resolveEligibleSenderUser(userId, workspaceId, res);
  const config = await UserEmailConfig.findOne({
    workspaceId,
    userId,
  })
    .select("host port secure username fromName fromEmail updatedAt")
    .lean();
  const passwordRecord = await UserEmailConfig.findOne({
    workspaceId,
    userId,
  })
    .select("+passwordEncrypted")
    .lean();

  res.status(200).json({
    user: serializeSenderUser(
      user,
      hasStoredSmtpConfig({
        ...config,
        passwordEncrypted: passwordRecord?.passwordEncrypted,
      })
    ),
    config: config
      ? {
          ...serializeEmailConfig({
            ...config,
            passwordEncrypted: passwordRecord?.passwordEncrypted || "",
          }),
        }
      : null,
  });
});

const saveEmailConfig = asyncHandler(async (req, res) => {
  const workspaceId = normalizeWorkspaceId(req.user.workspaceId);
  const userId = String(req.body.userId || "").trim();

  if (!userId) {
    res.status(400);
    throw new Error("A sender user must be selected before saving configuration");
  }

  const user = await resolveEligibleSenderUser(userId, workspaceId, res);
  const existingConfig = await UserEmailConfig.findOne({
    workspaceId,
    userId,
  })
    .select("+passwordEncrypted host port secure username fromName fromEmail")
    .lean();
  const nextConfig = buildConfigFromRequest({
    body: req.body,
    existingConfig: existingConfig
      ? {
          ...existingConfig,
          password: existingConfig.passwordEncrypted
            ? decryptSecret(existingConfig.passwordEncrypted)
            : "",
        }
      : null,
  });
  const validationErrors = getValidationErrors(nextConfig, {
    requirePassword: !existingConfig?.passwordEncrypted && !nextConfig.password,
  });

  if (Object.keys(validationErrors).length) {
    res.status(400);
    throw new Error(getFirstValidationMessage(validationErrors));
  }

  const submittedPassword = normalizeSubmittedPassword(req.body.password);
  const nextPasswordEncrypted = submittedPassword
    ? encryptSecret(submittedPassword)
    : existingConfig?.passwordEncrypted;

  if (!nextPasswordEncrypted) {
    res.status(400);
    throw new Error("Email password is required");
  }

  const savedConfig = await UserEmailConfig.findOneAndUpdate(
    {
      workspaceId,
      userId,
    },
    {
      $set: {
        host: nextConfig.host,
        port: nextConfig.port,
        secure: nextConfig.secure,
        username: nextConfig.username,
        passwordEncrypted: nextPasswordEncrypted,
        fromName: nextConfig.fromName,
        fromEmail: nextConfig.fromEmail,
        updatedBy: req.user._id,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        workspaceId,
        userId,
        createdAt: new Date(),
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  )
    .select("host port secure username fromName fromEmail updatedAt")
    .lean();

  res.status(200).json({
    message: `${user.name}'s email configuration saved successfully`,
    user: serializeSenderUser(user, true),
    config: serializeEmailConfig({
      ...savedConfig,
      passwordEncrypted: nextPasswordEncrypted,
    }),
  });
});

const testEmailConfig = asyncHandler(async (req, res) => {
  const workspaceId = normalizeWorkspaceId(req.user.workspaceId);
  const userId = String(req.body.userId || "").trim();

  if (!userId) {
    res.status(400);
    throw new Error("Select a sender user before sending a test email");
  }

  await resolveEligibleSenderUser(userId, workspaceId, res);

  const existingConfig = await UserEmailConfig.findOne({
    workspaceId,
    userId,
  })
    .select("+passwordEncrypted host port secure username fromName fromEmail")
    .lean();
  const nextConfig = buildConfigFromRequest({
    body: req.body,
    existingConfig: existingConfig
      ? {
          ...existingConfig,
          password: existingConfig.passwordEncrypted
            ? decryptSecret(existingConfig.passwordEncrypted)
            : "",
        }
      : null,
  });
  const validationErrors = getValidationErrors(nextConfig, {
    requirePassword: !existingConfig?.passwordEncrypted && !nextConfig.password,
  });

  if (Object.keys(validationErrors).length || !hasCompleteEmailConfig(nextConfig)) {
    res.status(400);
    throw new Error(
      getFirstValidationMessage(validationErrors) ||
        "Complete the SMTP configuration before sending a test email"
    );
  }

  try {
    await sendTestEmail({
      to: req.user.email,
      workspaceId,
      overrideConfig: nextConfig,
    });
  } catch (error) {
    res.status(400);
    throw new Error(getEmailSendFailureMessage(error));
  }

  res.status(200).json({
    message: "Test email sent successfully",
  });
});

const getEligibleSenders = asyncHandler(async (req, res) => {
  const workspaceId = normalizeWorkspaceId(req.user.workspaceId);
  const eligibleUsers = await User.find({
    workspaceId,
    role: {
      $in: [ROLE_ADMIN, ROLE_MANAGER],
    },
  })
    .select("_id name email role")
    .sort({ name: 1, email: 1 })
    .lean();

  if (!eligibleUsers.length) {
    res.status(200).json([]);
    return;
  }

  const emailConfigs = await UserEmailConfig.find({
    workspaceId,
    userId: {
      $in: eligibleUsers.map((user) => user._id),
    },
  })
    .select("+passwordEncrypted userId host port secure username fromName fromEmail")
    .lean();
  const configByUserId = new Map(
    emailConfigs.map((config) => [String(config.userId), config])
  );

  res.status(200).json(
    eligibleUsers.map((user) => {
      const smtpConfigured = hasStoredSmtpConfig(configByUserId.get(String(user._id)));

      return serializeSenderUser(user, smtpConfigured);
    })
  );
});

const getWorkspaceSender = asyncHandler(async (req, res) => {
  const workspaceId = normalizeWorkspaceId(req.user.workspaceId);
  const effectiveSender = await resolveEffectiveSenderSelection({
    workspaceId,
    ownerUserId: req.user._id,
    updatedByUserId: req.user._id,
    clearInvalid: true,
  });

  res.status(200).json(effectiveSender);
});

const saveWorkspaceSender = asyncHandler(async (req, res) => {
  const workspaceId = normalizeWorkspaceId(req.user.workspaceId);
  const selectedSenderUserId = String(req.body.userId || "").trim();
  const enabled = Boolean(req.body.enabled);

  if (!enabled || !selectedSenderUserId) {
    await clearUserSenderPreference({
      workspaceId,
      ownerUserId: req.user._id,
      updatedByUserId: req.user._id,
    });

    const effectiveSender = await resolveEffectiveSenderSelection({
      workspaceId,
      ownerUserId: req.user._id,
      updatedByUserId: req.user._id,
      clearInvalid: true,
    });

    res.status(200).json({
      message: effectiveSender.workspaceDefault?.enabled
        ? "Active sender reset to the workspace default."
        : "Active sender reset. The global fallback sender will be used.",
      ...effectiveSender,
    });
    return;
  }

  const senderUser = await resolveEligibleSenderUser(
    selectedSenderUserId,
    workspaceId,
    res
  );
  const { smtpConfigured } = await getUserSmtpConfigState({
    workspaceId,
    userId: senderUser._id,
  });

  if (!smtpConfigured) {
    res.status(400);
    throw new Error(
      "The selected user does not have SMTP configuration yet. Save their email configuration first."
    );
  }

  await saveUserSenderPreference({
    workspaceId,
    ownerUserId: req.user._id,
    senderUserId: senderUser._id,
    updatedByUserId: req.user._id,
  });

  const effectiveSender = await resolveEffectiveSenderSelection({
    workspaceId,
    ownerUserId: req.user._id,
    updatedByUserId: req.user._id,
    clearInvalid: true,
  });

  res.status(200).json({
    message: `${senderUser.name} is now the active sender for your account`,
    ...effectiveSender,
  });
});

module.exports = {
  getEmailConfig,
  saveEmailConfig,
  testEmailConfig,
  getWorkspaceSender,
  saveWorkspaceSender,
  getEligibleSenders,
  clearWorkspaceSenderSelection,
  clearUserSenderPreference,
  clearUserSenderSelectionsForSender,
  resolveEffectiveSenderSelection,
};
