const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildDisplayId,
  deriveProjectShortCode,
  normalizeShortCode,
} = require("../utils/displayIds");

test("deriveProjectShortCode uses readable project initials", () => {
  assert.equal(deriveProjectShortCode("Employee Management System"), "EMS");
  assert.equal(deriveProjectShortCode("Content Management System"), "CMS");
  assert.equal(deriveProjectShortCode("HRM"), "HRM");
});

test("buildDisplayId formats padded per-project sequences", () => {
  assert.equal(buildDisplayId("ems", 1), "EMS-001");
  assert.equal(buildDisplayId("CMS", 12), "CMS-012");
  assert.equal(buildDisplayId("HRM", 143), "HRM-143");
});

test("normalizeShortCode strips unsafe characters", () => {
  assert.equal(normalizeShortCode(" ems / qa "), "EMSQA");
});
