const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DEFAULT_GLOBAL_FALLBACK_NOTE,
  buildEffectiveSenderSelection,
  buildWorkspaceSenderResponse,
  getWorkspaceSenderState,
} = require("../utils/workspaceSender");

test("getWorkspaceSenderState handles missing settings", () => {
  assert.deepEqual(getWorkspaceSenderState(undefined), {
    workspaceSender: null,
    workspaceSenderUserId: "",
    hasWorkspaceSender: false,
  });
});

test("getWorkspaceSenderState handles missing workspaceSender", () => {
  assert.deepEqual(getWorkspaceSenderState({}), {
    workspaceSender: null,
    workspaceSenderUserId: "",
    hasWorkspaceSender: false,
  });
});

test("getWorkspaceSenderState handles enabled sender without userId", () => {
  assert.deepEqual(
    getWorkspaceSenderState({
      workspaceSender: {
        enabled: true,
      },
    }),
    {
      workspaceSender: {
        enabled: true,
      },
      workspaceSenderUserId: "",
      hasWorkspaceSender: false,
    }
  );
});

test("getWorkspaceSenderState handles disabled sender safely", () => {
  assert.deepEqual(
    getWorkspaceSenderState({
      workspaceSender: {
        enabled: false,
        userId: "sender-123",
      },
    }),
    {
      workspaceSender: {
        enabled: false,
        userId: "sender-123",
      },
      workspaceSenderUserId: "sender-123",
      hasWorkspaceSender: false,
    }
  );
});

test("buildEffectiveSenderSelection prefers manual sender first", () => {
  const selection = buildEffectiveSenderSelection({
    manualSelection: {
      enabled: true,
      userId: "manual-1",
      user: { _id: "manual-1", name: "Manual Sender" },
    },
    workspaceDefault: {
      enabled: true,
      userId: "workspace-1",
      user: { _id: "workspace-1", name: "Workspace Sender" },
    },
  });

  assert.equal(selection.source, "manual");
  assert.equal(selection.userId, "manual-1");
  assert.equal(selection.manualSelection.userId, "manual-1");
  assert.equal(selection.workspaceDefault.userId, "workspace-1");
});

test("buildEffectiveSenderSelection falls back to workspace default", () => {
  const selection = buildEffectiveSenderSelection({
    manualSelection: {
      enabled: false,
      userId: "",
      user: null,
      note: "Manual sender unavailable.",
    },
    workspaceDefault: {
      enabled: true,
      userId: "workspace-1",
      user: { _id: "workspace-1", name: "Workspace Sender" },
    },
  });

  assert.equal(selection.source, "workspace-default");
  assert.equal(selection.userId, "workspace-1");
  assert.match(selection.note, /Manual sender unavailable/);
});

test("buildEffectiveSenderSelection falls back to global sender", () => {
  const selection = buildEffectiveSenderSelection({
    manualSelection: {
      enabled: false,
      userId: "",
      note: "Manual sender unavailable.",
    },
    workspaceDefault: {
      enabled: false,
      userId: "",
      note: "Workspace default sender unavailable.",
    },
  });

  assert.equal(selection.source, "global-default");
  assert.equal(selection.enabled, false);
  assert.equal(selection.userId, "");
  assert.match(selection.note, /Manual sender unavailable/);
  assert.match(selection.note, /Workspace default sender unavailable/);
});

test("buildEffectiveSenderSelection uses default fallback note when no sender exists", () => {
  const selection = buildEffectiveSenderSelection();

  assert.equal(selection.source, "global-default");
  assert.equal(selection.note, DEFAULT_GLOBAL_FALLBACK_NOTE);
});

test("buildWorkspaceSenderResponse stays stable without sender data", () => {
  const response = buildWorkspaceSenderResponse();

  assert.deepEqual(response, {
    message: "",
    enabled: false,
    userId: "",
    user: null,
    source: "global-default",
    manualSelection: {
      enabled: false,
      userId: "",
      user: null,
    },
    workspaceDefault: {
      enabled: false,
      userId: "",
      user: null,
    },
    note: "",
    workspaceSender: {
      enabled: false,
      userId: "",
      user: null,
      source: "global-default",
      manualSelection: {
        enabled: false,
        userId: "",
        user: null,
      },
      workspaceDefault: {
        enabled: false,
        userId: "",
        user: null,
      },
      note: "",
    },
  });
});
