export const buildEmptyWorkspaceSenderSelection = () => ({
  enabled: false,
  userId: "",
  user: null,
  source: "global-default",
  manualSelection: {
    enabled: false,
    userId: "",
    user: null,
  },
  workspaceDefault: {
    enabled: false,
    userId: "",
    user: null,
  },
  note: "",
});

export const normalizeWorkspaceSenderSelection = (selection = {}) => ({
  ...buildEmptyWorkspaceSenderSelection(),
  ...selection,
  enabled: Boolean(selection?.enabled && selection?.userId),
  userId: selection?.userId ? String(selection.userId) : "",
  user: selection?.enabled && selection?.userId ? selection?.user || null : null,
  source: selection?.source || "global-default",
  manualSelection: {
    enabled: Boolean(
      selection?.manualSelection?.enabled && selection?.manualSelection?.userId
    ),
    userId: selection?.manualSelection?.userId
      ? String(selection.manualSelection.userId)
      : "",
    user:
      selection?.manualSelection?.enabled && selection?.manualSelection?.userId
        ? selection?.manualSelection?.user || null
        : null,
  },
  workspaceDefault: {
    enabled: Boolean(
      selection?.workspaceDefault?.enabled &&
        selection?.workspaceDefault?.userId
    ),
    userId: selection?.workspaceDefault?.userId
      ? String(selection.workspaceDefault.userId)
      : "",
    user:
      selection?.workspaceDefault?.enabled &&
      selection?.workspaceDefault?.userId
        ? selection?.workspaceDefault?.user || null
        : null,
  },
  note: typeof selection?.note === "string" ? selection.note : "",
});

export const normalizeWorkspaceSenderResponse = (payload) => {
  const data =
    payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const responseWorkspaceSender =
    data?.workspaceSender && typeof data.workspaceSender === "object"
      ? data.workspaceSender
      : data;
  const workspaceSender = normalizeWorkspaceSenderSelection(responseWorkspaceSender);

  return {
    ...data,
    ...workspaceSender,
    workspaceSender,
    message: typeof data?.message === "string" ? data.message : "",
  };
};

export const getWorkspaceSenderSelectionState = (selection = {}) => {
  const workspaceSender = normalizeWorkspaceSenderSelection(selection);
  const manualSelection = workspaceSender?.manualSelection;
  const workspaceDefaultSelection = workspaceSender?.workspaceDefault;
  const hasManualSender = Boolean(
    manualSelection?.enabled && manualSelection?.userId
  );
  const hasActiveSender = Boolean(
    workspaceSender?.enabled && workspaceSender?.userId
  );
  const hasWorkspaceDefaultSender = Boolean(
    workspaceDefaultSelection?.enabled && workspaceDefaultSelection?.userId
  );

  return {
    workspaceSender,
    manualSelection,
    workspaceDefaultSelection,
    hasManualSender,
    hasActiveSender,
    hasWorkspaceDefaultSender,
    manualSenderId: hasManualSender ? manualSelection?.userId || "" : "",
    activeSenderId: hasActiveSender ? workspaceSender?.userId || "" : "",
    workspaceDefaultSenderId: hasWorkspaceDefaultSender
      ? workspaceDefaultSelection?.userId || ""
      : "",
    activeSenderUser: hasActiveSender ? workspaceSender?.user || null : null,
    manualSenderUser: hasManualSender ? manualSelection?.user || null : null,
    workspaceDefaultSender: hasWorkspaceDefaultSender
      ? workspaceDefaultSelection?.user || null
      : null,
  };
};

export const getWorkspaceSenderResponseState = (payload) => {
  const response = normalizeWorkspaceSenderResponse(payload);

  return {
    response,
    ...getWorkspaceSenderSelectionState(response?.workspaceSender),
  };
};
