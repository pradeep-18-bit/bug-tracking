import test from "node:test";
import assert from "node:assert/strict";

import { getProjectTeams } from "../src/lib/project-teams.js";

test("getProjectTeams falls back to attachedTeams when teams are not present", () => {
  const teams = getProjectTeams({
    attachedTeams: [
      { _id: "team-qa", name: "Q/A team" },
      { _id: "team-dev", name: "dev-1" },
    ],
  });

  assert.deepEqual(
    teams.map((team) => team.name),
    ["dev-1", "Q/A team"]
  );
});
