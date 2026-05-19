const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

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

test("mergeProjectTeamIds handles Mongo ObjectIds without recursive _id lookup", () => {
  const devTeamId = new mongoose.Types.ObjectId();
  const qaTeamId = new mongoose.Types.ObjectId();

  const teamIds = mergeProjectTeamIds(
    {
      attachedTeams: [devTeamId],
    },
    [
      {
        teamId: qaTeamId,
      },
    ]
  );

  assert.deepEqual(teamIds, [String(qaTeamId), String(devTeamId)]);
});
