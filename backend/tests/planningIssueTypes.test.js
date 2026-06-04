const assert = require("node:assert/strict");
const test = require("node:test");
const {
  PLANNING_ISSUE_TYPES,
  buildPlanningIssueTypeQuery,
  isPlanningIssueType,
} = require("../utils/planningIssueTypes");

test("planning issue type allow-list includes backlog work items", () => {
  ["Task", "Story", "Feature", "Enhancement", "Epic"].forEach((type) => {
    assert.equal(isPlanningIssueType(type), true);
  });
});

test("planning issue type allow-list excludes bugs and sub-tasks", () => {
  ["Bug", "Sub-task", "", null].forEach((type) => {
    assert.equal(isPlanningIssueType(type), false);
  });
});

test("planning issue type query uses the shared allow-list", () => {
  assert.deepEqual(buildPlanningIssueTypeQuery(), {
    type: {
      $in: PLANNING_ISSUE_TYPES,
    },
  });
});
