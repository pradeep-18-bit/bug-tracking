const assert = require("node:assert/strict");
const test = require("node:test");
const {
  applyActiveSprintVisibilityToIssueQuery,
} = require("../utils/sprintVisibility");

const createSprintModel = (activeSprintIds = []) => ({
  find: (query) => ({
    distinct: async (field) => {
      assert.equal(field, "_id");
      assert.equal(query.state, "ACTIVE");
      return activeSprintIds;
    },
  }),
});

test("active sprint visibility limits backlog-capable queries to active sprint ids", async () => {
  const query = {
    projectId: {
      $in: ["project-1"],
    },
  };

  await applyActiveSprintVisibilityToIssueQuery(
    query,
    createSprintModel(["sprint-active"])
  );

  assert.deepEqual(query.sprintId, {
    $in: ["sprint-active"],
  });
});

test("active sprint visibility excludes backlog and planned sprint filters", async () => {
  const backlogQuery = {
    projectId: "project-1",
    sprintId: null,
  };
  const plannedQuery = {
    projectId: "project-1",
    sprintId: "sprint-planned",
  };

  await applyActiveSprintVisibilityToIssueQuery(
    backlogQuery,
    createSprintModel(["sprint-active"])
  );
  await applyActiveSprintVisibilityToIssueQuery(
    plannedQuery,
    createSprintModel(["sprint-active"])
  );

  assert.deepEqual(backlogQuery.sprintId, {
    $in: [],
  });
  assert.deepEqual(plannedQuery.sprintId, {
    $in: [],
  });
});

test("active sprint visibility preserves an explicitly selected active sprint", async () => {
  const query = {
    projectId: "project-1",
    sprintId: "sprint-active",
  };

  await applyActiveSprintVisibilityToIssueQuery(
    query,
    createSprintModel(["sprint-active"])
  );

  assert.equal(query.sprintId, "sprint-active");
});
