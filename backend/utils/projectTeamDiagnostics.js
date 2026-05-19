const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

const isProjectTeamDebugEnabled = () =>
  TRUE_VALUES.has(String(process.env.TEAM_SELECTION_DEBUG || "").toLowerCase()) ||
  TRUE_VALUES.has(String(process.env.PROJECT_TEAMS_DEBUG || "").toLowerCase()) ||
  TRUE_VALUES.has(String(process.env.DEBUG_TEAM_SELECTION || "").toLowerCase());

const toId = (value) => String(value?._id || value || "");

const summarizeTeams = (teams = []) =>
  teams.map((team) => ({
    id: toId(team),
    name: team?.name || "",
    workspaceId: team?.workspaceId || "",
    memberCount: team?.memberCount || team?.members?.length || 0,
  }));

const writeProjectTeamsLog = (level, message, payload = {}) => {
  const logger =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : console.info;

  logger(`[project-teams] ${message}`, payload);
};

const logProjectTeamsDebug = (message, payload = {}) => {
  if (!isProjectTeamDebugEnabled()) {
    return;
  }

  writeProjectTeamsLog("info", message, payload);
};

const logProjectTeamsWarning = (message, payload = {}) => {
  writeProjectTeamsLog("warn", message, payload);
};

module.exports = {
  isProjectTeamDebugEnabled,
  logProjectTeamsDebug,
  logProjectTeamsWarning,
  summarizeTeams,
  toId,
};
