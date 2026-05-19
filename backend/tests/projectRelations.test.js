const test = require("node:test");
const assert = require("node:assert/strict");

const { mergeProjectTeamIds } = require("../utils/projectRelations");

test("mergeProjectTeamIds returns all project-attached teams from join and project fields", () => {
  const teamIds = mergeProjectTeamIds(
    {
      attachedTeams: ["dev-team", { _id: "qa-team" }],
      teamIds: ["qa-team", "support-team"],
    },
    [
      { teamId: "qa-team" },
      { teamId: { _id: "ops-team" } },
    ]
  );

  assert.deepEqual(teamIds, [
    "qa-team",
    "ops-team",
    "dev-team",
    "support-team",
  ]);
});
