const test = require("node:test");
const assert = require("node:assert/strict");

const {
  AVAILABLE_BUG_QUEUE_STATUSES,
  buildBugVisibilityFilter,
  buildDeveloperBugQueueQuery,
} = require("../utils/bugQueueQuery");
const { ISSUE_TYPES } = require("../utils/issueTypes");

test("buildDeveloperBugQueueQuery never includes sprint filters", () => {
  const projectId = "project-1";
  const teamId = "team-1";
  const query = buildDeveloperBugQueueQuery({
    accessibleProjectIds: [projectId],
    userTeamIds: [teamId],
  });
  const queueConditions = query.$and?.[1] || query;

  assert.equal(queueConditions.type, ISSUE_TYPES.BUG);
  assert.equal(queueConditions.assignee, null);
  assert.equal(queueConditions.assignedDeveloperId, null);
  assert.equal(queueConditions["bugDetails.developerLead"], null);
  assert.deepEqual(queueConditions.status.$in, AVAILABLE_BUG_QUEUE_STATUSES);
  assert.equal(Object.prototype.hasOwnProperty.call(query, "sprintId"), false);
  assert.equal(
    Object.prototype.hasOwnProperty.call(queueConditions, "sprintId"),
    false
  );
});

test("buildBugVisibilityFilter combines project and team access", () => {
  const projectId = "project-1";
  const teamId = "team-1";
  const filter = buildBugVisibilityFilter({
    accessibleProjectIds: [projectId],
    userTeamIds: [teamId],
  });

  assert.equal(filter.$or.length, 2);
  assert.deepEqual(filter.$or[0].projectId.$in, [projectId]);
  assert.deepEqual(filter.$or[1].teamId.$in, [teamId]);
});

test("buildDeveloperBugQueueQuery returns empty access when no projects or teams", () => {
  const query = buildDeveloperBugQueueQuery({
    accessibleProjectIds: [],
    userTeamIds: [],
  });

  assert.deepEqual(query._id.$in, []);
});
