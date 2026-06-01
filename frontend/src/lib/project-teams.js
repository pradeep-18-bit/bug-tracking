const normalizeLabel = (value = "") => value.trim().toLowerCase();

export const resolveProjectId = (project) =>
  String(project?._id || project || "");

export const resolveTeamId = (team) => String(team?._id || team || "");

export const resolveUserId = (user) => String(user?._id || user?.id || user || "");

export const sortByName = (items = []) =>
  [...items].sort((left, right) =>
    normalizeLabel(left?.name || "").localeCompare(normalizeLabel(right?.name || ""))
  );

export const findProjectById = (projects = [], projectId = "") =>
  projects.find((project) => resolveProjectId(project) === String(projectId)) || null;

export const getProjectTeams = (project) => {
  if (Array.isArray(project?.teams) && project.teams.length) {
    return sortByName(project.teams);
  }

  if (Array.isArray(project?.attachedTeams) && project.attachedTeams.length) {
    return sortByName(project.attachedTeams);
  }

  return sortByName(project?.teamIds || []);
};

export const getProjectMembers = (project) => {
  const uniqueMembers = new Map();

  (project?.members || []).forEach((member) => {
    const memberId = resolveUserId(member);

    if (!memberId || uniqueMembers.has(memberId)) {
      return;
    }

    uniqueMembers.set(memberId, member);
  });

  return sortByName(Array.from(uniqueMembers.values()));
};

export const findProjectTeamById = (project, teamId = "") =>
  getProjectTeams(project).find((team) => resolveTeamId(team) === String(teamId)) || null;

export const getProjectTeamMembers = (project, teamId = "") => {
  const team = findProjectTeamById(project, teamId);

  if (!team?.members?.length) {
    return [];
  }

  const uniqueMembers = new Map();

  team.members.forEach((member) => {
    const memberId = resolveUserId(member);

    if (!memberId || uniqueMembers.has(memberId)) {
      return;
    }

    uniqueMembers.set(memberId, member);
  });

  return sortByName(Array.from(uniqueMembers.values()));
};
