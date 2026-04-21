import axios from "axios";
import { readStoredSession } from "@/lib/session";
import { normalizeWorkspaceSenderResponse } from "@/lib/workspaceSender";
import { CURRENT_WORKSPACE_SCOPE } from "@/lib/workspace";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const session = readStoredSession();

  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    delete config.headers["Content-Type"];
    delete config.headers["content-type"];
  }

  if (session?.token) {
    config.headers.Authorization = `Bearer ${session.token}`;
  }

  return config;
});

const buildParams = (filters = {}) =>
  Object.fromEntries(
    Object.entries(filters).filter(
      ([, value]) => value !== undefined && value !== null && value !== "" && value !== "all"
    )
  );

const hasOwnField = (payload, field) =>
  Object.prototype.hasOwnProperty.call(payload || {}, field);

const normalizeIssueFilters = (filters = {}) => {
  const normalizedFilters = {
    ...filters,
  };

  if (
    !hasOwnField(normalizedFilters, "assigneeId") &&
    hasOwnField(normalizedFilters, "assignee")
  ) {
    normalizedFilters.assigneeId = normalizedFilters.assignee;
    delete normalizedFilters.assignee;
  }

  return normalizedFilters;
};

const normalizeIssuePayload = (payload = {}) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }

  if (hasOwnField(payload, "assigneeId") || !hasOwnField(payload, "assignee")) {
    return payload;
  }

  return {
    ...payload,
    assigneeId: payload.assignee,
  };
};

const logIssuePayload = (label, payload) => {
  if (!import.meta.env.DEV) {
    return;
  }

  console.log(`[api] ${label} payload:`, payload);
};

export const loginRequest = async (payload) => {
  const response = await api.post("/auth/login", payload);
  return response.data;
};

export const adminLoginRequest = async () => {
  const response = await api.post("/auth/admin-login");
  return response.data;
};

export const registerRequest = async (payload) => {
  const response = await api.post("/auth/register", payload);
  return response.data;
};

export const changePasswordRequest = async (payload) => {
  const response = await api.post("/auth/change-password", payload);
  return response.data;
};

export const fetchUsers = async () => {
  const response = await api.get("/auth/users");
  const data = response.data;

  if (import.meta.env.DEV) {
    console.log("[api] Users response:", data);
  }

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.users)) {
    return data.users;
  }

  console.warn("[api] Unexpected users response shape:", data);
  return [];
};

export const fetchWorkspaceUsers = async (
  workspaceId = CURRENT_WORKSPACE_SCOPE
) => {
  const response = await api.get(`/workspaces/${workspaceId}/users`);
  const data = response.data;

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.users)) {
    return data.users;
  }

  console.warn("[api] Unexpected workspace users response shape:", data);
  return [];
};

export const fetchManagedUsers = async () => {
  const response = await api.get("/users");
  const data = response.data;

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.users)) {
    return data.users;
  }

  console.warn("[api] Unexpected managed users response shape:", data);
  return [];
};

export const fetchProjects = async () => {
  const response = await api.get("/projects");
  const data = response.data;

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.projects)) {
    return data.projects;
  }

  console.warn("[api] Unexpected projects response shape:", data);
  return [];
};

export const createProject = async (payload) => {
  const response = await api.post("/projects", payload);
  return response.data;
};

export const deleteProject = async (projectId) => {
  const response = await api.delete(`/projects/${projectId}`);
  return response.data;
};

export const attachProjectTeam = async ({ projectId, teamId }) => {
  const response = await api.post(`/projects/${projectId}/teams`, {
    teamId,
  });
  return response.data;
};

export const detachProjectTeam = async ({ projectId, teamId }) => {
  const response = await api.delete(`/projects/${projectId}/teams/${teamId}`);
  return response.data;
};

export const updateProjectStatus = async ({ projectId, isCompleted }) => {
  const response = await api.patch(`/projects/${projectId}/status`, {
    isCompleted,
  });
  return response.data;
};

export const fetchProjectMeetings = async ({ projectId }) => {
  const response = await api.get(`/projects/${projectId}/meetings`);
  const data = response.data;

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.meetings)) {
    return data.meetings;
  }

  console.warn("[api] Unexpected project meetings response shape:", data);
  return [];
};

export const fetchTeams = async (workspaceId = CURRENT_WORKSPACE_SCOPE) => {
  const response = await api.get("/teams", {
    params: buildParams({
      workspaceId,
    }),
  });
  const data = response.data;

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.teams)) {
    return data.teams;
  }

  console.warn("[api] Unexpected teams response shape:", data);
  return [];
};

export const fetchTeam = async (id) => {
  const response = await api.get(`/teams/${id}`);
  return response.data;
};

export const createTeam = async (payload) => {
  const response = await api.post("/teams", payload);
  return response.data;
};

export const addTeamMember = async ({ teamId, userId }) => {
  const response = await api.post(`/teams/${teamId}/members`, {
    userId,
  });
  return response.data;
};

export const removeTeamMember = async ({ teamId, userId }) => {
  const response = await api.delete(`/teams/${teamId}/members/${userId}`);
  return response.data;
};

export const fetchIssues = async (filters = {}) => {
  const params = buildParams(normalizeIssueFilters(filters));
  const response = await api.get("/issues", {
    params,
  });
  return response.data;
};

export const fetchMyIssues = async (filters = {}) => {
  const params = buildParams(normalizeIssueFilters(filters));
  const response = await api.get("/issues/my", {
    params,
  });
  return response.data;
};

export const createIssue = async (payload) => {
  const normalizedPayload = normalizeIssuePayload(payload);
  logIssuePayload("Create issue", normalizedPayload);
  const response = await api.post("/issues", normalizedPayload);
  return response.data;
};

export const updateIssue = async ({ id, payload }) => {
  const normalizedPayload = normalizeIssuePayload(payload);
  logIssuePayload("Update issue", normalizedPayload);
  const response = await api.put(`/issues/${id}`, normalizedPayload);
  return response.data;
};

export const deleteIssue = async (id) => {
  const response = await api.delete(`/issues/${id}`);
  return response.data;
};

export const fetchComments = async (issueId) => {
  const response = await api.get(`/comments/${issueId}`);
  return response.data;
};

export const createComment = async (payload) => {
  const response = await api.post("/comments", payload);
  return response.data;
};

export const fetchReports = async (filters = {}) => {
  const response = await api.get("/reports", {
    params: buildParams(normalizeIssueFilters(filters)),
  });
  return response.data;
};

export const fetchProjectReports = async (filters = {}) => {
  const response = await api.get("/reports/projects", {
    params: buildParams(normalizeIssueFilters(filters)),
  });
  return response.data;
};

export const fetchUserReports = async (filters = {}) => {
  const response = await api.get("/reports/users", {
    params: buildParams(normalizeIssueFilters(filters)),
  });
  return response.data;
};

export const fetchSelectedUserReport = async (filters = {}) => {
  const data = await fetchUserReports(filters);

  if (Array.isArray(data?.users)) {
    return data.users[0] || null;
  }

  return null;
};

export const fetchTeamReports = async (filters = {}) => {
  const response = await api.get("/reports/team", {
    params: buildParams(normalizeIssueFilters(filters)),
  });
  return response.data;
};

export const fetchSprintReports = async (filters = {}) => {
  const response = await api.get("/reports/sprints", {
    params: buildParams(filters),
  });
  return response.data;
};

export const fetchSelectedSprintReport = async (sprintId) => {
  const response = await api.get(`/reports/sprints/${sprintId}`);
  return response.data;
};

export const fetchBacklogBoard = async (filters = {}) => {
  const response = await api.get("/backlog", {
    params: buildParams(normalizeIssueFilters(filters)),
  });
  return response.data;
};

export const reorderIssuePlanning = async (payload) => {
  const response = await api.post("/backlog/reorder", payload);
  return response.data;
};

export const fetchEpics = async ({ projectId }) => {
  const response = await api.get("/epics", {
    params: buildParams({
      projectId,
    }),
  });
  return response.data;
};

export const createEpic = async (payload) => {
  const response = await api.post("/epics", payload);
  return response.data;
};

export const updateEpic = async ({ id, payload }) => {
  const response = await api.patch(`/epics/${id}`, payload);
  return response.data;
};

export const deleteEpic = async ({ id, payload = {} }) => {
  const response = await api.delete(`/epics/${id}`, {
    data: payload,
  });
  return response.data;
};

export const fetchSprints = async (filters = {}) => {
  const response = await api.get("/sprints", {
    params: buildParams(filters),
  });
  return response.data;
};

export const fetchSprintIssues = async (sprintId) => {
  const response = await api.get(`/sprints/${sprintId}/issues`);
  return response.data;
};

export const createSprint = async (payload) => {
  const response = await api.post("/sprints", payload);
  return response.data;
};

export const updateSprint = async ({ id, payload }) => {
  const response = await api.patch(`/sprints/${id}`, payload);
  return response.data;
};

export const deleteSprint = async (id) => {
  const response = await api.delete(`/sprints/${id}`);
  return response.data;
};

export const startSprint = async (id) => {
  const response = await api.post(`/sprints/${id}/start`);
  return response.data;
};

export const completeSprint = async ({ id, payload }) => {
  const response = await api.post(`/sprints/${id}/complete`, payload);
  return response.data;
};

export const updateIssuePlanning = async ({ id, payload }) => {
  const response = await api.patch(`/issues/${id}/planning`, payload);
  return response.data;
};

export const moveIssueToSprint = async ({ id, sprintId }) => {
  const response = await api.post(`/issues/${id}/sprint`, {
    sprintId,
  });
  return response.data;
};

export const removeIssueFromSprint = async (id) => {
  const response = await api.delete(`/issues/${id}/sprint`);
  return response.data;
};

export const fetchIssueAttachments = async (issueId) => {
  const response = await api.get(`/issues/${issueId}/attachments`);
  return response.data;
};

export const uploadIssueAttachment = async ({ issueId, file }) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post(`/issues/${issueId}/attachments`, formData);
  return response.data;
};

export const fetchIssueWorklogs = async (issueId) => {
  const response = await api.get(`/issues/${issueId}/worklogs`);
  return response.data;
};

export const createIssueWorklog = async ({ issueId, payload }) => {
  const response = await api.post(`/issues/${issueId}/worklogs`, payload);
  return response.data;
};

export const fetchIssueHistory = async (issueId) => {
  const response = await api.get(`/issues/${issueId}/history`);
  return response.data;
};

export const suggestIssuePriority = async ({ issueId, payload }) => {
  const response = await api.post(`/issues/${issueId}/suggest-priority`, payload);
  return response.data;
};

export const resolveApiAssetUrl = (assetPath = "") => {
  if (!assetPath) {
    return "";
  }

  if (/^https?:\/\//i.test(assetPath)) {
    return assetPath;
  }

  try {
    return new URL(assetPath, api.defaults.baseURL).toString();
  } catch (error) {
    return assetPath;
  }
};

export const inviteUser = async (payload) => {
  const response = await api.post("/users/invite", payload);
  return response.data;
};

export const updateUserRole = async ({ id, role }) => {
  const response = await api.patch(`/users/${id}/role`, {
    role,
  });
  return response.data;
};

export const fetchEmailConfig = async (userId) => {
  const response = await api.get("/settings/email-config", {
    params: buildParams({
      userId,
    }),
  });
  return response.data;
};

export const saveEmailConfig = async (payload) => {
  const response = await api.post("/settings/email-config", payload);
  return response.data;
};

export const testEmailConfig = async (payload) => {
  const response = await api.post("/settings/test-email", payload);
  return response.data;
};

export const fetchWorkspaceSender = async () => {
  const response = await api.get("/settings/workspace-sender");
  return normalizeWorkspaceSenderResponse(response.data);
};

export const saveWorkspaceSender = async (payload) => {
  const response = await api.post("/settings/workspace-sender", payload);
  return normalizeWorkspaceSenderResponse(response.data);
};

export const fetchEligibleSenders = async () => {
  const response = await api.get("/settings/eligible-senders");
  const data = response.data;

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.users)) {
    return data.users;
  }

  console.warn("[api] Unexpected eligible senders response shape:", data);
  return [];
};

export const importUsers = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  if (import.meta.env.DEV) {
    console.log("[api] Import users payload:", {
      file,
      name: file?.name || null,
      type: file?.type || null,
      size: file?.size || null,
      hasFileEntry: formData.has("file"),
    });
  }

  const response = await api.post("/users/import", formData);

  return response.data;
};

export default api;
