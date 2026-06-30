import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateBugMetrics,
  calculateDeveloperPerformance,
  calculateTaskMetrics,
  splitWorkItems,
} from "../src/lib/enterprise-report-metrics.js";

const tasks = [
  { type: "TASK", status: "DONE", storyPoints: 5, createdAt: "2026-01-01", startedAt: "2026-01-02", closedAt: "2026-01-04", assignee: { _id: "d1", name: "Dev" } },
  { type: "STORY", status: "TODO", storyPoints: 3, assignee: { _id: "d1", name: "Dev" } },
];
const bugs = [
  { type: "BUG", status: "CLOSED", createdAt: "2026-01-01", startedAt: "2026-01-02", closedAt: "2026-01-03", reopenedCount: 0, developerLead: { _id: "d1", name: "Dev" } },
  { type: "BUG", status: "REOPEN", createdAt: "2026-01-01", startedAt: "2026-01-02", reopenedCount: 1, developerLead: { _id: "d1", name: "Dev" } },
];

test("task and bug work stays separated", () => {
  const split = splitWorkItems([...tasks, ...bugs]);
  assert.equal(split.tasks.length, 2);
  assert.equal(split.bugs.length, 2);
  assert.equal(calculateTaskMetrics(split.tasks).completionRate, 50);
  assert.equal(calculateBugMetrics(split.bugs, 5).defectDensity, 40);
});

test("developer score includes delivery and quality dimensions", () => {
  const [developer] = calculateDeveloperPerformance(tasks, bugs);
  assert.equal(developer.name, "Dev");
  assert.equal(Object.keys(developer.dimensions).length, 12);
  assert.ok(developer.score >= 0 && developer.score <= 100);
  assert.ok(developer.rating >= 1 && developer.rating <= 5);
});
