const ProjectTeam = require("../models/ProjectTeam");
const Team = require("../models/Team");
const TeamMember = require("../models/TeamMember");
const { hasAdminAccess } = require("./roles");
const { attachMembersToTeams, sanitizeUser } = require("./teamRelations");
const { normalizeWorkspaceId } = require("./workspace");

const toPlainObject = (value) =>
  typeof value?.toObject === "function" ? value.toObject() : value;

const sanitizeProjectUser = (value) => sanitizeUser(value) || null;

const buildEffectiveMembers = (teams = []) => {
  const members = [];
  const seenIds = new Set();

  const pushMember = (member) => {
    const sanitizedMember = sanitizeUser(member) || member;
    const userId = String(sanitizedMember?._id || member?._id || member || "");

    if (!userId || seenIds.has(userId)) {
      return;
    }

    seenIds.add(userId);
    members.push(sanitizedMember);
  };

  teams.forEach((team) => (team.members || []).forEach(pushMember));

  return members.filter(Boolean);
};

const attachTeamsToProjects = async (projects = []) => {
  if (!projects.length) {
    return [];
  }

  const normalizedProjects = projects.map(toPlainObject);
  const projectIds = normalizedProjects.map((project) => project._id);
  const workspaceIds = Array.from(
    new Set(normalizedProjects.map((project) => normalizeWorkspaceId(project.workspaceId)))
  );

  const projectTeams = await ProjectTeam.find({
    projectId: {
      $in: projectIds,
    },
  })
    .sort({ createdAt: 1 })
    .lean();

  if (!projectTeams.length) {
    return normalizedProjects.map((project) => ({
      ...project,
      teams: [],
    }));
  }

  const attachedTeamIds = Array.from(
    new Set(projectTeams.map((projectTeam) => String(projectTeam.teamId)))
  );
  const teams = await Team.find({
    _id: {
      $in: attachedTeamIds,
    },
    workspaceId: {
      $in: workspaceIds,
    },
  }).lean();
  const serializedTeams = await attachMembersToTeams(teams);
  const teamsById = new Map(
    serializedTeams.map((team) => [String(team._id), team])
  );
  const teamsByProjectId = new Map(
    projectIds.map((projectId) => [String(projectId), []])
  );

  projectTeams.forEach((projectTeam) => {
    const team = teamsById.get(String(projectTeam.teamId));

    if (!team) {
      return;
    }

    teamsByProjectId.get(String(projectTeam.projectId))?.push(team);
  });

  return normalizedProjects.map((project) => ({
    ...project,
    teams: teamsByProjectId.get(String(project._id)) || [],
  }));
};

const serializeProjectsWithRelations = async (projects = []) => {
  const projectsWithTeams = await attachTeamsToProjects(projects);

  return projectsWithTeams.map((project) => {
    const { members: _legacyMembers, ...projectWithoutLegacyMembers } = project;
    const effectiveMembers = buildEffectiveMembers(project.teams || []);

    return {
      ...projectWithoutLegacyMembers,
      workspaceId: normalizeWorkspaceId(project.workspaceId),
      createdBy: sanitizeUser(project.createdBy),
      manager: sanitizeProjectUser(project.manager),
      teamLead: sanitizeProjectUser(project.teamLead),
      epics: Array.isArray(project.epics)
        ? project.epics
            .map((epic) => (typeof epic === "string" ? epic.trim() : ""))
            .filter(Boolean)
        : [],
      teams: (project.teams || []).map((team) => ({
        ...team,
        workspaceId: normalizeWorkspaceId(team.workspaceId),
      })),
      teamCount: project.teams?.length || 0,
      members: effectiveMembers,
      memberCount: effectiveMembers.length,
    };
  });
};

const getWorkspaceTeamIdsForUser = async (userId, workspaceId) => {
  const memberTeamIds = await TeamMember.find({
    userId,
  }).distinct("teamId");

  if (!memberTeamIds.length) {
    return [];
  }

  return Team.find({
    _id: {
      $in: memberTeamIds,
    },
    workspaceId: normalizeWorkspaceId(workspaceId),
  }).distinct("_id");
};

const getProjectIdsForTeamIds = async (teamIds = []) => {
  if (!teamIds.length) {
    return [];
  }

  return ProjectTeam.find({
    teamId: {
      $in: teamIds,
    },
  }).distinct("projectId");
};

const getProjectIdsForUserThroughTeams = async (userId, workspaceId) =>
  getProjectIdsForTeamIds(await getWorkspaceTeamIdsForUser(userId, workspaceId));

const buildProjectAccessQuery = async (user) => {
  const workspaceId = normalizeWorkspaceId(user.workspaceId);

  if (hasAdminAccess(user.role)) {
    return { workspaceId };
  }

  const userId = user.id || user._id;
  const teamProjectIds = await getProjectIdsForUserThroughTeams(userId, workspaceId);
  const accessConditions = [{ createdBy: userId }];

  if (teamProjectIds.length) {
    accessConditions.push({
      _id: {
        $in: teamProjectIds,
      },
    });
  }

  return {
    workspaceId,
    $or: accessConditions,
  };
};

const loadSerializedProjectById = async (ProjectModel, target, populateProject) => {
  const project =
    typeof target === "string" || target?._bsontype === "ObjectId"
      ? await populateProject(ProjectModel.findById(target)).lean()
      : target;

  if (!project) {
    return null;
  }

  const [serializedProject] = await serializeProjectsWithRelations([project]);
  return serializedProject || null;
};

module.exports = {
  serializeProjectsWithRelations,
  buildProjectAccessQuery,
  getProjectIdsForUserThroughTeams,
  loadSerializedProjectById,
};
