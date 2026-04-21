const Issue = require("../models/Issue");
const Project = require("../models/Project");
const { buildProjectAccessQuery } = require("./projectRelations");
const { normalizeWorkspaceId } = require("./workspace");

const getUserId = (user) => String(user?.id || user?._id || "");

const isAdmin = (user) => user?.role === "Admin";

const canManageProjectPlanning = (user, project) => {
  if (!user || !project) {
    return false;
  }

  if (isAdmin(user)) {
    return true;
  }

  const userId = getUserId(user);

  if (!userId) {
    return false;
  }

  return [project.createdBy, project.manager, project.teamLead].some(
    (value) => String(value || "") === userId
  );
};

const getReadableProjectIds = async (user) => {
  const workspaceId = normalizeWorkspaceId(user.workspaceId);
  const accessQuery = await buildProjectAccessQuery(user);
  const [projectIds, directlyAssignedProjectIds] = await Promise.all([
    Project.find(accessQuery).distinct("_id"),
    Issue.find({
      assignee: user._id,
    }).distinct("projectId"),
  ]);

  const additionalProjectIds = directlyAssignedProjectIds.length
    ? await Project.find({
        _id: {
          $in: directlyAssignedProjectIds,
        },
        workspaceId,
      }).distinct("_id")
    : [];
  const uniqueProjectIds = new Map();

  [...projectIds, ...additionalProjectIds].forEach((projectId) => {
    if (projectId) {
      uniqueProjectIds.set(String(projectId), projectId);
    }
  });

  return Array.from(uniqueProjectIds.values());
};

const loadReadableProject = async (user, projectId) => {
  const workspaceId = normalizeWorkspaceId(user.workspaceId);
  const directProject = await Project.findOne({
    _id: projectId,
    ...(await buildProjectAccessQuery(user)),
  });

  if (directProject) {
    return directProject;
  }

  const hasAssignedIssue = await Issue.exists({
    projectId,
    assignee: user._id,
  });

  if (!hasAssignedIssue) {
    return null;
  }

  return Project.findOne({
    _id: projectId,
    workspaceId,
  });
};

const loadReadableIssue = async (user, issueId) => {
  const issue = await Issue.findById(issueId);

  if (!issue) {
    return null;
  }

  const project = await loadReadableProject(user, issue.projectId);

  if (!project) {
    return null;
  }

  return issue;
};

const getBacklogPermissions = (user, project) => {
  const canManagePlanning = canManageProjectPlanning(user, project);

  return {
    canManagePlanning,
    canManageSprints: canManagePlanning,
    canManageEpics: canManagePlanning,
    canAssignIssues: canManagePlanning,
    canReorderIssues: canManagePlanning,
    canSuggestPriority: true,
    canComment: true,
    canUploadAttachments: true,
    canLogWork: true,
  };
};

module.exports = {
  getUserId,
  isAdmin,
  canManageProjectPlanning,
  getReadableProjectIds,
  loadReadableProject,
  loadReadableIssue,
  getBacklogPermissions,
};
