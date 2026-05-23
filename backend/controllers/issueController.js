const mongoose = require("mongoose");
const Comment = require("../models/Comment");
const Epic = require("../models/Epic");
const Issue = require("../models/Issue");
const IssueHistory = require("../models/IssueHistory");
const Project = require("../models/Project");
const ProjectTeam = require("../models/ProjectTeam");
const Sprint = require("../models/Sprint");
const Team = require("../models/Team");
const TeamMember = require("../models/TeamMember");
const User = require("../models/User");
const {
  TESTER_SMTP_REQUIRED_MESSAGE,
  ensureUserSmtpConfigured,
  sendBugAssignmentEmail,
  sendIssueEmail,
} = require("../services/emailService");
const { scheduleIssueStateNotifications } = require("../services/sprintNotificationService");
const asyncHandler = require("../utils/asyncHandler");
const { recordIssueHistory } = require("../utils/issueHistory");
const {
  populateIssueDocument,
  populateIssueQuery,
  serializeIssue,
  serializeIssues,
} = require("../utils/issuePresentation");
const {
  ISSUE_STATUS,
  ISSUE_STATUS_VALUES,
  GENERIC_ISSUE_STATUS_VALUES,
  getCanonicalIssueStatus,
  isClosedIssueStatus,
  isInProgressIssueStatus,
  normalizeIssueStatus,
} = require("../utils/issueStatus");
const {
  ISSUE_TYPES,
  ISSUE_TYPE_VALUES,
  getCanonicalIssueType,
  isValidIssueType,
} = require("../utils/issueTypes");
const { getNextPlanningOrder } = require("../utils/planningOrder");
const { canManageProjectPlanning } = require("../utils/backlogAccess");
const {
  buildProjectAccessQuery,
  getProjectIdsForUserThroughTeams,
  mergeProjectTeamIds,
} = require("../utils/projectRelations");
const {
  ROLE_ADMIN,
  ROLE_MANAGER,
  ROLE_DEVELOPER,
  ROLE_TESTER,
  hasAdminAccess,
} = require("../utils/roles");
const { normalizeWorkspaceId } = require("../utils/workspace");
const { getNextIssueDisplayId } = require("../utils/displayIds");
const { logProjectTeamsDebug } = require("../utils/projectTeamDiagnostics");
const {
  BUG_ALLOWED_TRANSITIONS,
  BUG_PRIORITY_VALUES,
  BUG_SEVERITY_VALUES,
  BUG_STATUS,
  BUG_STATUS_VALUES,
  BUG_TERMINAL_STATUS_VALUES,
  normalizeBugPriority,
  normalizeBugSeverity,
} = require("../utils/bugLifecycle");

const isAdmin = (user) => hasAdminAccess(user?.role);
const isBugType = (type) => getCanonicalIssueType(type, "") === ISSUE_TYPES.BUG;
const isGenericIssueStatus = (status) =>
  GENERIC_ISSUE_STATUS_VALUES.includes(normalizeIssueStatus(status));
const isBugLifecycleStatus = (status) =>
  BUG_STATUS_VALUES.includes(normalizeIssueStatus(status));
const isQaRole = (role) => role === ROLE_TESTER;
const isDevRole = (role) => role === ROLE_DEVELOPER;
const isLeadRole = (role) => [ROLE_ADMIN, ROLE_MANAGER].includes(role);
const ISSUE_PRIORITY_VALUES = ["Critical", "High", "Medium", "Low"];
const HIGH_PRIORITY_VALUES = ["Critical", "High"];
const CRITICAL_SEVERITIES = ["Blocker", "Critical"];
const CLOSED_FILTER_STATUSES = Array.from(
  new Set([
    ISSUE_STATUS.DONE,
    ISSUE_STATUS.FIXED,
    ...BUG_TERMINAL_STATUS_VALUES,
  ])
);
const OPEN_FILTER_STATUSES = ISSUE_STATUS_VALUES.filter(
  (status) => !CLOSED_FILTER_STATUSES.includes(status)
);
const escapeRegExp = (value = "") =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isAssignedToUser = (issue, userId) =>
  Boolean(issue?.assignee) && String(issue.assignee) === String(userId);

const hasBugQaOwnership = (issue, userId) => {
  if (!issue || !userId || !isBugType(issue.type)) {
    return false;
  }

  return [issue.reporter, issue.bugDetails?.testerOwner].some(
    (value) => value && String(value) === String(userId)
  );
};

const getPersonalIssueAccessConditions = (user) => [
  { assignee: user._id },
  { reporter: user._id },
  { "bugDetails.testerOwner": user._id },
  { "bugDetails.developerLead": user._id },
];

const addPersonalIssueAccessQuery = (query, user) => {
  const personalAccessQuery = {
    $or: getPersonalIssueAccessConditions(user),
  };

  if (query.$or) {
    query.$and = [...(query.$and || []), { $or: query.$or }, personalAccessQuery];
    delete query.$or;
    return query;
  }

  query.$or = personalAccessQuery.$or;
  return query;
};

const addAndCondition = (query, condition) => {
  if (!condition || !Object.keys(condition).length) {
    return query;
  }

  query.$and = [...(query.$and || []), condition];
  return query;
};

const buildHighPriorityCondition = () => ({
  $or: [
    {
      priority: {
        $in: HIGH_PRIORITY_VALUES,
      },
    },
    {
      "bugDetails.severity": {
        $in: CRITICAL_SEVERITIES,
      },
    },
  ],
});

const getAccessibleProjectIds = async (user) => {
  const workspaceId = normalizeWorkspaceId(user.workspaceId);

  if (hasAdminAccess(user?.role)) {
    return Project.find({
      workspaceId,
    }).distinct("_id");
  }

  const userId = user.id || user._id;
  const teamProjectIds = await getProjectIdsForUserThroughTeams(userId, workspaceId);
  const projectAccessQuery = {
    workspaceId,
    $or: [
      { createdBy: userId },
      { manager: userId },
      { projectManager: userId },
      { teamLead: userId },
      { qaLead: userId },
      ...(teamProjectIds.length
        ? [
            {
              _id: {
                $in: teamProjectIds,
              },
            },
          ]
        : []),
    ],
  };

  const [memberProjectIds, directlyAssignedProjectIds] = await Promise.all([
    Project.find(projectAccessQuery).distinct("_id"),
    Issue.find({
      $or: [
        { assignee: user._id },
        { reporter: user._id },
        { "bugDetails.testerOwner": user._id },
        { "bugDetails.developerLead": user._id },
      ],
    }).distinct("projectId"),
  ]);

  const assignedProjectIds = directlyAssignedProjectIds.length
    ? await Project.find({
        _id: {
          $in: directlyAssignedProjectIds,
        },
        workspaceId,
      }).distinct("_id")
    : [];

  const uniqueProjectIds = new Map();

  [...memberProjectIds, ...assignedProjectIds].forEach((projectId) => {
    if (projectId) {
      uniqueProjectIds.set(String(projectId), projectId);
    }
  });

  return Array.from(uniqueProjectIds.values());
};

const loadAccessibleProject = async (user, projectId) =>
  Project.findOne({
    _id: projectId,
    ...(await buildProjectAccessQuery(user)),
  });

const ensureAssigneeExists = async (assigneeId, workspaceId) => {
  const assignee = await User.findOne({
    _id: assigneeId,
    workspaceId: normalizeWorkspaceId(workspaceId),
  })
    .select("_id name email role workspaceId")
    .lean();

  if (!assignee) {
    return null;
  }

  return assignee;
};

const hasOwnField = (payload, field) =>
  Object.prototype.hasOwnProperty.call(payload || {}, field);

const resolveAssigneeInput = (payload = {}) =>
  hasOwnField(payload, "assigneeId") ? payload.assigneeId : payload.assignee;

const hasAssigneeInput = (payload = {}) =>
  hasOwnField(payload, "assigneeId") || hasOwnField(payload, "assignee");

const resolveAssigneeFilterInput = (payload = {}) => {
  if (hasOwnField(payload, "assignedTo")) {
    return payload.assignedTo;
  }

  if (hasOwnField(payload, "assigneeId")) {
    return payload.assigneeId;
  }

  if (hasOwnField(payload, "assignee")) {
    return payload.assignee;
  }

  return undefined;
};

const buildIssueCreatedEmailPayload = (issue) => ({
  _id: String(issue._id),
  displayBugId: issue.displayBugId || "",
  title: issue.title,
  description: issue.description || "",
  projectName: issue.projectId?.name || "Unknown project",
  assigneeName: issue.assignee?.name || "Unassigned",
  priority: issue.priority || "Medium",
  status: getCanonicalIssueStatus(issue.status, ISSUE_STATUS.TODO),
  createdAt: issue.createdAt,
  dueDate: issue.dueAt || null,
});

const getIssueNotificationEmails = (issue) =>
  [
    issue?.assignee?.email || null,
    // If we want to notify the reporter later, add issue?.reporter?.email here.
  ]
    .map((email) => (email ? String(email).trim().toLowerCase() : null))
    .filter(Boolean)
    .filter((email, index, emails) => emails.indexOf(email) === index);

const normalizeNotificationEmail = (email) =>
  email ? String(email).trim().toLowerCase() : "";

const getUserIdString = (user) => String(user?._id || user?.id || user || "");

const resolveBugDeveloperUser = (issue) => {
  const developerLead = issue?.bugDetails?.developerLead;

  if (developerLead && typeof developerLead === "object") {
    return developerLead;
  }

  if (issue?.assignee && typeof issue.assignee === "object") {
    return issue.assignee;
  }

  return null;
};

const getBugDeveloperEmail = (issue) =>
  normalizeNotificationEmail(resolveBugDeveloperUser(issue)?.email);

const hasBugDeveloperAssignment = (issue) =>
  Boolean(getUserIdString(issue?.bugDetails?.developerLead));

const buildBugAssignmentEmailPayload = (issue, actorUser) => {
  const developerUser = resolveBugDeveloperUser(issue);

  return {
    _id: String(issue._id),
    displayBugId: issue.displayBugId || "",
    title: issue.title,
    description: issue.description || "N/A",
    projectName: issue.projectId?.name || "Unknown project",
    severity: issue.bugDetails?.severity || "N/A",
    priority: issue.priority || "N/A",
    assigneeName:
      developerUser?.name || developerUser?.email || "Assigned developer",
    assignedByName:
      actorUser?.name || actorUser?.email || "Tester",
    assignedByEmail: actorUser?.email || "",
    createdAt: issue.createdAt,
  };
};

const logBugAssignmentEmailEvent = (level, payload = {}) => {
  const logger =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : console.info;

  logger("[issues] Bug assignment email", {
    bugId: payload.bugId || "",
    senderUserId: payload.senderUserId || "",
    senderEmail: payload.senderEmail || "",
    receiverDeveloperEmail: payload.receiverDeveloperEmail || "",
    smtpProvider: payload.smtpProvider || "",
    sendStatus: payload.sendStatus || "",
    ...(payload.message ? { message: payload.message } : {}),
    ...(payload.senderSource ? { senderSource: payload.senderSource } : {}),
  });
};

const ensureTesterBugAssignmentSmtpConfigured = async ({
  user,
  workspaceId,
  receiverDeveloperEmail = "",
}) => {
  const senderUserId = getUserIdString(user);
  const senderEmail = user?.email || "";

  try {
    const senderConfig = await ensureUserSmtpConfigured({
      userId: senderUserId,
      workspaceId,
      sourceLabel: "Tester personal sender",
      message: TESTER_SMTP_REQUIRED_MESSAGE,
    });

    logBugAssignmentEmailEvent("info", {
      bugId: "pending",
      senderUserId,
      senderEmail,
      receiverDeveloperEmail,
      smtpProvider: senderConfig.config?.host || "",
      sendStatus: "ready",
    });

    return senderConfig;
  } catch (error) {
    logBugAssignmentEmailEvent("warn", {
      bugId: "pending",
      senderUserId,
      senderEmail,
      receiverDeveloperEmail,
      smtpProvider: "",
      sendStatus: "blocked",
      message: error.fallbackReason || error.message,
    });

    throw error;
  }
};

const sendBugAssignmentNotification = async ({
  issue,
  actorUser,
  workspaceId,
  strictTesterSender = false,
}) => {
  const receiverDeveloperEmail = getBugDeveloperEmail(issue);
  const senderUserId = getUserIdString(actorUser);
  const senderEmail = actorUser?.email || "";
  const bugId = String(issue?.displayBugId || issue?._id || "");

  if (!receiverDeveloperEmail) {
    logBugAssignmentEmailEvent("info", {
      bugId,
      senderUserId,
      senderEmail,
      receiverDeveloperEmail: "",
      smtpProvider: "",
      sendStatus: "skipped",
      message: "Assigned developer email is missing.",
    });

    return {
      type: "bug_assignment",
      status: "skipped",
      reason: "missing_developer_email",
    };
  }

  try {
    const emailResult = await sendBugAssignmentEmail(
      [receiverDeveloperEmail],
      buildBugAssignmentEmailPayload(issue, actorUser),
      {
        creatorUserId: senderUserId,
        senderUserId,
        strictSenderUserId: strictTesterSender ? senderUserId : null,
        workspaceId,
      }
    );

    logBugAssignmentEmailEvent("info", {
      bugId,
      senderUserId,
      senderEmail,
      receiverDeveloperEmail,
      smtpProvider: emailResult?.smtpProvider || "",
      sendStatus: "sent",
      senderSource: emailResult?.senderSource || "",
    });

    return {
      type: "bug_assignment",
      status: "sent",
      receiverDeveloperEmail,
      senderEmail,
      senderSource: emailResult?.senderSource || "",
      smtpProvider: emailResult?.smtpProvider || "",
    };
  } catch (error) {
    logBugAssignmentEmailEvent("error", {
      bugId,
      senderUserId,
      senderEmail,
      receiverDeveloperEmail,
      smtpProvider: error.smtpProvider || "",
      sendStatus: "failed",
      senderSource: error.senderSource || "",
      message: error.message,
    });

    return {
      type: "bug_assignment",
      status: "failed",
      receiverDeveloperEmail,
      senderEmail,
      message: error.message,
    };
  }
};

const logIssuePayloadReceipt = (action, req) => {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.log(`[issues] ${action} payload received`, {
    userId: req.user?.id || null,
    issueId: req.params?.id || null,
    projectId: req.body?.projectId ?? null,
    teamId: req.body?.teamId ?? null,
    assigneeId: hasOwnField(req.body, "assigneeId") ? req.body.assigneeId : null,
    dueAt: hasOwnField(req.body, "dueAt") ? req.body.dueAt : null,
    dependsOnIssueId: hasOwnField(req.body, "dependsOnIssueId")
      ? req.body.dependsOnIssueId
      : null,
    legacyAssignee: hasOwnField(req.body, "assignee") ? req.body.assignee : null,
  });
};

const parseOptionalDateInput = (value, label) => {
  if (value === null || value === "" || typeof value === "undefined") {
    return {
      value: null,
    };
  }

  const parsedValue = new Date(value);

  if (Number.isNaN(parsedValue.getTime())) {
    return {
      error: {
        status: 400,
        message: `Invalid ${label}`,
      },
    };
  }

  return {
    value: parsedValue,
  };
};

const parseIssueStatusInput = (value, fallback = ISSUE_STATUS.TODO) => {
  if (value === null || value === "" || typeof value === "undefined") {
    return {
      value: fallback ? getCanonicalIssueStatus(fallback, ISSUE_STATUS.TODO) : fallback,
    };
  }

  const normalizedStatus = normalizeIssueStatus(value);

  if (!ISSUE_STATUS_VALUES.includes(normalizedStatus)) {
    return {
      error: {
        status: 400,
        message: `Status must be ${ISSUE_STATUS_VALUES.join(", ")}`,
      },
    };
  }

  return {
    value: normalizedStatus,
  };
};

const toTrimmedString = (value) =>
  typeof value === "string" ? value.trim() : value ? String(value).trim() : "";

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const hasNestedBugField = (payload = {}, field) =>
  isPlainObject(payload.bugDetails) && hasOwnField(payload.bugDetails, field);

const hasBugPayloadField = (payload = {}, field, aliases = []) =>
  hasOwnField(payload, field) ||
  hasNestedBugField(payload, field) ||
  aliases.some((alias) => hasOwnField(payload, alias) || hasNestedBugField(payload, alias));

const getBugPayloadValue = (payload = {}, field, aliases = []) => {
  if (hasOwnField(payload, field)) {
    return payload[field];
  }

  if (hasNestedBugField(payload, field)) {
    return payload.bugDetails[field];
  }

  for (const alias of aliases) {
    if (hasOwnField(payload, alias)) {
      return payload[alias];
    }

    if (hasNestedBugField(payload, alias)) {
      return payload.bugDetails[alias];
    }
  }

  return undefined;
};

const resolveObjectIdValue = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === "object" && value._id) {
    return value._id;
  }

  return value;
};

const serializeBugDetails = (details = {}) => ({
  severity: details?.severity || null,
  testerOwner: resolveObjectIdValue(details?.testerOwner),
  developerLead: resolveObjectIdValue(details?.developerLead),
  stepsToReproduce: details?.stepsToReproduce || "",
  expectedResult: details?.expectedResult || "",
  actualResult: details?.actualResult || "",
  reopenReason: details?.reopenReason || "",
  rejectionReason: details?.rejectionReason || "",
  targetRelease: details?.targetRelease || "",
});

const buildBugDetailsDraft = (payload = {}, existingDetails = {}, defaults = {}) => {
  const nextDetails = {
    ...serializeBugDetails(existingDetails),
    ...defaults,
  };

  const severityInput = getBugPayloadValue(payload, "severity");

  if (typeof severityInput !== "undefined") {
    nextDetails.severity = normalizeBugSeverity(severityInput, severityInput);
  }

  [
    "stepsToReproduce",
    "expectedResult",
    "actualResult",
    "reopenReason",
    "rejectionReason",
  ].forEach((field) => {
    const value = getBugPayloadValue(payload, field);

    if (typeof value !== "undefined") {
      nextDetails[field] = toTrimmedString(value);
    }
  });

  const targetReleaseInput = getBugPayloadValue(payload, "targetRelease", [
    "futureRelease",
  ]);

  if (typeof targetReleaseInput !== "undefined") {
    nextDetails.targetRelease = toTrimmedString(targetReleaseInput);
  }

  const testerOwnerInput = getBugPayloadValue(payload, "testerOwnerId", [
    "testerOwner",
    "qaOwnerId",
    "qaOwner",
  ]);

  if (typeof testerOwnerInput !== "undefined") {
    nextDetails.testerOwner = testerOwnerInput || null;
  }

  const developerLeadInput = getBugPayloadValue(payload, "developerLeadId", [
    "developerLead",
    "devLeadId",
    "devLead",
  ]);

  if (typeof developerLeadInput !== "undefined") {
    nextDetails.developerLead = developerLeadInput || null;
  }

  return nextDetails;
};

const getBugStatusForIssueStatus = (status) => {
  const normalizedStatus = normalizeIssueStatus(status, "");

  if (BUG_STATUS_VALUES.includes(normalizedStatus)) {
    return normalizedStatus;
  }

  if (normalizedStatus === ISSUE_STATUS.IN_PROGRESS || normalizedStatus === ISSUE_STATUS.BLOCKED) {
    return BUG_STATUS.ASSIGNED;
  }

  if (normalizedStatus === ISSUE_STATUS.REVIEW || normalizedStatus === ISSUE_STATUS.QA) {
    return BUG_STATUS.FIXED;
  }

  if (normalizedStatus === ISSUE_STATUS.DONE) {
    return BUG_STATUS.CLOSED;
  }

  return BUG_STATUS.NEW;
};

const getRequestedBugStatus = ({ payload = {}, currentStatus = BUG_STATUS.NEW }) => {
  if (!hasOwnField(payload, "status")) {
    return getBugStatusForIssueStatus(currentStatus);
  }

  const normalizedStatus = normalizeIssueStatus(payload.status, "");

  if (BUG_STATUS_VALUES.includes(normalizedStatus)) {
    return normalizedStatus;
  }

  if (normalizedStatus === ISSUE_STATUS.TODO) {
    return BUG_STATUS.NEW;
  }

  if (normalizedStatus === ISSUE_STATUS.IN_PROGRESS) {
    const currentBugStatus = getBugStatusForIssueStatus(currentStatus);

    return currentBugStatus === BUG_STATUS.NEW ? BUG_STATUS.OPEN : BUG_STATUS.ASSIGNED;
  }

  if (normalizedStatus === ISSUE_STATUS.DONE) {
    return BUG_STATUS.CLOSED;
  }

  return normalizedStatus;
};

const validateBugDetails = ({ bugDetails, priority }) => {
  if (!BUG_SEVERITY_VALUES.includes(bugDetails?.severity)) {
    return "Severity is required for Bug type";
  }

  if (!BUG_PRIORITY_VALUES.includes(normalizeBugPriority(priority, ""))) {
    return "Priority is required for Bug type";
  }

  if (!toTrimmedString(bugDetails?.stepsToReproduce)) {
    return "Steps to Reproduce are required for Bug type";
  }

  if (!toTrimmedString(bugDetails?.expectedResult)) {
    return "Expected Result is required for Bug type";
  }

  if (!toTrimmedString(bugDetails?.actualResult)) {
    return "Actual Result is required for Bug type";
  }

  return "";
};

const getBugTransitionReason = (payload = {}, status) => {
  if (status === BUG_STATUS.REOPEN) {
    return toTrimmedString(
      getBugPayloadValue(payload, "reopenReason", ["statusChangeComment", "comment"])
    );
  }

  if (status === BUG_STATUS.REJECTED) {
    return toTrimmedString(
      getBugPayloadValue(payload, "rejectionReason", ["statusChangeComment", "comment"])
    );
  }

  return toTrimmedString(getBugPayloadValue(payload, "statusChangeComment", ["comment"]));
};

const validateBugTransition = ({ user, fromStatus, toStatus, payload }) => {
  if (fromStatus === toStatus) {
    return "";
  }

  const allowedTargets = BUG_ALLOWED_TRANSITIONS[fromStatus] || [];

  if (!allowedTargets.includes(toStatus)) {
    return `Bug status cannot move from ${fromStatus} to ${toStatus}`;
  }

  if (toStatus === BUG_STATUS.CLOSED && fromStatus !== BUG_STATUS.FIXED) {
    return "Bug cannot be Closed unless it was previously Fixed";
  }

  if (toStatus === BUG_STATUS.REOPEN && !getBugTransitionReason(payload, toStatus)) {
    return "Reopen requires a reason or comment";
  }

  if (toStatus === BUG_STATUS.REJECTED && !getBugTransitionReason(payload, toStatus)) {
    return "Rejected requires a rejection reason";
  }

  if (
    toStatus === BUG_STATUS.DEFERRED &&
    !toTrimmedString(getBugPayloadValue(payload, "targetRelease", ["futureRelease"]))
  ) {
    return "Deferred requires a target future release";
  }

  if (isLeadRole(user?.role)) {
    return "";
  }

  if (isQaRole(user?.role)) {
    return [BUG_STATUS.CLOSED, BUG_STATUS.REOPEN].includes(toStatus)
      ? ""
      : "QA users can only Close or Reopen Fixed bugs";
  }

  if (isDevRole(user?.role)) {
    return [
      BUG_STATUS.OPEN,
      BUG_STATUS.ASSIGNED,
      BUG_STATUS.FIXED,
      BUG_STATUS.REJECTED,
      BUG_STATUS.DEFERRED,
    ].includes(toStatus)
      ? ""
      : "Developer users can only move bugs to Open, Assigned, Fixed, Rejected, or Deferred";
  }

  return "Your role cannot change this bug status";
};

const ensureIssueTeamForProject = async ({
  projectId,
  teamId,
  workspaceId,
  requireTeam = false,
}) => {
  if (!teamId) {
    if (requireTeam) {
      return {
        error: {
          status: 400,
          message: "Issue team is required",
        },
      };
    }

    return {
      team: null,
    };
  }

  if (!mongoose.isValidObjectId(teamId)) {
    return {
      error: {
        status: 400,
        message: "Invalid team id",
      },
    };
  }

  const [team, projectTeamLink, project] = await Promise.all([
    Team.findOne({
      _id: teamId,
      workspaceId: normalizeWorkspaceId(workspaceId),
    })
      .select("_id name workspaceId")
      .lean(),
    ProjectTeam.findOne({
      projectId,
      teamId,
    })
      .select("_id teamId")
      .lean(),
    Project.findById(projectId)
      .select("_id attachedTeams teamIds")
      .lean(),
  ]);

  if (!team) {
    return {
      error: {
        status: 404,
        message: "Selected team could not be found in this workspace",
      },
    };
  }

  const attachedTeamIds = mergeProjectTeamIds(
    project || { _id: projectId },
    projectTeamLink ? [projectTeamLink] : []
  );

  if (!attachedTeamIds.some((attachedTeamId) => String(attachedTeamId) === String(teamId))) {
    return {
      error: {
        status: 400,
        message: "Selected team is not attached to this project",
      },
    };
  }

  return {
    team,
  };
};

const ensureAssigneeBelongsToTeam = async ({
  assigneeId,
  teamId,
  workspaceId,
}) => {
  if (!assigneeId) {
    return {
      assignee: null,
    };
  }

  if (!teamId) {
    return {
      error: {
        status: 400,
        message: "Select a team before assigning this issue",
      },
    };
  }

  if (!mongoose.isValidObjectId(assigneeId)) {
    return {
      error: {
        status: 400,
        message: "Invalid assignee id",
      },
    };
  }

  const assignee = await ensureAssigneeExists(
    assigneeId,
    normalizeWorkspaceId(workspaceId)
  );

  if (!assignee) {
    return {
      error: {
        status: 400,
        message: "Selected assignee could not be found",
      },
    };
  }

  const teamMembership = await TeamMember.findOne({
    teamId,
    userId: assigneeId,
  })
    .select("_id")
    .lean();

  if (!teamMembership) {
    return {
      error: {
        status: 400,
        message: "Selected assignee is not a member of the selected team",
      },
    };
  }

  return {
    assignee,
  };
};

const ensureBugOwnerBelongsToTeam = async ({
  userId,
  teamId,
  workspaceId,
  label,
}) => {
  if (!userId) {
    return {
      user: null,
    };
  }

  const result = await ensureAssigneeBelongsToTeam({
    assigneeId: userId,
    teamId,
    workspaceId,
  });

  if (result.error) {
    return {
      error: {
        status: result.error.status,
        message: result.error.message.replace("assignee", label),
      },
    };
  }

  return {
    user: result.assignee,
  };
};

const ensureBugOwnerInWorkspace = async ({ userId, workspaceId, label }) => {
  if (!userId) {
    return {
      user: null,
    };
  }

  if (!mongoose.isValidObjectId(userId)) {
    return {
      error: {
        status: 400,
        message: `Invalid ${label} id`,
      },
    };
  }

  const user = await ensureAssigneeExists(
    userId,
    normalizeWorkspaceId(workspaceId)
  );

  if (!user) {
    return {
      error: {
        status: 400,
        message: `${label} could not be found in this workspace`,
      },
    };
  }

  return {
    user,
  };
};

const ensureDependencyIssueForProject = async ({
  dependsOnIssueId,
  projectId,
  issueId,
}) => {
  if (!dependsOnIssueId) {
    return {
      dependencyIssue: null,
    };
  }

  if (!projectId) {
    return {
      error: {
        status: 400,
        message: "Select a project before adding an issue dependency",
      },
    };
  }

  if (!mongoose.isValidObjectId(dependsOnIssueId)) {
    return {
      error: {
        status: 400,
        message: "Invalid dependency issue id",
      },
    };
  }

  if (issueId && String(dependsOnIssueId) === String(issueId)) {
    return {
      error: {
        status: 400,
        message: "An issue cannot depend on itself",
      },
    };
  }

  const dependencyIssue = await Issue.findById(dependsOnIssueId)
    .select("_id title status dueAt projectId")
    .lean();

  if (!dependencyIssue) {
    return {
      error: {
        status: 404,
        message: "Selected dependency issue could not be found",
      },
    };
  }

  if (String(dependencyIssue.projectId) !== String(projectId)) {
    return {
      error: {
        status: 400,
        message: "Dependency issues must belong to the selected project",
      },
    };
  }

  return {
    dependencyIssue,
  };
};

const ensureEpicForProject = async ({ epicId, projectId, requireActive = false }) => {
  if (!epicId) {
    return {
      epic: null,
    };
  }

  if (!mongoose.isValidObjectId(epicId)) {
    return {
      error: {
        status: 400,
        message: "Invalid epic id",
      },
    };
  }

  const query = {
    _id: epicId,
    projectId,
  };

  if (requireActive) {
    query.status = "ACTIVE";
  }

  const epic = await Epic.findOne(query)
    .select("_id name status")
    .lean();

  if (!epic) {
    return {
      error: {
        status: 404,
        message: "Selected epic could not be found in this project",
      },
    };
  }

  return {
    epic,
  };
};

const ensureSprintForIssue = async ({ sprintId, projectId, teamId }) => {
  if (!sprintId) {
    return {
      sprint: null,
    };
  }

  if (!mongoose.isValidObjectId(sprintId)) {
    return {
      error: {
        status: 400,
        message: "Invalid sprint id",
      },
    };
  }

  const sprint = await Sprint.findOne({
    _id: sprintId,
    projectId,
  })
    .select("_id name teamId state")
    .lean();

  if (!sprint) {
    return {
      error: {
        status: 404,
        message: "Selected sprint could not be found in this project",
      },
    };
  }

  if (sprint.state === "COMPLETED") {
    return {
      error: {
        status: 400,
        message: "Completed sprints cannot receive new issues",
      },
    };
  }

  if (sprint.teamId && String(sprint.teamId) !== String(teamId || "")) {
    return {
      error: {
        status: 400,
        message: "This issue team does not match the selected sprint scope",
      },
    };
  }

  return {
    sprint,
  };
};

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const parseDateFilterInput = (value, label, { endOfDay = false } = {}) => {
  if (value === null || value === "" || typeof value === "undefined") {
    return {
      value: null,
    };
  }

  const parsedValue = new Date(value);

  if (Number.isNaN(parsedValue.getTime())) {
    return {
      error: {
        status: 400,
        message: `Invalid ${label}`,
      },
    };
  }

  if (typeof value === "string" && DATE_ONLY_PATTERN.test(value.trim())) {
    if (endOfDay) {
      parsedValue.setHours(23, 59, 59, 999);
    } else {
      parsedValue.setHours(0, 0, 0, 0);
    }
  }

  return {
    value: parsedValue,
  };
};

const parsePositiveInteger = (value, fallback, { max = 100 } = {}) => {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return fallback;
  }

  return Math.min(parsedValue, max);
};

const getIssueSortOptions = (sortBy = "") => {
  const normalizedSort = String(sortBy || "newest").trim().toLowerCase();

  if (normalizedSort === "oldest") {
    return { createdAt: 1 };
  }

  if (normalizedSort === "updated" || normalizedSort === "recently-updated") {
    return { updatedAt: -1, createdAt: -1 };
  }

  if (normalizedSort === "priority") {
    return { priority: 1, updatedAt: -1, createdAt: -1 };
  }

  return { createdAt: -1 };
};

const applyListOptions = (queryBuilder, req) => {
  const page = parsePositiveInteger(req.query.page, 1, { max: 10000 });
  const limit = parsePositiveInteger(req.query.limit, 0, { max: 100 });
  const sortedQuery = queryBuilder.sort(getIssueSortOptions(req.query.sortBy));

  if (!limit) {
    return sortedQuery;
  }

  return sortedQuery.skip((page - 1) * limit).limit(limit);
};

const buildIssueQueryFromRequest = async (
  req,
  res,
  { forceOwnAssignee = false } = {}
) => {
  const accessibleProjectIds = await getAccessibleProjectIds(req.user);
  const query = {
    projectId: {
      $in: accessibleProjectIds,
    },
  };

  if (req.query.projectId && req.query.projectId !== "all") {
    if (!mongoose.isValidObjectId(req.query.projectId)) {
      res.status(400);
      throw new Error("Invalid project id filter");
    }

    const hasProjectAccess = accessibleProjectIds.some(
      (projectId) => String(projectId) === String(req.query.projectId)
    );

    if (!hasProjectAccess) {
      res.status(403);
      throw new Error("You do not have access to that project");
    }

    query.projectId = req.query.projectId;
  }

  if (req.query.statusGroup && req.query.statusGroup !== "all") {
    const statusGroup = String(req.query.statusGroup).trim().toLowerCase();

    if (statusGroup === "open") {
      query.status = {
        $in: OPEN_FILTER_STATUSES,
      };
    } else if (statusGroup === "closed") {
      query.status = {
        $in: CLOSED_FILTER_STATUSES,
      };
    } else {
      res.status(400);
      throw new Error("Invalid status group filter");
    }
  }

  if (req.query.status && req.query.status !== "all") {
    const statusFilterResult = parseIssueStatusInput(req.query.status, "");

    if (statusFilterResult.error) {
      res.status(statusFilterResult.error.status);
      throw new Error(statusFilterResult.error.message);
    }

    query.status = statusFilterResult.value;
  }

  if (req.query.priorityGroup && req.query.priorityGroup !== "all") {
    const priorityGroup = String(req.query.priorityGroup).trim().toLowerCase();

    if (priorityGroup !== "high") {
      res.status(400);
      throw new Error("Invalid priority group filter");
    }

    addAndCondition(query, buildHighPriorityCondition());
  }

  if (req.query.priority && req.query.priority !== "all") {
    if (!ISSUE_PRIORITY_VALUES.includes(req.query.priority)) {
      res.status(400);
      throw new Error(`Priority must be ${ISSUE_PRIORITY_VALUES.join(", ")}`);
    }

    query.priority = req.query.priority;
  }

  if (req.query.type && req.query.type !== "all") {
    const normalizedType = getCanonicalIssueType(req.query.type, "");

    if (!isValidIssueType(normalizedType)) {
      res.status(400);
      throw new Error(`Type must be ${ISSUE_TYPE_VALUES.join(", ")}`);
    }

    query.type = normalizedType;
  }

  if (req.query.excludeType && req.query.excludeType !== "all") {
    const normalizedExcludedType = getCanonicalIssueType(req.query.excludeType, "");

    if (!isValidIssueType(normalizedExcludedType)) {
      res.status(400);
      throw new Error(`Excluded type must be ${ISSUE_TYPE_VALUES.join(", ")}`);
    }

    if (query.type) {
      if (query.type === normalizedExcludedType) {
        query._id = {
          $in: [],
        };
      }
    } else {
      query.type = {
        $ne: normalizedExcludedType,
      };
    }
  }

  if (req.query.teamId && req.query.teamId !== "all") {
    if (!mongoose.isValidObjectId(req.query.teamId)) {
      res.status(400);
      throw new Error("Invalid team id filter");
    }

    query.teamId = req.query.teamId;
  }

  if (req.query.epicId && req.query.epicId !== "all") {
    if (req.query.epicId === "unassigned") {
      query.epicId = null;
    } else {
      if (!mongoose.isValidObjectId(req.query.epicId)) {
        res.status(400);
        throw new Error("Invalid epic id filter");
      }

      query.epicId = req.query.epicId;
    }
  }

  if (req.query.sprintId && req.query.sprintId !== "all") {
    if (req.query.sprintId === "backlog") {
      query.sprintId = null;
    } else {
      if (!mongoose.isValidObjectId(req.query.sprintId)) {
        res.status(400);
        throw new Error("Invalid sprint id filter");
      }

      query.sprintId = req.query.sprintId;
    }
  }

  if (req.query.sprintState && req.query.sprintState !== "all") {
    const sprintState = String(req.query.sprintState).trim().toUpperCase();

    if (!["PLANNED", "ACTIVE", "COMPLETED"].includes(sprintState)) {
      res.status(400);
      throw new Error("Invalid sprint state filter");
    }

    const sprintQuery = {
      projectId:
        typeof query.projectId === "object" && query.projectId.$in
          ? { $in: query.projectId.$in }
          : query.projectId,
      state: sprintState,
    };

    if (query.teamId) {
      sprintQuery.teamId = query.teamId;
    }

    const sprintIds = await Sprint.find(sprintQuery).distinct("_id");
    query.sprintId = sprintIds.length
      ? {
          $in: sprintIds,
        }
      : {
          $in: [],
        };
  }

  if (req.query.search?.trim()) {
    const searchExpression = new RegExp(
      escapeRegExp(req.query.search.trim()),
      "i"
    );

    addAndCondition(query, {
      $or: [
        { displayBugId: searchExpression },
        { title: searchExpression },
        { description: searchExpression },
      ],
    });
  }

  if (
    (req.query.dateFrom && req.query.dateFrom !== "all") ||
    (req.query.dateTo && req.query.dateTo !== "all")
  ) {
    const dateFromResult = parseDateFilterInput(
      req.query.dateFrom,
      "start date"
    );
    const dateToResult = parseDateFilterInput(req.query.dateTo, "end date", {
      endOfDay: true,
    });

    if (dateFromResult.error) {
      res.status(dateFromResult.error.status);
      throw new Error(dateFromResult.error.message);
    }

    if (dateToResult.error) {
      res.status(dateToResult.error.status);
      throw new Error(dateToResult.error.message);
    }

    if (
      dateFromResult.value &&
      dateToResult.value &&
      dateFromResult.value > dateToResult.value
    ) {
      res.status(400);
      throw new Error("Start date must be before the end date");
    }

    query.createdAt = {};

    if (dateFromResult.value) {
      query.createdAt.$gte = dateFromResult.value;
    }

    if (dateToResult.value) {
      query.createdAt.$lte = dateToResult.value;
    }
  }

  if (forceOwnAssignee) {
    addPersonalIssueAccessQuery(query, req.user);
    return query;
  }

  const assigneeFilter = resolveAssigneeFilterInput(req.query);

  if (
    typeof assigneeFilter !== "undefined" &&
    assigneeFilter !== null &&
    assigneeFilter !== "" &&
    assigneeFilter !== "all"
  ) {
    if (String(assigneeFilter).toLowerCase() === "me") {
      query.assignee = req.user.id;
      return query;
    }

    if (!mongoose.isValidObjectId(assigneeFilter)) {
      res.status(400);
      throw new Error("Invalid assignee filter");
    }

    if (!isAdmin(req.user) && String(assigneeFilter) !== String(req.user.id)) {
      res.status(403);
      throw new Error("You can only view issues assigned to you");
    }

    query.assignee = assigneeFilter;
  } else if (!isAdmin(req.user)) {
    addPersonalIssueAccessQuery(query, req.user);
  }

  return query;
};

const getIssues = asyncHandler(async (req, res) => {
  const query = await buildIssueQueryFromRequest(req, res);
  const issues = await applyListOptions(populateIssueQuery(Issue.find(query)), req);

  res.status(200).json(serializeIssues(issues));
});

const getMyIssues = asyncHandler(async (req, res) => {
  if (isAdmin(req.user)) {
    res.status(403);
    throw new Error("Admins and managers do not have access to personal task views");
  }

  const query = await buildIssueQueryFromRequest(req, res, {
    forceOwnAssignee: true,
  });
  const issues = await applyListOptions(populateIssueQuery(Issue.find(query)), req);

  res.status(200).json(serializeIssues(issues));
});

const serializeActivityEntry = (entry) => {
  const issue = entry.issueId && typeof entry.issueId === "object" ? entry.issueId : null;
  const actor = entry.actorId && typeof entry.actorId === "object" ? entry.actorId : null;

  return {
    _id: entry._id,
    eventType: entry.eventType,
    field: entry.field,
    fromValue: entry.fromValue,
    toValue: entry.toValue,
    meta: entry.meta || {},
    createdAt: entry.createdAt,
    actor: actor
      ? {
          _id: actor._id,
          name: actor.name,
          role: actor.role,
        }
      : null,
    issue: issue
      ? {
          _id: issue._id,
          issueKey: issue.issueKey,
          displayBugId: issue.displayBugId,
          title: issue.title,
          type: issue.type,
          status: issue.status,
          priority: issue.priority,
          severity: issue.bugDetails?.severity || "",
          project: issue.projectId,
          team: issue.teamId,
          assignee: issue.assignee,
          reporter: issue.reporter,
          createdAt: issue.createdAt,
          updatedAt: issue.updatedAt,
        }
      : null,
  };
};

const getRecentIssueActivity = asyncHandler(async (req, res) => {
  const query = await buildIssueQueryFromRequest(req, res);
  const limit = parsePositiveInteger(req.query.limit, 12, { max: 50 });
  const issueIds = await Issue.find(query).distinct("_id");

  if (!issueIds.length) {
    res.status(200).json([]);
    return;
  }

  const activity = await IssueHistory.find({
    issueId: {
      $in: issueIds,
    },
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate({
      path: "issueId",
      select:
        "_id issueKey displayBugId title type status priority projectId teamId assignee reporter bugDetails createdAt updatedAt",
      populate: [
        { path: "projectId", select: "name" },
        { path: "teamId", select: "name" },
        { path: "assignee", select: "name email role" },
        { path: "reporter", select: "name email role" },
      ],
    })
    .populate("actorId", "name role")
    .lean();

  res.status(200).json(activity.map(serializeActivityEntry));
});

const statusLabelMap = {
  [ISSUE_STATUS.TODO]: "To Do",
  [ISSUE_STATUS.IN_PROGRESS]: "In Progress",
  [ISSUE_STATUS.BLOCKED]: "Blocked",
  [ISSUE_STATUS.REVIEW]: "Review",
  [ISSUE_STATUS.QA]: "QA",
  [ISSUE_STATUS.DONE]: "Done",
  [ISSUE_STATUS.NEW]: "New",
  [ISSUE_STATUS.OPEN]: "Open",
  [ISSUE_STATUS.ASSIGNED]: "Assigned",
  [ISSUE_STATUS.FIXED]: "Fixed",
  [ISSUE_STATUS.CLOSED]: "Closed",
  [ISSUE_STATUS.REOPEN]: "Reopen",
  [ISSUE_STATUS.REJECTED]: "Rejected",
  [ISSUE_STATUS.DEFERRED]: "Deferred",
};

const priorityOrder = ISSUE_PRIORITY_VALUES;
const statusOrder = [
  ISSUE_STATUS.TODO,
  ISSUE_STATUS.IN_PROGRESS,
  ISSUE_STATUS.BLOCKED,
  ISSUE_STATUS.REVIEW,
  ISSUE_STATUS.QA,
  ISSUE_STATUS.DONE,
  ISSUE_STATUS.NEW,
  ISSUE_STATUS.OPEN,
  ISSUE_STATUS.ASSIGNED,
  ISSUE_STATUS.FIXED,
  ISSUE_STATUS.CLOSED,
  ISSUE_STATUS.REOPEN,
  ISSUE_STATUS.REJECTED,
  ISSUE_STATUS.DEFERRED,
];

const uniqueObjectIds = (values = []) => {
  const uniqueIds = new Map();

  values.filter(Boolean).forEach((value) => {
    uniqueIds.set(String(value), value);
  });

  return Array.from(uniqueIds.values());
};

const getNormalizedReportIssues = (issues = []) =>
  issues.map((issue) => ({
    ...issue,
    status: getCanonicalIssueStatus(issue.status, ISSUE_STATUS.TODO),
  }));

const createStatusCountMap = (issues = []) =>
  issues.reduce((map, issue) => {
    const status = getCanonicalIssueStatus(issue.status, ISSUE_STATUS.TODO);
    map.set(status, (map.get(status) || 0) + 1);
    return map;
  }, new Map());

const createPriorityCountMap = (issues = []) =>
  issues.reduce((map, issue) => {
    if (!issue.priority) {
      return map;
    }

    map.set(issue.priority, (map.get(issue.priority) || 0) + 1);
    return map;
  }, new Map());

const buildSummaryMetrics = (issues = []) =>
  issues.reduce(
    (summary, issue) => {
      const status = getCanonicalIssueStatus(issue.status, ISSUE_STATUS.TODO);

      summary.totalIssues += 1;

      if (isClosedIssueStatus(status)) {
        summary.closedIssues += 1;
      } else {
        summary.openIssues += 1;
      }

      if (isInProgressIssueStatus(status)) {
        summary.inProgressIssues += 1;
      }

      return summary;
    },
    {
      totalIssues: 0,
      openIssues: 0,
      inProgressIssues: 0,
      closedIssues: 0,
    }
  );

const createEntityBucket = (base = {}) => ({
  total: 0,
  open: 0,
  inProgress: 0,
  closed: 0,
  completionRate: 0,
  ...base,
});

const incrementEntityBucket = (bucket, issue) => {
  const status = getCanonicalIssueStatus(issue.status, ISSUE_STATUS.TODO);

  bucket.total += 1;

  if (isClosedIssueStatus(status)) {
    bucket.closed += 1;
  } else {
    bucket.open += 1;
  }

  if (isInProgressIssueStatus(status)) {
    bucket.inProgress += 1;
  }

  bucket.completionRate = bucket.total
    ? Math.round((bucket.closed / bucket.total) * 100)
    : 0;
};

const sortEntityBuckets = (left, right) =>
  right.total - left.total ||
  right.closed - left.closed ||
  right.inProgress - left.inProgress ||
  left.name.localeCompare(right.name);

const loadReportIssues = async (query) =>
  getNormalizedReportIssues(
    await Issue.find(query)
      .select("status priority projectId teamId assignee createdAt")
      .lean()
  );

const buildProjectReportBuckets = async (issues, workspaceId) => {
  const projectIds = uniqueObjectIds(issues.map((issue) => issue.projectId));

  if (!projectIds.length) {
    return [];
  }

  const projects = await Project.find({
    _id: {
      $in: projectIds,
    },
    workspaceId: normalizeWorkspaceId(workspaceId),
  })
    .select("name isCompleted workspaceId")
    .lean();
  const projectsById = new Map(
    projects.map((project) => [String(project._id), project])
  );
  const bucketsById = new Map();

  issues.forEach((issue) => {
    if (!issue.projectId) {
      return;
    }

    const projectId = String(issue.projectId);
    const project = projectsById.get(projectId);

    if (!project) {
      return;
    }

    const bucket =
      bucketsById.get(projectId) ||
      createEntityBucket({
        projectId,
        name: project.name,
        isCompleted: Boolean(project.isCompleted),
      });

    incrementEntityBucket(bucket, issue);
    bucketsById.set(projectId, bucket);
  });

  return Array.from(bucketsById.values()).sort(sortEntityBuckets);
};

const buildUserReportBuckets = async (issues, workspaceId) => {
  const assigneeIds = uniqueObjectIds(issues.map((issue) => issue.assignee));

  if (!assigneeIds.length) {
    return [];
  }

  const users = await User.find({
    _id: {
      $in: assigneeIds,
    },
    workspaceId: normalizeWorkspaceId(workspaceId),
  })
    .select("name email role workspaceId")
    .lean();
  const usersById = new Map(users.map((user) => [String(user._id), user]));
  const bucketsById = new Map();

  issues.forEach((issue) => {
    if (!issue.assignee) {
      return;
    }

    const assigneeId = String(issue.assignee);
    const assignee = usersById.get(assigneeId);

    if (!assignee) {
      return;
    }

    const bucket =
      bucketsById.get(assigneeId) ||
      createEntityBucket({
        assigneeId,
        name: assignee.name,
        email: assignee.email,
        role: assignee.role,
      });

    incrementEntityBucket(bucket, issue);
    bucketsById.set(assigneeId, bucket);
  });

  return Array.from(bucketsById.values()).sort(sortEntityBuckets);
};

const buildTeamReportBuckets = async (issues, workspaceId) => {
  const teamIds = uniqueObjectIds(issues.map((issue) => issue.teamId));

  if (!teamIds.length) {
    return [];
  }

  const [teams, teamMemberCounts] = await Promise.all([
    Team.find({
      _id: {
        $in: teamIds,
      },
      workspaceId: normalizeWorkspaceId(workspaceId),
    })
      .select("name workspaceId")
      .lean(),
    TeamMember.aggregate([
      {
        $match: {
          teamId: {
            $in: teamIds,
          },
        },
      },
      {
        $group: {
          _id: "$teamId",
          count: {
            $sum: 1,
          },
        },
      },
    ]),
  ]);
  const teamsById = new Map(teams.map((team) => [String(team._id), team]));
  const teamMemberCountMap = new Map(
    teamMemberCounts.map((item) => [String(item._id), item.count])
  );
  const bucketsById = new Map();

  issues.forEach((issue) => {
    if (!issue.teamId) {
      return;
    }

    const teamId = String(issue.teamId);
    const team = teamsById.get(teamId);

    if (!team) {
      return;
    }

    const bucket =
      bucketsById.get(teamId) ||
      createEntityBucket({
        teamId,
        name: team.name,
        memberCount: teamMemberCountMap.get(teamId) || 0,
      });

    incrementEntityBucket(bucket, issue);
    bucketsById.set(teamId, bucket);
  });

  return Array.from(bucketsById.values()).sort(sortEntityBuckets);
};

const buildReportsPayload = async (issues, workspaceId) => {
  const statusCountMap = createStatusCountMap(issues);
  const priorityCountMap = createPriorityCountMap(issues);
  const issuesPerProject = await buildProjectReportBuckets(issues, workspaceId);

  return {
    ...buildSummaryMetrics(issues),
    issuesByStatus: statusOrder.map((status) => ({
      key: status,
      label: statusLabelMap[status] || status,
      count: statusCountMap.get(status) || 0,
    })),
    issuesByPriority: priorityOrder.map((priority) => ({
      key: priority,
      label: priority,
      count: priorityCountMap.get(priority) || 0,
    })),
    issuesPerProject: issuesPerProject.map((project) => ({
      projectId: project.projectId,
      name: project.name,
      count: project.total,
      open: project.open,
      inProgress: project.inProgress,
      closed: project.closed,
      completionRate: project.completionRate,
      isCompleted: project.isCompleted,
    })),
  };
};

const getReports = asyncHandler(async (req, res) => {
  const query = await buildIssueQueryFromRequest(req, res, {
    forceOwnAssignee: !isAdmin(req.user),
  });
  const issues = await loadReportIssues(query);

  res.status(200).json(
    await buildReportsPayload(issues, req.user.workspaceId)
  );
});

const getProjectReports = asyncHandler(async (req, res) => {
  const query = await buildIssueQueryFromRequest(req, res, {
    forceOwnAssignee: !isAdmin(req.user),
  });
  const issues = await loadReportIssues(query);

  res.status(200).json({
    projects: await buildProjectReportBuckets(issues, req.user.workspaceId),
  });
});

const getUserReports = asyncHandler(async (req, res) => {
  const query = await buildIssueQueryFromRequest(req, res, {
    forceOwnAssignee: !isAdmin(req.user),
  });
  const issues = await loadReportIssues(query);

  res.status(200).json({
    users: await buildUserReportBuckets(issues, req.user.workspaceId),
  });
});

const getTeamReports = asyncHandler(async (req, res) => {
  const query = await buildIssueQueryFromRequest(req, res, {
    forceOwnAssignee: !isAdmin(req.user),
  });
  const issues = await loadReportIssues(query);

  res.status(200).json({
    teams: await buildTeamReportBuckets(issues, req.user.workspaceId),
  });
});

const createIssue = asyncHandler(async (req, res) => {
  logIssuePayloadReceipt("create", req);

  const {
    title,
    description,
    type,
    status,
    priority,
    projectId,
    teamId,
    epicId,
    sprintId,
    dueAt,
    dependsOnIssueId,
  } = req.body;
  const assigneeId = resolveAssigneeInput(req.body);
  const hasEpicInput = hasOwnField(req.body, "epicId");
  const hasSprintInput = hasOwnField(req.body, "sprintId");
  const canAssignPlanningFields = hasAdminAccess(req.user?.role);
  const normalizedType = getCanonicalIssueType(type, ISSUE_TYPES.TASK);
  const isBug = normalizedType === ISSUE_TYPES.BUG;
  const requestedStatus = isBug
    ? getRequestedBugStatus({
        payload: req.body,
        currentStatus: BUG_STATUS.NEW,
      })
    : status;
  const statusResult = parseIssueStatusInput(
    requestedStatus,
    isBug ? BUG_STATUS.NEW : ISSUE_STATUS.TODO
  );

  if (!title || !projectId || !teamId) {
    res.status(400);
    throw new Error("Issue title, project, and team are required");
  }

  if (statusResult.error) {
    res.status(statusResult.error.status);
    throw new Error(statusResult.error.message);
  }

  if (isBug && !isBugLifecycleStatus(statusResult.value)) {
    res.status(400);
    throw new Error(`Bug status must be ${BUG_STATUS_VALUES.join(", ")}`);
  }

  if (!isBug && !isGenericIssueStatus(statusResult.value)) {
    res.status(400);
    throw new Error(`Status must be ${GENERIC_ISSUE_STATUS_VALUES.join(", ")}`);
  }

  if (!mongoose.isValidObjectId(projectId)) {
    res.status(400);
    throw new Error("Invalid project id");
  }

  if (!isValidIssueType(normalizedType)) {
    res.status(400);
    throw new Error(`Type must be ${ISSUE_TYPE_VALUES.join(", ")}`);
  }

  if (req.user.role === "Developer") {
    res.status(403);
    throw new Error("Developers cannot create new issues");
  }

  if (req.user.role === "Tester" && normalizedType !== ISSUE_TYPES.BUG) {
    res.status(403);
    throw new Error("Testers can only report bug issues");
  }

  if (!canAssignPlanningFields && ((hasEpicInput && epicId) || (hasSprintInput && sprintId))) {
    res.status(403);
    throw new Error("Only admins and managers can assign epic or sprint during creation");
  }

  if (isBug && statusResult.value !== BUG_STATUS.NEW) {
    res.status(400);
    throw new Error("Newly created bugs must start in the New state");
  }

  const project = await loadAccessibleProject(req.user, projectId);

  if (!project) {
    res.status(403);
    throw new Error("You do not have access to that project");
  }

  const workspaceId = normalizeWorkspaceId(req.user.workspaceId);
  const teamResult = await ensureIssueTeamForProject({
    projectId: project._id,
    teamId,
    workspaceId,
    requireTeam: true,
  });

  if (teamResult.error) {
    res.status(teamResult.error.status);
    throw new Error(teamResult.error.message);
  }

  logProjectTeamsDebug("Create issue selected team", {
    projectId: String(project._id),
    teamId: String(teamId),
    teamName: teamResult.team?.name || "",
    currentUserRole: req.user.role || "",
    issueType: normalizedType,
    hasAssignee: Boolean(assigneeId),
    hasDeveloperLead: Boolean(
      getBugPayloadValue(req.body, "developerLeadId", [
        "developerLead",
        "devLeadId",
        "devLead",
      ])
    ),
  });

  if (assigneeId) {
    const canTesterAssignBugDeveloper =
      req.user.role === ROLE_TESTER && isBug;

    if (
      !isAdmin(req.user) &&
      !canTesterAssignBugDeveloper &&
      String(assigneeId) !== String(req.user._id)
    ) {
      res.status(403);
      throw new Error("Only admins can assign work to other users");
    }

    const assigneeResult = await ensureAssigneeBelongsToTeam({
      assigneeId,
      teamId,
      workspaceId,
    });

    if (assigneeResult.error) {
      res.status(assigneeResult.error.status);
      throw new Error(assigneeResult.error.message);
    }
  }

  const dueAtResult = parseOptionalDateInput(dueAt, "due date");

  if (dueAtResult.error) {
    res.status(dueAtResult.error.status);
    throw new Error(dueAtResult.error.message);
  }

  const dependencyResult = await ensureDependencyIssueForProject({
    dependsOnIssueId: dependsOnIssueId || null,
    projectId: project._id,
  });

  if (dependencyResult.error) {
    res.status(dependencyResult.error.status);
    throw new Error(dependencyResult.error.message);
  }

  let epicResult = {
    epic: null,
  };
  let sprintResult = {
    sprint: null,
  };

  if (canAssignPlanningFields) {
    const activeEpicCount = await Epic.countDocuments({
      projectId: project._id,
      workspaceId,
      status: "ACTIVE",
    });

    if (activeEpicCount > 0 && !epicId) {
      res.status(400);
      throw new Error("Epic is required for projects that contain epics");
    }

    epicResult = await ensureEpicForProject({
      epicId: epicId || null,
      projectId: project._id,
      requireActive: true,
    });

    if (epicResult.error) {
      res.status(epicResult.error.status);
      throw new Error(epicResult.error.message);
    }

    sprintResult = await ensureSprintForIssue({
      sprintId: sprintId || null,
      projectId: project._id,
      teamId,
    });

    if (sprintResult.error) {
      res.status(sprintResult.error.status);
      throw new Error(sprintResult.error.message);
    }
  }

  const normalizedPriority = isBug
    ? normalizeBugPriority(priority, "")
    : priority;
  const bugDetails = isBug
    ? buildBugDetailsDraft(req.body, {}, {
        testerOwner: req.user.role === ROLE_TESTER ? req.user._id : null,
        developerLead: assigneeId || null,
      })
    : {};
  let bugAssignmentDeveloperUser = null;

  if (isBug) {
    if (req.user.role === ROLE_TESTER) {
      bugDetails.testerOwner = req.user._id;
    }

    const bugDetailsError = validateBugDetails({
      bugDetails,
      priority: normalizedPriority,
    });

    if (bugDetailsError) {
      res.status(400);
      throw new Error(bugDetailsError);
    }

    const [testerOwnerResult, developerLeadResult] = await Promise.all([
      ensureBugOwnerInWorkspace({
        userId: bugDetails.testerOwner,
        workspaceId,
        label: "QA owner",
      }),
      ensureBugOwnerBelongsToTeam({
        userId: bugDetails.developerLead,
        teamId,
        workspaceId,
        label: "developer lead",
      }),
    ]);

    if (testerOwnerResult.error) {
      res.status(testerOwnerResult.error.status);
      throw new Error(testerOwnerResult.error.message);
    }

    if (developerLeadResult.error) {
      res.status(developerLeadResult.error.status);
      throw new Error(developerLeadResult.error.message);
    }

    bugAssignmentDeveloperUser = developerLeadResult.user || null;

    if (req.user.role === ROLE_TESTER && bugDetails.developerLead) {
      try {
        await ensureTesterBugAssignmentSmtpConfigured({
          user: req.user,
          workspaceId,
          receiverDeveloperEmail: bugAssignmentDeveloperUser?.email || "",
        });
      } catch (error) {
        res.status(400);
        throw new Error(TESTER_SMTP_REQUIRED_MESSAGE);
      }
    }
  }

  const planningOrder = await getNextPlanningOrder(Issue, {
    projectId,
    sprintId: sprintResult.sprint?._id || null,
  });
  const displayBugId = await getNextIssueDisplayId({
    Project,
    Issue,
    project,
  });

  const issue = await Issue.create({
    title,
    description,
    displayBugId,
    type: normalizedType,
    status: statusResult.value,
    priority: normalizedPriority || priority,
    assignee: assigneeId || null,
    reporter: req.user._id,
    projectId,
    teamId,
    epicId: epicResult.epic?._id || null,
    sprintId: sprintResult.sprint?._id || null,
    dueAt: dueAtResult.value,
    dependsOnIssueId: dependsOnIssueId || null,
    bugDetails,
    planningOrder,
    startedAt: isInProgressIssueStatus(statusResult.value) ? new Date() : null,
  });

  await populateIssueDocument(issue);
  await recordIssueHistory({
    issueId: issue._id,
    projectId: issue.projectId,
    actorId: req.user._id,
    eventType: "ISSUE_CREATED",
    field: "issue",
    fromValue: null,
    toValue: issue.title,
    meta: {
      type: issue.type,
      priority: issue.priority,
      status: issue.status,
      epicId: epicResult.epic?._id || null,
      sprintId: sprintResult.sprint?._id || null,
    },
  });

  const emailWorkspaceId = normalizeWorkspaceId(project.workspaceId || workspaceId);
  const creatorUserId = req.user?.id || req.user?._id || "";
  let emailNotification = null;

  if (isBug && hasBugDeveloperAssignment(issue)) {
    emailNotification = await sendBugAssignmentNotification({
      issue,
      actorUser: req.user,
      workspaceId: emailWorkspaceId,
      strictTesterSender: req.user.role === ROLE_TESTER,
    });
  } else {
    const emails = getIssueNotificationEmails(issue);
    const emailPayload = buildIssueCreatedEmailPayload(issue);

    if (emails.length > 0) {
      try {
        console.log("[issues] Issue-created email context", {
          issueId: String(issue._id),
          reqUserWorkspaceId: workspaceId,
          projectWorkspaceId: project.workspaceId || "",
          emailWorkspaceId,
          issueCreatorId: String(creatorUserId || ""),
          issueCreatorEmail: req.user?.email || "",
          issueCreatorRole: req.user?.role || "",
        });
        console.log("[issues] Sending email to:", emails);
        const emailResult = await sendIssueEmail(emails, emailPayload, {
          creatorUserId,
          workspaceId: emailWorkspaceId,
        });
        console.log("[issues] Issue-created final sender", {
          issueId: String(issue._id),
          creatorUserId: String(creatorUserId || ""),
          creatorUserEmail: req.user?.email || "",
          creatorUserRole: req.user?.role || "",
          finalSenderSource: emailResult?.senderSource || "unknown",
          finalFrom: emailResult?.from || "",
          finalAuthUser: emailResult?.authUser || "",
        });
        console.log("[issues] Issue-created email sent", {
          issueId: String(issue._id),
          senderSource: emailResult?.senderSource || "unknown",
          from: emailResult?.from || "",
          workspaceId: emailWorkspaceId,
        });
      } catch (error) {
        console.error("[issues] Failed to send issue-created email", {
          issueId: String(issue._id),
          message: error.message,
        });
      }
    }
  }

  res.status(201).json({
    ...serializeIssue(issue),
    ...(emailNotification ? { emailNotification } : {}),
  });
});

const updateIssue = asyncHandler(async (req, res) => {
  logIssuePayloadReceipt("update", req);

  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400);
    throw new Error("Invalid issue id");
  }

  const issue = await Issue.findById(req.params.id);

  if (!issue) {
    res.status(404);
    throw new Error("Issue not found");
  }

  let targetProject = await loadAccessibleProject(req.user, issue.projectId);
  const hasBugOwnerAccess =
    !isAdmin(req.user) && hasBugQaOwnership(issue, req.user._id);
  const hasBugDeveloperLeadAccess =
    !isAdmin(req.user) &&
    isBugType(issue.type) &&
    Boolean(issue.bugDetails?.developerLead) &&
    String(issue.bugDetails.developerLead) === String(req.user._id);
  const hasDirectIssueAccess =
    !isAdmin(req.user) &&
    (isAssignedToUser(issue, req.user._id) ||
      hasBugOwnerAccess ||
      hasBugDeveloperLeadAccess);

  if (!targetProject && hasDirectIssueAccess) {
    targetProject = await Project.findOne({
      _id: issue.projectId,
      workspaceId: normalizeWorkspaceId(req.user.workspaceId),
    });
  }

  if (!targetProject) {
    res.status(403);
    throw new Error("You do not have access to this issue");
  }

  const hasProjectLeadershipAccess = canManageProjectPlanning(req.user, targetProject);

  if (!isAdmin(req.user)) {
    if (
      !hasProjectLeadershipAccess &&
      !hasDirectIssueAccess
    ) {
      res.status(403);
      throw new Error("You can only update issues assigned to you");
    }

    const allowedFields = hasProjectLeadershipAccess
      ? [
          "title",
          "description",
          "type",
          "priority",
          "status",
          "teamId",
          "epicId",
          "sprintId",
          "assigneeId",
          "assignee",
          "dueAt",
          "dependsOnIssueId",
          "bugDetails",
          "severity",
          "testerOwnerId",
          "testerOwner",
          "qaOwnerId",
          "qaOwner",
          "developerLeadId",
          "developerLead",
          "devLeadId",
          "devLead",
          "stepsToReproduce",
          "expectedResult",
          "actualResult",
          "reopenReason",
          "rejectionReason",
          "targetRelease",
          "futureRelease",
          "statusChangeComment",
          "comment",
        ]
      : [
          "status",
          "reopenReason",
          "rejectionReason",
          "targetRelease",
          "futureRelease",
          "statusChangeComment",
          "comment",
        ];
    const requestedFields = Object.keys(req.body);

    if (!requestedFields.every((field) => allowedFields.includes(field))) {
      res.status(403);
      throw new Error("Your role can only update issue status");
    }
  }

  const workspaceId = normalizeWorkspaceId(req.user.workspaceId);
  const previousSprintId = issue.sprintId ? String(issue.sprintId) : "";
  const previousAssigneeId = issue.assignee ? String(issue.assignee) : "";
  const previousBugDeveloperId = isBugType(issue.type)
    ? getUserIdString(issue.bugDetails?.developerLead)
    : "";
  const previousBugStatus = isBugType(issue.type)
    ? getBugStatusForIssueStatus(issue.status)
    : "";
  const changeEntries = [];

  if (req.body.projectId) {
    if (!isAdmin(req.user)) {
      res.status(403);
      throw new Error("Only admins can move issues between projects");
    }

    if (!mongoose.isValidObjectId(req.body.projectId)) {
      res.status(400);
      throw new Error("Invalid project id");
    }

    targetProject = await loadAccessibleProject(req.user, req.body.projectId);

    if (!targetProject) {
      res.status(403);
      throw new Error("You do not have access to the target project");
    }

    const previousProjectId = issue.projectId;
    issue.projectId = targetProject._id;
    changeEntries.push({
      field: "projectId",
      fromValue: previousProjectId,
      toValue: targetProject._id,
    });
  }

  const previousType = issue.type;
  const nextType = hasOwnField(req.body, "type")
    ? getCanonicalIssueType(req.body.type, "")
    : issue.type;
  const nextIsBug = nextType === ISSUE_TYPES.BUG;
  const requestedUpdateStatus = nextIsBug
    ? getRequestedBugStatus({
        payload: req.body,
        currentStatus: issue.status,
      })
    : req.body.status;
  const nextStatusResult = parseIssueStatusInput(
    requestedUpdateStatus,
    nextIsBug ? getBugStatusForIssueStatus(issue.status) : issue.status
  );
  const nextPriority = hasOwnField(req.body, "priority")
    ? nextIsBug
      ? normalizeBugPriority(req.body.priority, req.body.priority)
      : req.body.priority
    : issue.priority;

  if (nextStatusResult.error) {
    res.status(nextStatusResult.error.status);
    throw new Error(nextStatusResult.error.message);
  }

  if (hasOwnField(req.body, "type") && !isValidIssueType(nextType)) {
    res.status(400);
    throw new Error(`Type must be ${ISSUE_TYPE_VALUES.join(", ")}`);
  }

  const nextStatus = nextStatusResult.value;
  const currentBugStatus = getBugStatusForIssueStatus(issue.status);

  if (nextIsBug && !isBugLifecycleStatus(nextStatus)) {
    res.status(400);
    throw new Error(`Bug status must be ${BUG_STATUS_VALUES.join(", ")}`);
  }

  if (!nextIsBug && !isGenericIssueStatus(nextStatus)) {
    res.status(400);
    throw new Error(`Status must be ${GENERIC_ISSUE_STATUS_VALUES.join(", ")}`);
  }

  if (nextIsBug && !isBugType(issue.type) && nextStatus !== BUG_STATUS.NEW) {
    res.status(400);
    throw new Error("Work items converted to Bug must start in the New state");
  }

  if (nextIsBug && isBugType(issue.type) && currentBugStatus !== nextStatus) {
    const transitionError = validateBugTransition({
      user: req.user,
      fromStatus: currentBugStatus,
      toStatus: nextStatus,
      payload: req.body,
    });

    if (transitionError) {
      res.status(400);
      throw new Error(transitionError);
    }
  }

  ["title", "description"].forEach((field) => {
    if (typeof req.body[field] !== "undefined") {
      changeEntries.push({
        field,
        fromValue: issue[field],
        toValue: req.body[field],
      });
      issue[field] = req.body[field];
    }
  });

  if (typeof req.body.priority !== "undefined") {
    changeEntries.push({
      field: "priority",
      fromValue: issue.priority,
      toValue: nextPriority,
    });
    issue.priority = nextPriority;
  }

  if (typeof req.body.type !== "undefined") {
    changeEntries.push({
      field: "type",
      fromValue: issue.type,
      toValue: nextType,
    });
    issue.type = nextType;
  }

  if (typeof req.body.status !== "undefined" || String(issue.status) !== String(nextStatus)) {
    changeEntries.push({
      field: "status",
      fromValue: issue.status,
      toValue: nextStatus,
    });
    issue.status = nextStatus;
  }

  if (isInProgressIssueStatus(nextStatus) && !issue.startedAt) {
    issue.startedAt = new Date();
  }

  const hasTeamChange = hasOwnField(req.body, "teamId");
  const hasEpicChange = hasOwnField(req.body, "epicId");
  const hasSprintChange = hasOwnField(req.body, "sprintId");
  const hasAssigneeChange = hasAssigneeInput(req.body);
  const hasDueAtChange = hasOwnField(req.body, "dueAt");
  const hasDependencyChange = hasOwnField(req.body, "dependsOnIssueId");
  const nextTeamId = hasTeamChange ? req.body.teamId || null : issue.teamId || null;
  const nextEpicId =
    hasEpicChange || req.body.projectId
      ? req.body.epicId || null
      : issue.epicId || null;
  const nextSprintId =
    hasSprintChange || req.body.projectId
      ? req.body.sprintId || null
      : issue.sprintId || null;
  const nextAssigneeId = hasAssigneeChange
    ? resolveAssigneeInput(req.body) || null
    : issue.assignee || null;
  const nextDependsOnIssueId = hasDependencyChange
    ? req.body.dependsOnIssueId || null
    : issue.dependsOnIssueId || null;
  let nextBugDetails = null;
  let nextDeveloperLeadUser = null;

  if (nextIsBug) {
    nextBugDetails = buildBugDetailsDraft(req.body, issue.bugDetails || {}, {});

    if (req.user.role === ROLE_TESTER) {
      nextBugDetails.testerOwner = req.user._id;
    }

    if (
      !nextBugDetails.developerLead &&
      !hasBugPayloadField(req.body, "developerLeadId", [
        "developerLead",
        "devLeadId",
        "devLead",
      ]) &&
      nextAssigneeId
    ) {
      nextBugDetails.developerLead = nextAssigneeId;
    }

    const transitionReason = getBugTransitionReason(req.body, nextStatus);

    if (currentBugStatus !== nextStatus && nextStatus === BUG_STATUS.REOPEN) {
      nextBugDetails.reopenReason = transitionReason;
    }

    if (currentBugStatus !== nextStatus && nextStatus === BUG_STATUS.REJECTED) {
      nextBugDetails.rejectionReason = transitionReason;
    }

    const bugDetailsError = validateBugDetails({
      bugDetails: nextBugDetails,
      priority: nextPriority,
    });

    if (bugDetailsError) {
      res.status(400);
      throw new Error(bugDetailsError);
    }
  }

  if (hasTeamChange || req.body.projectId) {
    const teamResult = await ensureIssueTeamForProject({
      projectId: targetProject?._id || issue.projectId,
      teamId: nextTeamId,
      workspaceId,
      requireTeam: false,
    });

    if (teamResult.error) {
      res.status(teamResult.error.status);
      throw new Error(teamResult.error.message);
    }
  }

  if (hasEpicChange || req.body.projectId) {
    const epicResult = await ensureEpicForProject({
      epicId: nextEpicId,
      projectId: targetProject?._id || issue.projectId,
    });

    if (epicResult.error) {
      res.status(epicResult.error.status);
      throw new Error(epicResult.error.message);
    }
  }

  if (hasSprintChange || req.body.projectId || (hasTeamChange && nextSprintId)) {
    const sprintResult = await ensureSprintForIssue({
      sprintId: nextSprintId,
      projectId: targetProject?._id || issue.projectId,
      teamId: nextTeamId,
    });

    if (sprintResult.error) {
      res.status(sprintResult.error.status);
      throw new Error(sprintResult.error.message);
    }
  }

  if (nextAssigneeId) {
    const assigneeResult = await ensureAssigneeBelongsToTeam({
      assigneeId: nextAssigneeId,
      teamId: nextTeamId,
      workspaceId,
    });

    if (assigneeResult.error) {
      res.status(assigneeResult.error.status);
      throw new Error(assigneeResult.error.message);
    }
  }

  if (nextIsBug && nextBugDetails) {
    const [testerOwnerResult, developerLeadResult] = await Promise.all([
      ensureBugOwnerInWorkspace({
        userId: nextBugDetails.testerOwner,
        workspaceId,
        label: "QA owner",
      }),
      ensureBugOwnerBelongsToTeam({
        userId: nextBugDetails.developerLead,
        teamId: nextTeamId,
        workspaceId,
        label: "developer lead",
      }),
    ]);

    if (testerOwnerResult.error) {
      res.status(testerOwnerResult.error.status);
      throw new Error(testerOwnerResult.error.message);
    }

    if (developerLeadResult.error) {
      res.status(developerLeadResult.error.status);
      throw new Error(developerLeadResult.error.message);
    }

    nextDeveloperLeadUser = developerLeadResult.user || null;
  }

  const nextBugDeveloperId = nextIsBug
    ? getUserIdString(nextBugDetails?.developerLead)
    : "";
  const shouldSendBugAssignmentEmail =
    nextIsBug &&
    Boolean(nextBugDeveloperId) &&
    (previousBugDeveloperId !== nextBugDeveloperId ||
      (previousBugStatus !== BUG_STATUS.ASSIGNED && nextStatus === BUG_STATUS.ASSIGNED));

  if (req.user.role === ROLE_TESTER && shouldSendBugAssignmentEmail) {
    try {
      await ensureTesterBugAssignmentSmtpConfigured({
        user: req.user,
        workspaceId,
        receiverDeveloperEmail: nextDeveloperLeadUser?.email || "",
      });
    } catch (error) {
      res.status(400);
      throw new Error(TESTER_SMTP_REQUIRED_MESSAGE);
    }
  }

  if (hasDueAtChange) {
    const dueAtResult = parseOptionalDateInput(req.body.dueAt, "due date");

    if (dueAtResult.error) {
      res.status(dueAtResult.error.status);
      throw new Error(dueAtResult.error.message);
    }

    changeEntries.push({
      field: "dueAt",
      fromValue: issue.dueAt || null,
      toValue: dueAtResult.value || null,
    });
    issue.dueAt = dueAtResult.value;
  }

  if (hasDependencyChange || req.body.projectId) {
    const dependencyResult = await ensureDependencyIssueForProject({
      dependsOnIssueId: nextDependsOnIssueId,
      projectId: targetProject?._id || issue.projectId,
      issueId: issue._id,
    });

    if (dependencyResult.error) {
      res.status(dependencyResult.error.status);
      throw new Error(dependencyResult.error.message);
    }
  }

  if (hasTeamChange) {
    changeEntries.push({
      field: "teamId",
      fromValue: issue.teamId || null,
      toValue: nextTeamId || null,
    });
    issue.teamId = nextTeamId;
  }

  if (hasEpicChange || req.body.projectId) {
    changeEntries.push({
      field: "epicId",
      fromValue: issue.epicId || null,
      toValue: nextEpicId || null,
    });
    issue.epicId = nextEpicId;
  }

  if (hasSprintChange || req.body.projectId) {
    changeEntries.push({
      field: "sprintId",
      fromValue: issue.sprintId || null,
      toValue: nextSprintId || null,
    });
    issue.sprintId = nextSprintId;
  }

  if (hasAssigneeChange) {
    if (!isAdmin(req.user)) {
      res.status(403);
      throw new Error("Only admins can reassign issues");
    }

    const previousAssigneeId = issue.assignee || null;

    if (!nextAssigneeId) {
      issue.assignee = null;
    } else {
      issue.assignee = nextAssigneeId;
    }

    changeEntries.push({
      field: "assignee",
      fromValue: previousAssigneeId,
      toValue: nextAssigneeId || null,
    });
  }

  if (hasDependencyChange) {
    changeEntries.push({
      field: "dependsOnIssueId",
      fromValue: issue.dependsOnIssueId || null,
      toValue: nextDependsOnIssueId || null,
    });
    issue.dependsOnIssueId = nextDependsOnIssueId;
  }

  if (nextIsBug && nextBugDetails) {
    const previousBugDetails = serializeBugDetails(issue.bugDetails || {});

    Object.entries(nextBugDetails).forEach(([field, value]) => {
      if (String(previousBugDetails[field] || "") === String(value || "")) {
        return;
      }

      changeEntries.push({
        field: `bugDetails.${field}`,
        fromValue: previousBugDetails[field] || null,
        toValue: value || null,
      });
    });

    issue.bugDetails = nextBugDetails;
  } else if (isBugType(previousType) && !nextIsBug) {
    changeEntries.push({
      field: "bugDetails",
      fromValue: serializeBugDetails(issue.bugDetails || {}),
      toValue: null,
    });
    issue.bugDetails = {};
  }

  if (changeEntries.some((entry) => String(entry.fromValue || "") !== String(entry.toValue || ""))) {
    issue.updatedAt = new Date();
  }

  await issue.save();
  await populateIssueDocument(issue);
  const statusChangeEntry = changeEntries.find(
    (entry) =>
      entry.field === "status" &&
      String(entry.fromValue || "") !== String(entry.toValue || "")
  );
  const statusChangeReason =
    statusChangeEntry && isBugType(issue.type)
      ? getBugTransitionReason(req.body, statusChangeEntry.toValue)
      : "";

  if (statusChangeReason) {
    await Comment.create({
      issueId: issue._id,
      userId: req.user._id,
      comment: statusChangeReason,
    });
  }

  await Promise.all(
    changeEntries
      .filter((entry) => String(entry.fromValue || "") !== String(entry.toValue || ""))
      .map((entry) =>
        recordIssueHistory({
          issueId: issue._id,
          projectId: issue.projectId,
          actorId: req.user._id,
          eventType:
            isBugType(issue.type) && entry.field === "status"
              ? "BUG_STATUS_CHANGED"
              : "ISSUE_UPDATED",
          field: entry.field,
          fromValue: entry.fromValue,
          toValue: entry.toValue,
          meta: {
            title: issue.title,
            ...(entry.field === "status" && statusChangeReason
              ? { reason: statusChangeReason }
              : {}),
            ...(entry.field === "status" && issue.bugDetails?.targetRelease
              ? { targetRelease: issue.bugDetails.targetRelease }
              : {}),
          },
        })
      )
  );

  let emailNotification = null;

  if (shouldSendBugAssignmentEmail) {
    emailNotification = await sendBugAssignmentNotification({
      issue,
      actorUser: req.user,
      workspaceId: normalizeWorkspaceId(targetProject.workspaceId || workspaceId),
      strictTesterSender: req.user.role === ROLE_TESTER,
    });
  }

  try {
    const notificationResult = await scheduleIssueStateNotifications({
      issueId: issue._id,
      previousSprintId,
      previousAssigneeId,
      actorUserId: req.user._id,
    });

    console.info("[sprint-notifications] issue update evaluated", {
      issueId: String(issue._id),
      queued: Number(notificationResult?.queued || 0),
      skipped: notificationResult?.skipped || "",
    });
  } catch (error) {
    console.error("[sprint-notifications] issue update notification evaluation failed", {
      issueId: String(issue._id),
      message: error.message,
    });
  }

  res.status(200).json({
    ...serializeIssue(issue),
    ...(emailNotification ? { emailNotification } : {}),
  });
});

const deleteIssue = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400);
    throw new Error("Invalid issue id");
  }

  if (!isAdmin(req.user)) {
    res.status(403);
    throw new Error("Only admins can delete issues");
  }

  const issue = await Issue.findById(req.params.id);

  if (!issue) {
    res.status(404);
    throw new Error("Issue not found");
  }

  const project = await loadAccessibleProject(req.user, issue.projectId);

  if (!project) {
    res.status(403);
    throw new Error("You do not have access to this issue");
  }

  await Comment.deleteMany({ issueId: issue._id });
  await issue.deleteOne();

  res.status(200).json({
    message: "Issue deleted successfully",
  });
});

module.exports = {
  getIssues,
  getMyIssues,
  getRecentIssueActivity,
  getReports,
  getProjectReports,
  getUserReports,
  getTeamReports,
  createIssue,
  updateIssue,
  deleteIssue,
};
