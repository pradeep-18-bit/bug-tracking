const mongoose = require("mongoose");

const ACTIVE_SPRINT_STATE = "ACTIVE";

const normalizeObjectIdString = (value) => String(value?._id || value || "");

const toStringSet = (values = []) =>
  new Set(values.map(normalizeObjectIdString).filter(Boolean));

const getActiveSprintIdsForProjects = async (Sprint, projectCriteria, teamId = null) => {
  const sprintQuery = {
    projectId: projectCriteria,
    state: ACTIVE_SPRINT_STATE,
  };

  if (teamId) {
    sprintQuery.$or = [{ teamId: null }, { teamId }];
  }

  return Sprint.find(sprintQuery).distinct("_id");
};

const intersectSprintFilterWithActive = (currentFilter, activeSprintIds = []) => {
  const activeIds = toStringSet(activeSprintIds);

  if (!activeIds.size) {
    return {
      $in: [],
    };
  }

  if (currentFilter === null) {
    return {
      $in: [],
    };
  }

  if (!currentFilter) {
    return {
      $in: activeSprintIds,
    };
  }

  if (typeof currentFilter === "object" && Array.isArray(currentFilter.$in)) {
    const matchingIds = currentFilter.$in.filter((sprintId) =>
      activeIds.has(normalizeObjectIdString(sprintId))
    );

    return {
      $in: matchingIds,
    };
  }

  return activeIds.has(normalizeObjectIdString(currentFilter))
    ? currentFilter
    : {
        $in: [],
      };
};

const applyActiveSprintVisibilityToIssueQuery = async (query, Sprint) => {
  const projectCriteria = query.projectId || {
    $in: [],
  };
  const activeSprintIds = await getActiveSprintIdsForProjects(
    Sprint,
    projectCriteria,
    query.teamId || null
  );

  query.sprintId = intersectSprintFilterWithActive(query.sprintId, activeSprintIds);
  return query;
};

const isIssueInActiveSprint = async (issue, Sprint) => {
  const sprintId = normalizeObjectIdString(issue?.sprintId);

  if (!sprintId || !mongoose.isValidObjectId(sprintId)) {
    return false;
  }

  const sprint = await Sprint.findOne({
    _id: sprintId,
    state: ACTIVE_SPRINT_STATE,
  })
    .select("_id")
    .lean();

  return Boolean(sprint);
};

module.exports = {
  ACTIVE_SPRINT_STATE,
  applyActiveSprintVisibilityToIssueQuery,
  isIssueInActiveSprint,
};
