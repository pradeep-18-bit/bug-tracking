export const CURRENT_WORKSPACE_SCOPE = "current";

export const getWorkspaceScope = (user) =>
  user?.workspaceId || CURRENT_WORKSPACE_SCOPE;
