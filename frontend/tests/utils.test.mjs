import test from "node:test";
import assert from "node:assert/strict";

import { formatDate, formatDateTime } from "../src/lib/utils.js";

test("formatDate uses DD/MM/YY", () => {
  assert.equal(
    formatDate("2026-05-20T12:00:00.000Z", { timeZone: "UTC" }),
    "20/05/26"
  );
});

test("formatDateTime keeps DD/MM/YY for the date portion", () => {
  assert.equal(
    formatDateTime("2026-05-20T15:30:00.000Z", { timeZone: "UTC" }),
    "20/05/26, 3:30 pm"
  );
});
