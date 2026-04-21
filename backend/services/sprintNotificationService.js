const Issue = require("../models/Issue");
const Project = require("../models/Project");
const Sprint = require("../models/Sprint");
const SprintNotification = require("../models/SprintNotification");
const User = require("../models/User");
const WorkspaceSetting = require("../models/WorkspaceSetting");
const { populateIssueDocument, populateIssueQuery, serializeIssue, serializeIssues } = require("../utils/issuePresentation");
const { getCanonicalIssueStatus, ISSUE_STATUS } = require("../utils/issueStatus");
const { enqueueSprintNotification } = require("./sprintNotificationQueue");

const normalizeEmail = (value = "") => String(value || "").trim().toLowerCase();
const normalizeObjectId = (value) => String(value?._id || value || "");

const uniqueBy = (items = [], getKey) => {
  const seen = new Set();

  return items.filter((item) => {
    const key = getKey(item);

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const uniqueStrings = (values = []) =>
  [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];

const resolveInheritedBoolean = (...values) =>
  values.find((value) => typeof value === "boolean");

const getStatusLabel = (status = ISSUE_STATUS.TODO) =>
  String(getCanonicalIssueStatus(status, ISSUE_STATUS.TODO))
    .split("_")
    .filter(Boolean)
    .map((segment) => segment.charAt(0) + segment.slice(1).toLowerCase())
    .join(" ");

const projectKeyWord = (value = "") =>
  String(value || "")
    .trim()
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() || "")
    .join("")
    .slice(0, 4) || "WORK";

const getIssueKey = (issue) => {
  const explicitKey =
    typeof issue?.issueKey === "string" ? issue.issueKey.trim() : "";

  if (explicitKey) {
    return explicitKey;
  }

  const suffix = String(issue?._id || "").slice(-5).toUpperCase();
  return suffix ? `${projectKeyWord(issue?.projectId?.name || "")}-${suffix}` : "WORK-NEW";
};

const getAppUrl = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");

const buildIssuesBoardUrl = ({ projectId, issueKey = "" }) => {
  const appUrl = getAppUrl();
  const params = new URLSearchParams();

  if (projectId) {
    params.set("projectId", String(projectId));
  }

  if (issueKey) {
    params.set("search", issueKey);
  }

  const query = params.toString();
  return `${appUrl}/issues${query ? `?${query}` : ""}`;
};

const buildBacklogBoardUrl = ({ projectId }) => {
  const appUrl = getAppUrl();
  const params = new URLSearchParams();

  if (projectId) {
    params.set("projectId", String(projectId));
  }

  const query = params.toString();
  return `${appUrl}/backlog${query ? `?${query}` : ""}`;
};

const serializeIssueForNotification = (issue) => {
  const key = getIssueKey(issue);

  return {
    id: normalizeObjectId(issue?._id),
    key,
    title: issue?.title || "Untitled work item",
    type: issue?.type || "Task",
    priority: issue?.priority || "Medium",
    status: getStatusLabel(issue?.status),
    url: buildIssuesBoardUrl({
      projectId: normalizeObjectId(issue?.projectId?._id || issue?.projectId),
      issueKey: key,
    }),
  };
};

const loadIssueWithRelations = async (issueId) => {
  const issue = await Issue.findById(issueId);

  if (!issue) {
    return null;
  }

  await populateIssueDocument(issue);
  return serializeIssue(issue);
};

const loadSprintContext = async (sprintId) => {
  const sprint = await Sprint.findById(sprintId)
    .populate("teamId", "name description workspaceId")
    .populate("createdBy", "name email role")
    .lean();

  if (!sprint) {
    return {
      sprint: null,
      project: null,
      workspaceSettings: null,
    };
  }

  const [project, workspaceSettings] = await Promise.all([
    Project.findById(sprint.projectId)
      .populate("manager", "name email role")
      .populate("teamLead", "name email role")
      .populate("createdBy", "name email role")
      .lean(),
    WorkspaceSetting.findOne({
      workspaceId: sprint.workspaceId,
    }).lean(),
  ]);

  return {
    sprint,
    project,
    workspaceSettings,
  };
};

const resolveNotificationConfig = ({ sprint, project, workspaceSettings }) => {
  const workspaceConfig = workspaceSettings?.sprintNotifications || {};
  const projectConfig = project?.notificationSettings || {};
  const sprintConfig = sprint?.notificationSettings || {};
  const enabled = resolveInheritedBoolean(
    sprintConfig.sprintNotificationsEnabled,
    projectConfig.sprintNotificationsEnabled,
    workspaceConfig.enabled,
    true
  );

  return {
    enabled: enabled !== false,
    notifySprintStartedAssignees:
      workspaceConfig.notifySprintStartedAssignees !== false,
    notifySprintStartedStakeholders:
      workspaceConfig.notifySprintStartedStakeholders !== false,
    notifyIssueAddedToActiveSprint:
      workspaceConfig.notifyIssueAddedToActiveSprint !== false,
    notifyAssigneeChangedInActiveSprint:
      workspaceConfig.notifyAssigneeChangedInActiveSprint !== false,
    stakeholderUserIds: uniqueStrings([
      ...(workspaceConfig.stakeholderUserIds || []).map(normalizeObjectId),
      ...(projectConfig.stakeholderUserIds || []).map(normalizeObjectId),
      ...(sprintConfig.stakeholderUserIds || []).map(normalizeObjectId),
      normalizeObjectId(project?.manager),
      normalizeObjectId(project?.teamLead),
      normalizeObjectId(project?.createdBy),
      normalizeObjectId(sprint?.createdBy),
    ]),
    stakeholderEmails: uniqueStrings([
      ...(workspaceConfig.stakeholderEmails || []).map(normalizeEmail),
      ...(projectConfig.stakeholderEmails || []).map(normalizeEmail),
      ...(sprintConfig.stakeholderEmails || []).map(normalizeEmail),
    ]),
    ccEmails: uniqueStrings([
      ...(workspaceConfig.ccEmails || []).map(normalizeEmail),
      ...(projectConfig.ccEmails || []).map(normalizeEmail),
      ...(sprintConfig.ccEmails || []).map(normalizeEmail),
    ]),
  };
};

const loadStakeholderRecipients = async (config, workspaceId) => {
  const stakeholderUsers = config.stakeholderUserIds.length
    ? await User.find({
        _id: {
          $in: config.stakeholderUserIds,
        },
        workspaceId,
      })
        .select("_id name email")
        .lean()
    : [];

  const userRecipients = stakeholderUsers
    .map((user) => ({
      userId: normalizeObjectId(user._id),
      name: user.name || "Stakeholder",
      email: normalizeEmail(user.email),
    }))
    .filter((recipient) => recipient.email);

  const emailRecipients = (config.stakeholderEmails || [])
    .map((email) => normalizeEmail(email))
    .filter(Boolean)
    .map((email) => ({
      userId: "",
      name: "Stakeholder",
      email,
    }));

  return uniqueBy([...userRecipients, ...emailRecipients], (recipient) =>
    recipient.userId || recipient.email
  );
};

const createNotificationRecord = async ({
  eventType,
  sprint,
  project,
  issue = null,
  recipient,
  dedupeKey,
  creatorUserId = null,
  payload,
}) => {
  if (!recipient?.email || !dedupeKey) {
    return {
      created: false,
      notification: null,
    };
  }

  let notification = null;
  let created = false;

  try {
    notification = await SprintNotification.create({
      eventType,
      sprintId: sprint._id,
      issueId: issue?._id || null,
      projectId: project._id,
      recipientUserId: recipient.userId || null,
      recipientEmail: normalizeEmail(recipient.email),
      dedupeKey,
      creatorUserId: creatorUserId || null,
      workspaceId: sprint.workspaceId,
      payload,
    });
    created = true;
    console.info("[sprint-notifications] queued notification", {
      eventType,
      sprintId: String(sprint?._id || ""),
      issueId: String(issue?._id || ""),
      recipientUserId: String(recipient?.userId || ""),
      recipientEmail: normalizeEmail(recipient?.email),
      dedupeKey,
    });
  } catch (error) {
    if (error?.code !== 11000) {
      throw error;
    }

    notification = await SprintNotification.findOne({
      dedupeKey,
    })
      .select("_id status")
      .lean();

    console.info("[sprint-notifications] dedupe hit", {
      eventType,
      sprintId: String(sprint?._id || ""),
      issueId: String(issue?._id || ""),
      recipientUserId: String(recipient?.userId || ""),
      recipientEmail: normalizeEmail(recipient?.email),
      dedupeKey,
      status: notification?.status || "",
    });
  }

  if (notification?._id && notification.status !== "sent") {
    enqueueSprintNotification(notification._id);
  }

  return {
    created,
    notification,
  };
};

const createBasePayload = ({ sprint, project, recipient, ccEmails = [] }) => ({
  recipientName: recipient?.name || "teammate",
  ccEmails,
  sprint: {
    id: normalizeObjectId(sprint?._id),
    name: sprint?.name || "Sprint",
    startDate: sprint?.startDate || null,
    endDate: sprint?.endDate || null,
    boardUrl: buildBacklogBoardUrl({
      projectId: normalizeObjectId(project?._id),
    }),
  },
  project: {
    id: normalizeObjectId(project?._id),
    name: project?.name || "Project",
    boardUrl: buildIssuesBoardUrl({
      projectId: normalizeObjectId(project?._id),
    }),
  },
});

const handleSprintStarted = async (sprintId, { actorUserId = null } = {}) => {
  const { sprint, project, workspaceSettings } = await loadSprintContext(sprintId);

  if (!sprint || !project || sprint.state !== "ACTIVE") {
    console.info("[sprint-notifications] sprint start skipped", {
      sprintId: normalizeObjectId(sprintId),
      reason: "sprint_not_active",
      sprintState: sprint?.state || "",
    });
    return {
      queued: 0,
      skipped: "sprint_not_active",
    };
  }

  const config = resolveNotificationConfig({
    sprint,
    project,
    workspaceSettings,
  });

  if (!config.enabled) {
    console.info("[sprint-notifications] sprint start skipped", {
      sprintId: normalizeObjectId(sprint._id),
      reason: "notifications_disabled",
    });
    return {
      queued: 0,
      skipped: "notifications_disabled",
    };
  }

  const issues = serializeIssues(
    await populateIssueQuery(
      Issue.find({
        sprintId: sprint._id,
      }).sort({
        planningOrder: 1,
        createdAt: 1,
      })
    )
  );
  let queued = 0;

  if (config.notifySprintStartedAssignees) {
    const assigneeGroups = issues.reduce((groups, issue) => {
      const assigneeId = normalizeObjectId(issue?.assignee);
      const assigneeEmail = normalizeEmail(issue?.assignee?.email);

      if (!assigneeId || !assigneeEmail) {
        return groups;
      }

      if (!groups.has(assigneeId)) {
        groups.set(assigneeId, {
          recipient: {
            userId: assigneeId,
            name: issue.assignee?.name || "teammate",
            email: assigneeEmail,
          },
          issues: [],
        });
      }

      groups.get(assigneeId).issues.push(serializeIssueForNotification(issue));
      return groups;
    }, new Map());

    for (const [assigneeId, entry] of assigneeGroups.entries()) {
      const payload = {
        ...createBasePayload({
          sprint,
          project,
          recipient: entry.recipient,
          ccEmails: config.ccEmails,
        }),
        issues: entry.issues,
      };
      const result = await createNotificationRecord({
        eventType: "SPRINT_STARTED_ASSIGNEE_SUMMARY",
        sprint,
        project,
        recipient: entry.recipient,
        dedupeKey: `sprint_started:${normalizeObjectId(sprint._id)}:${assigneeId}`,
        creatorUserId: actorUserId || normalizeObjectId(sprint.createdBy),
        payload,
      });

      if (result.created) {
        queued += 1;
      }
    }
  }

  if (config.notifySprintStartedStakeholders) {
    const stakeholderRecipients = await loadStakeholderRecipients(config, sprint.workspaceId);
    const groupedAssignees = Array.from(
      issues.reduce((groups, issue) => {
        const assigneeKey = normalizeObjectId(issue?.assignee) || `email:${normalizeEmail(issue?.assignee?.email || "")}` || "unassigned";
        const assigneeName = issue?.assignee?.name || "Unassigned";

        if (!groups.has(assigneeKey)) {
          groups.set(assigneeKey, {
            assigneeName,
            issueCount: 0,
            issues: [],
          });
        }

        const currentGroup = groups.get(assigneeKey);
        currentGroup.issueCount += 1;
        currentGroup.issues.push(serializeIssueForNotification(issue));
        return groups;
      }, new Map()).values()
    );

    for (const recipient of stakeholderRecipients) {
      const payload = {
        ...createBasePayload({
          sprint,
          project,
          recipient,
          ccEmails: config.ccEmails,
        }),
        summary: {
          totalIssues: issues.length,
          assignedIssues: issues.filter((issue) => normalizeObjectId(issue?.assignee)).length,
          unassignedIssues: issues.filter((issue) => !normalizeObjectId(issue?.assignee)).length,
        },
        assigneeSummaries: groupedAssignees,
      };
      const result = await createNotificationRecord({
        eventType: "SPRINT_STARTED_STAKEHOLDER_SUMMARY",
        sprint,
        project,
        recipient,
        dedupeKey: `sprint_started_summary:${normalizeObjectId(sprint._id)}:${
          recipient.userId || recipient.email
        }`,
        creatorUserId: actorUserId || normalizeObjectId(sprint.createdBy),
        payload,
      });

      if (result.created) {
        queued += 1;
      }
    }
  }

  return {
    queued,
  };
};

const queueIssueNotification = async ({
  eventType,
  issue,
  sprint,
  project,
  recipient,
  dedupeKey,
  creatorUserId = null,
  ccEmails = [],
}) =>
  createNotificationRecord({
    eventType,
    sprint,
    project,
    issue,
    recipient,
    dedupeKey,
    creatorUserId,
    payload: {
      ...createBasePayload({
        sprint,
        project,
        recipient,
        ccEmails,
      }),
      issue: serializeIssueForNotification(issue),
    },
  });

const handleIssueAddedToActiveSprint = async (
  issueId,
  sprintId,
  { actorUserId = null } = {}
) => {
  const issue = await loadIssueWithRelations(issueId);

  if (!issue) {
    console.info("[sprint-notifications] issue-added skipped", {
      issueId: normalizeObjectId(issueId),
      sprintId: normalizeObjectId(sprintId),
      reason: "issue_not_found",
    });
    return {
      queued: 0,
      skipped: "issue_not_found",
    };
  }

  const { sprint, project, workspaceSettings } = await loadSprintContext(
    sprintId || issue?.sprintId?._id || issue?.sprintId
  );

  if (!sprint || !project || sprint.state !== "ACTIVE") {
    console.info("[sprint-notifications] issue-added skipped", {
      issueId: normalizeObjectId(issueId),
      sprintId: normalizeObjectId(sprintId || issue?.sprintId),
      reason: "sprint_not_active",
      sprintState: sprint?.state || "",
    });
    return {
      queued: 0,
      skipped: "sprint_not_active",
    };
  }

  const assigneeEmail = normalizeEmail(issue?.assignee?.email);
  const assigneeId = normalizeObjectId(issue?.assignee);

  if (!assigneeEmail || !assigneeId) {
    console.info("[sprint-notifications] issue-added skipped", {
      issueId: normalizeObjectId(issueId),
      sprintId: normalizeObjectId(sprint._id),
      reason: "issue_unassigned",
    });
    return {
      queued: 0,
      skipped: "issue_unassigned",
    };
  }

  const config = resolveNotificationConfig({
    sprint,
    project,
    workspaceSettings,
  });

  if (!config.enabled || !config.notifyIssueAddedToActiveSprint) {
    console.info("[sprint-notifications] issue-added skipped", {
      issueId: normalizeObjectId(issueId),
      sprintId: normalizeObjectId(sprint._id),
      reason: "notifications_disabled",
    });
    return {
      queued: 0,
      skipped: "notifications_disabled",
    };
  }

  const result = await queueIssueNotification({
    eventType: "ISSUE_ADDED_TO_ACTIVE_SPRINT",
    issue,
    sprint,
    project,
    recipient: {
      userId: assigneeId,
      name: issue.assignee?.name || "teammate",
      email: assigneeEmail,
    },
    dedupeKey: `issue_added_to_active_sprint:${normalizeObjectId(sprint._id)}:${normalizeObjectId(
      issue._id
    )}:${assigneeId}`,
    creatorUserId: actorUserId || normalizeObjectId(issue.reporter),
    ccEmails: config.ccEmails,
  });

  return {
    queued: result.created ? 1 : 0,
  };
};

const handleAssigneeChangedInActiveSprint = async (
  issueId,
  sprintId,
  assigneeId,
  { actorUserId = null } = {}
) => {
  const issue = await loadIssueWithRelations(issueId);

  if (!issue) {
    console.info("[sprint-notifications] assignee-change skipped", {
      issueId: normalizeObjectId(issueId),
      sprintId: normalizeObjectId(sprintId),
      reason: "issue_not_found",
    });
    return {
      queued: 0,
      skipped: "issue_not_found",
    };
  }

  const currentAssigneeId = normalizeObjectId(assigneeId || issue?.assignee);
  const assigneeEmail = normalizeEmail(issue?.assignee?.email);

  if (!currentAssigneeId || !assigneeEmail) {
    console.info("[sprint-notifications] assignee-change skipped", {
      issueId: normalizeObjectId(issueId),
      sprintId: normalizeObjectId(sprintId),
      reason: "issue_unassigned",
    });
    return {
      queued: 0,
      skipped: "issue_unassigned",
    };
  }

  const { sprint, project, workspaceSettings } = await loadSprintContext(
    sprintId || issue?.sprintId?._id || issue?.sprintId
  );

  if (!sprint || !project || sprint.state !== "ACTIVE") {
    console.info("[sprint-notifications] assignee-change skipped", {
      issueId: normalizeObjectId(issueId),
      sprintId: normalizeObjectId(sprintId || issue?.sprintId),
      reason: "sprint_not_active",
      sprintState: sprint?.state || "",
    });
    return {
      queued: 0,
      skipped: "sprint_not_active",
    };
  }

  const config = resolveNotificationConfig({
    sprint,
    project,
    workspaceSettings,
  });

  if (!config.enabled || !config.notifyAssigneeChangedInActiveSprint) {
    console.info("[sprint-notifications] assignee-change skipped", {
      issueId: normalizeObjectId(issueId),
      sprintId: normalizeObjectId(sprint._id),
      reason: "notifications_disabled",
    });
    return {
      queued: 0,
      skipped: "notifications_disabled",
    };
  }

  const result = await queueIssueNotification({
    eventType: "ASSIGNEE_CHANGED_IN_ACTIVE_SPRINT",
    issue,
    sprint,
    project,
    recipient: {
      userId: currentAssigneeId,
      name: issue.assignee?.name || "teammate",
      email: assigneeEmail,
    },
    dedupeKey: `assignee_changed_in_active_sprint:${normalizeObjectId(
      sprint._id
    )}:${normalizeObjectId(issue._id)}:${currentAssigneeId}`,
    creatorUserId: actorUserId || normalizeObjectId(issue.reporter),
    ccEmails: config.ccEmails,
  });

  return {
    queued: result.created ? 1 : 0,
  };
};

const scheduleIssueStateNotifications = async ({
  issueId,
  previousSprintId = null,
  previousAssigneeId = null,
  actorUserId = null,
}) => {
  const issue = await loadIssueWithRelations(issueId);

  if (!issue) {
    return {
      queued: 0,
      skipped: "issue_not_found",
    };
  }

  const currentSprintId = normalizeObjectId(issue?.sprintId);
  const currentAssigneeId = normalizeObjectId(issue?.assignee);
  const sprintChanged = normalizeObjectId(previousSprintId) !== currentSprintId;
  const assigneeChanged = normalizeObjectId(previousAssigneeId) !== currentAssigneeId;

  if (sprintChanged && currentSprintId) {
    console.info("[sprint-notifications] state change detected", {
      issueId: normalizeObjectId(issueId),
      previousSprintId: normalizeObjectId(previousSprintId),
      currentSprintId,
      previousAssigneeId: normalizeObjectId(previousAssigneeId),
      currentAssigneeId,
      trigger: "issue_added_to_active_sprint",
    });
    return handleIssueAddedToActiveSprint(issueId, currentSprintId, {
      actorUserId,
    });
  }

  if (assigneeChanged && currentSprintId) {
    console.info("[sprint-notifications] state change detected", {
      issueId: normalizeObjectId(issueId),
      previousSprintId: normalizeObjectId(previousSprintId),
      currentSprintId,
      previousAssigneeId: normalizeObjectId(previousAssigneeId),
      currentAssigneeId,
      trigger: "assignee_changed_in_active_sprint",
    });
    return handleAssigneeChangedInActiveSprint(issueId, currentSprintId, currentAssigneeId, {
      actorUserId,
    });
  }

  console.info("[sprint-notifications] state change skipped", {
    issueId: normalizeObjectId(issueId),
    previousSprintId: normalizeObjectId(previousSprintId),
    currentSprintId,
    previousAssigneeId: normalizeObjectId(previousAssigneeId),
    currentAssigneeId,
    reason: "no_relevant_change",
  });
  return {
    queued: 0,
    skipped: "no_relevant_change",
  };
};

module.exports = {
  handleSprintStarted,
  handleIssueAddedToActiveSprint,
  handleAssigneeChangedInActiveSprint,
  scheduleIssueStateNotifications,
};
