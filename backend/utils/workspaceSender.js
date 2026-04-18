const DEFAULT_GLOBAL_FALLBACK_NOTE =
  "No saved sender is available, so the app will use the global fallback sender.";

const buildSenderSelectionPayload = ({
  enabled = false,
  userId = "",
  user = null,
} = {}) => ({
  enabled: Boolean(enabled && userId),
  userId: enabled && userId ? String(userId) : "",
  user: enabled && userId ? user : null,
});

const normalizeResolvedSenderSelection = (senderSelection = {}) => ({
  ...buildSenderSelectionPayload(senderSelection),
  source: senderSelection?.source || "global-default",
  manualSelection: buildSenderSelectionPayload(senderSelection?.manualSelection),
  workspaceDefault: buildSenderSelectionPayload(senderSelection?.workspaceDefault),
  note: typeof senderSelection?.note === "string" ? senderSelection.note : "",
});

const getWorkspaceSenderState = (settings = {}) => {
  const workspaceSender = settings?.workspaceSender || null;
  const workspaceSenderUserId = workspaceSender?.userId
    ? String(workspaceSender?.userId)
    : "";

  return {
    workspaceSender,
    workspaceSenderUserId,
    hasWorkspaceSender: Boolean(workspaceSender?.enabled && workspaceSenderUserId),
  };
};

const buildEffectiveSenderSelection = ({
  manualSelection = {},
  workspaceDefault = {},
  globalFallbackNote = DEFAULT_GLOBAL_FALLBACK_NOTE,
} = {}) => {
  const normalizedManualSelection = buildSenderSelectionPayload(manualSelection);
  const normalizedWorkspaceDefault =
    buildSenderSelectionPayload(workspaceDefault);
  const note = [manualSelection?.note, workspaceDefault?.note]
    .filter(Boolean)
    .join(" ");

  if (normalizedManualSelection.enabled) {
    return normalizeResolvedSenderSelection({
      enabled: true,
      userId: normalizedManualSelection.userId,
      user: normalizedManualSelection.user,
      source: "manual",
      manualSelection: normalizedManualSelection,
      workspaceDefault: normalizedWorkspaceDefault,
      note,
    });
  }

  if (normalizedWorkspaceDefault.enabled) {
    return normalizeResolvedSenderSelection({
      enabled: true,
      userId: normalizedWorkspaceDefault.userId,
      user: normalizedWorkspaceDefault.user,
      source: "workspace-default",
      manualSelection: normalizedManualSelection,
      workspaceDefault: normalizedWorkspaceDefault,
      note,
    });
  }

  return normalizeResolvedSenderSelection({
    source: "global-default",
    manualSelection: normalizedManualSelection,
    workspaceDefault: normalizedWorkspaceDefault,
    note: note || globalFallbackNote,
  });
};

const buildWorkspaceSenderResponse = ({
  senderSelection = {},
  message = "",
} = {}) => {
  const workspaceSender = normalizeResolvedSenderSelection(senderSelection);

  return {
    message: typeof message === "string" ? message : "",
    ...workspaceSender,
    workspaceSender,
  };
};

module.exports = {
  DEFAULT_GLOBAL_FALLBACK_NOTE,
  buildSenderSelectionPayload,
  normalizeResolvedSenderSelection,
  getWorkspaceSenderState,
  buildEffectiveSenderSelection,
  buildWorkspaceSenderResponse,
};
