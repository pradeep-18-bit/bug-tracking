import test from "node:test";
import assert from "node:assert/strict";

import {
  getWorkspaceSenderResponseState,
  normalizeWorkspaceSenderResponse,
} from "../src/lib/workspaceSender.js";

test("normalizeWorkspaceSenderResponse returns a stable fallback payload for missing data", () => {
  assert.deepEqual(normalizeWorkspaceSenderResponse(undefined), {
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

test("getWorkspaceSenderResponseState treats disabled or incomplete sender data as fallback", () => {
  const state = getWorkspaceSenderResponseState({
    workspaceSender: {
      enabled: true,
      userId: "",
      user: {
        _id: "sender-1",
        name: "Sender",
      },
    },
  });

  assert.equal(state.hasActiveSender, false);
  assert.equal(state.activeSenderId, "");
  assert.equal(state.activeSenderUser, null);
  assert.equal(state.workspaceSender.source, "global-default");
});

test("getWorkspaceSenderResponseState preserves workspace default fallback data", () => {
  const state = getWorkspaceSenderResponseState({
    workspaceSender: {
      enabled: false,
      userId: "",
      source: "workspace-default",
      workspaceDefault: {
        enabled: true,
        userId: "workspace-1",
        user: {
          _id: "workspace-1",
          name: "Workspace Sender",
        },
      },
    },
  });

  assert.equal(state.hasActiveSender, false);
  assert.equal(state.hasWorkspaceDefaultSender, true);
  assert.equal(state.workspaceDefaultSenderId, "workspace-1");
  assert.equal(state.workspaceDefaultSender?.name, "Workspace Sender");
});
