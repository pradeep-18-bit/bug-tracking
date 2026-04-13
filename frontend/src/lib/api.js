import axios from "axios";
import { readStoredSession } from "@/lib/session";
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

export const registerRequest = async (payload) => {
  const response = await api.post("/auth/register", payload);
  return response.data;
};

export const changePasswordRequest = async (payload) => {
  const response = await api.post("/auth/change-password", payload);
  return response.data;
};

export const fetchAdminCredentials = async () => {
  const response = await api.get("/auth/admin-credentials");
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
