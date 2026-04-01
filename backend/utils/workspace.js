const crypto = require("crypto");

const LEGACY_WORKSPACE_ID = "legacy-workspace";
const CURRENT_WORKSPACE_SCOPE = "current";

const normalizeWorkspaceId = (value, fallback = LEGACY_WORKSPACE_ID) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || fallback;
};

const createWorkspaceId = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `ws_${crypto.randomBytes(12).toString("hex")}`;

const resolveRequestedWorkspaceId = (
  requestedWorkspaceId,
  currentWorkspaceId = LEGACY_WORKSPACE_ID
) => {
  const activeWorkspaceId = normalizeWorkspaceId(currentWorkspaceId);
  const requestedValue =
    typeof requestedWorkspaceId === "string" ? requestedWorkspaceId.trim() : "";

  if (!requestedValue || requestedValue === CURRENT_WORKSPACE_SCOPE) {
    return activeWorkspaceId;
  }

  return normalizeWorkspaceId(requestedValue, activeWorkspaceId);
};

const hasWorkspaceAccess = (requestedWorkspaceId, currentWorkspaceId) =>
  resolveRequestedWorkspaceId(requestedWorkspaceId, currentWorkspaceId) ===
  normalizeWorkspaceId(currentWorkspaceId);

module.exports = {
  LEGACY_WORKSPACE_ID,
  CURRENT_WORKSPACE_SCOPE,
  normalizeWorkspaceId,
  createWorkspaceId,
  resolveRequestedWorkspaceId,
  hasWorkspaceAccess,
};
