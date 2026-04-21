const mongoose = require("mongoose");
const Comment = require("../models/Comment");
const Epic = require("../models/Epic");
const Issue = require("../models/Issue");
const Project = require("../models/Project");
const ProjectMeeting = require("../models/ProjectMeeting");
const ProjectTeam = require("../models/ProjectTeam");
const Team = require("../models/Team");
const TeamMember = require("../models/TeamMember");
const User = require("../models/User");
const { sendProjectMeetingInviteEmail } = require("../services/emailService");
const { createOnlineMeeting } = require("../services/microsoftGraphService");
const asyncHandler = require("../utils/asyncHandler");
const { hasAdminAccess } = require("../utils/roles");
const {
  buildProjectAccessQuery,
  loadSerializedProjectById,
  serializeProjectsWithRelations,
} = require("../utils/projectRelations");
const { normalizeWorkspaceId } = require("../utils/workspace");
const { PLANNING_ORDER_INCREMENT } = require("../utils/planningOrder");

const projectPopulation = [
  { path: "createdBy", select: "name email role workspaceId" },
  { path: "manager", select: "name email role workspaceId" },
  { path: "teamLead", select: "name email role workspaceId" },
];

const populateProject = (target) => target.populate(projectPopulation);

const getProjectIssueCount = async (projectId) => Issue.countDocuments({ projectId });

const parseProjectCompletedValue = (value) => {
  if (typeof value === "boolean") {
    return {
      value,
    };
  }

  if (value === "true" || value === "false") {
    return {
      value: value === "true",
    };
  }

  return {
    error: {
      status: 400,
      message: "Project status must include isCompleted as a boolean",
    },
  };
};

const normalizeProjectEpics = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  const uniqueEpics = new Map();

  value.forEach((epic) => {
    if (typeof epic !== "string") {
      return;
    }

    const normalizedEpic = epic.trim();

    if (!normalizedEpic) {
      return;
    }

    const dedupeKey = normalizedEpic.toLowerCase();

    if (!uniqueEpics.has(dedupeKey)) {
      uniqueEpics.set(dedupeKey, normalizedEpic);
    }
  });

  return Array.from(uniqueEpics.values());
};

const loadWorkspaceUserAssignment = async ({
  userId,
  workspaceId,
  label,
  allowedRoles = [],
}) => {
  if (userId === null || userId === "" || typeof userId === "undefined") {
    return {
      value: null,
    };
  }

  if (!mongoose.isValidObjectId(userId)) {
    return {
      error: {
        status: 400,
        message: `Invalid ${label} user`,
      },
    };
  }

  const user = await User.findOne({
    _id: userId,
    workspaceId: normalizeWorkspaceId(workspaceId),
  })
    .select("_id name email role workspaceId")
    .lean();

  if (!user) {
    return {
      error: {
        status: 404,
        message: `${label} could not be found in this workspace`,
      },
    };
  }

  if (allowedRoles.length && !allowedRoles.includes(user.role)) {
    return {
      error: {
        status: 400,
        message: `${label} must have one of these roles: ${allowedRoles.join(", ")}`,
      },
    };
  }

  return {
    value: user._id,
  };
};

const buildProjectQuery = async (user) => {
  const accessQuery = await buildProjectAccessQuery(user);

  if (hasAdminAccess(user.role)) {
    return accessQuery;
  }

  const workspaceId = normalizeWorkspaceId(user.workspaceId);
  const userId = user.id || user._id;
  const directlyAssignedProjectIds = await Issue.find({
    assignee: userId,
  }).distinct("projectId");
  const assignedProjectIds = directlyAssignedProjectIds.length
    ? await Project.find({
        _id: {
          $in: directlyAssignedProjectIds,
        },
        workspaceId,
      }).distinct("_id")
    : [];

  if (!assignedProjectIds.length) {
    return accessQuery;
  }

  return {
    ...accessQuery,
    $or: [
      ...(accessQuery.$or || []),
      {
        _id: {
          $in: assignedProjectIds,
        },
      },
    ],
  };
};

const buildProjectResponse = async (projectId) => {
  const serializedProject = await loadSerializedProjectById(
    Project,
    projectId,
    populateProject
  );

  if (!serializedProject) {
    return null;
  }

  return {
    ...serializedProject,
    issueCount: await getProjectIssueCount(serializedProject._id),
  };
};

const parseDurationMinutes = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsedValue = Number(value);

    if (Number.isFinite(parsedValue)) {
      return Math.round(parsedValue);
    }
  }

  return NaN;
};

const parseMeetingDateTime = (value) => {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
};

const resolveMeetingWindow = ({ startDateTime, endDateTime, durationMinutes }) => {
  const startDate = parseMeetingDateTime(startDateTime);

  if (!startDate) {
    return {
      error: "Meeting start date and time is required",
    };
  }

  const parsedEndDate = parseMeetingDateTime(endDateTime);

  if (parsedEndDate) {
    if (parsedEndDate.getTime() <= startDate.getTime()) {
      return {
        error: "Meeting end time must be after the start time",
      };
    }

    return {
      startDate,
      endDate: parsedEndDate,
      durationMinutes: Math.max(
        5,
        Math.round((parsedEndDate.getTime() - startDate.getTime()) / (60 * 1000))
      ),
    };
  }

  const parsedDurationMinutes = parseDurationMinutes(durationMinutes);

  if (!Number.isFinite(parsedDurationMinutes) || parsedDurationMinutes < 5) {
    return {
      error: "Meeting duration must be at least 5 minutes",
    };
  }

  return {
    startDate,
    endDate: new Date(startDate.getTime() + parsedDurationMinutes * 60 * 1000),
    durationMinutes: parsedDurationMinutes,
  };
};

const serializeProjectMeeting = (meeting) => {
  const serializedMeeting =
    typeof meeting?.toObject === "function" ? meeting.toObject() : meeting;

  if (!serializedMeeting) {
    return null;
  }

  return {
    _id: serializedMeeting._id,
    projectId: serializedMeeting.projectId,
    workspaceId: normalizeWorkspaceId(serializedMeeting.workspaceId),
    scheduledBy: serializedMeeting.scheduledBy,
    provider: serializedMeeting.provider,
    subject: serializedMeeting.subject,
    meetingId: serializedMeeting.meetingId,
    joinUrl: serializedMeeting.joinUrl,
    startDateTime: serializedMeeting.startDateTime,
    endDateTime: serializedMeeting.endDateTime,
    durationMinutes: serializedMeeting.durationMinutes,
    participants: serializedMeeting.participants || [],
    createdAt: serializedMeeting.createdAt,
  };
};

const loadAccessibleProject = async (user, projectId) =>
  Project.findOne({
    _id: projectId,
    ...(await buildProjectAccessQuery(user)),
  })
    .select("_id name workspaceId")
    .lean();

const getAttachedTeamParticipants = async ({ projectId, workspaceId }) => {
  const projectTeams = await ProjectTeam.find({
    projectId,
  })
    .select("teamId")
    .lean();
  const attachedTeamIds = Array.from(
    new Set(projectTeams.map((item) => String(item.teamId)).filter(Boolean))
  );

  if (!attachedTeamIds.length) {
    return [];
  }

  const teamMemberships = await TeamMember.find({
    teamId: {
      $in: attachedTeamIds,
    },
  })
    .select("userId")
    .lean();
  const userIds = Array.from(
    new Set(teamMemberships.map((item) => String(item.userId)).filter(Boolean))
  );

  if (!userIds.length) {
    return [];
  }

  const users = await User.find({
    _id: {
      $in: userIds,
    },
    workspaceId: normalizeWorkspaceId(workspaceId),
  })
    .select("_id name email role workspaceId")
    .lean();
  const participantsByEmail = new Map();

  users.forEach((user) => {
    const email = String(user?.email || "").trim().toLowerCase();

    if (!email || participantsByEmail.has(email)) {
      return;
    }

    participantsByEmail.set(email, {
      userId: user._id,
      name: user.name || email,
      email,
      role: user.role || "",
    });
  });

  return Array.from(participantsByEmail.values()).sort((left, right) =>
    left.name.localeCompare(right.name)
  );
};

const getProjects = asyncHandler(async (req, res) => {
  if (!req.user) {
    res.status(401);
    throw new Error("Unauthorized");
  }

  const userId = req.user.id || req.user._id;

  if (!userId) {
    res.status(401);
    throw new Error("Unauthorized");
  }

  const projectQuery = await buildProjectQuery(req.user);
  const projects = await populateProject(Project.find(projectQuery))
    .sort({ createdAt: -1 })
    .lean();
  const serializedProjects = await serializeProjectsWithRelations(projects);
  const issueCounts = await Issue.aggregate([
    {
      $match: {
        projectId: {
          $in: serializedProjects.map((project) => project._id),
        },
      },
    },
    {
      $group: {
        _id: "$projectId",
        count: { $sum: 1 },
      },
    },
  ]);
  const issueCountMap = new Map(
    issueCounts.map((item) => [String(item._id), item.count])
  );

  res.status(200).json(
    serializedProjects.map((project) => ({
      ...project,
      issueCount: issueCountMap.get(String(project._id)) || 0,
    }))
  );
});

const createProject = asyncHandler(async (req, res) => {
  if (!req.user) {
    res.status(401);
    throw new Error("Unauthorized");
  }

  const userId = req.user.id || req.user._id;
  const workspaceId = normalizeWorkspaceId(req.user.workspaceId);
  const {
    name,
    description = "",
    epics = [],
    manager = null,
    teamLead = null,
  } = req.body;

  if (!userId) {
    res.status(401);
    throw new Error("Unauthorized");
  }

  if (!hasAdminAccess(req.user.role)) {
    res.status(403);
    throw new Error("Only admins and managers can create projects");
  }

  if (!name || !name.trim()) {
    res.status(400);
    throw new Error("Project name is required");
  }

  const [managerResult, teamLeadResult] = await Promise.all([
    loadWorkspaceUserAssignment({
      userId: manager,
      workspaceId,
      label: "Manager",
      allowedRoles: ["Admin", "Manager"],
    }),
    loadWorkspaceUserAssignment({
      userId: teamLead,
      workspaceId,
      label: "Team lead",
      allowedRoles: ["Admin", "Manager", "Developer"],
    }),
  ]);

  if (managerResult.error) {
    res.status(managerResult.error.status);
    throw new Error(managerResult.error.message);
  }

  if (teamLeadResult.error) {
    res.status(teamLeadResult.error.status);
    throw new Error(teamLeadResult.error.message);
  }

  const project = await Project.create({
    name: name.trim(),
    description: typeof description === "string" ? description.trim() : "",
    epics: normalizeProjectEpics(epics),
    manager: managerResult.value,
    teamLead: teamLeadResult.value,
    workspaceId,
    createdBy: userId,
    isCompleted: false,
  });
  const normalizedEpics = normalizeProjectEpics(epics);

  if (normalizedEpics.length) {
    await Epic.insertMany(
      normalizedEpics.map((epicName, index) => ({
        projectId: project._id,
        workspaceId,
        name: epicName,
        description: "",
        color: "#3B82F6",
        planningOrder: (index + 1) * PLANNING_ORDER_INCREMENT,
        status: "ACTIVE",
        createdBy: userId,
      }))
    );
  }

  res.status(201).json(await buildProjectResponse(project._id));
});

const deleteProject = asyncHandler(async (req, res) => {
  if (!req.user) {
    res.status(401);
    throw new Error("Unauthorized");
  }

  if (!hasAdminAccess(req.user.role)) {
    res.status(403);
    throw new Error("Only admins and managers can delete projects");
  }

  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400);
    throw new Error("Invalid project id");
  }

  const workspaceId = normalizeWorkspaceId(req.user.workspaceId);
  const project = await Project.findOne({
    _id: req.params.id,
    workspaceId,
  })
    .select("_id")
    .lean();

  if (!project) {
    res.status(404);
    throw new Error("Project not found");
  }

  const issueIds = await Issue.find({
    projectId: project._id,
  }).distinct("_id");

  await Promise.all([
    issueIds.length
      ? Comment.deleteMany({
          issueId: {
            $in: issueIds,
          },
        })
      : Promise.resolve(),
    Issue.deleteMany({
      projectId: project._id,
    }),
    ProjectTeam.deleteMany({
      projectId: project._id,
    }),
    ProjectMeeting.deleteMany({
      projectId: project._id,
    }),
    Project.deleteOne({
      _id: project._id,
      workspaceId,
    }),
  ]);

  res.status(200).json({
    message: "Project deleted successfully",
  });
});

const attachProjectTeam = asyncHandler(async (req, res) => {
  if (!req.user) {
    res.status(401);
    throw new Error("Unauthorized");
  }

  if (!hasAdminAccess(req.user.role)) {
    res.status(403);
    throw new Error("Only admins and managers can attach teams to projects");
  }

  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400);
    throw new Error("Invalid project id");
  }

  if (!mongoose.isValidObjectId(req.body.teamId)) {
    res.status(400);
    throw new Error("Invalid team id");
  }

  const workspaceId = normalizeWorkspaceId(req.user.workspaceId);
  const [project, team, existingProjectTeam] = await Promise.all([
    Project.findOne({
      _id: req.params.id,
      workspaceId,
    })
      .select("_id workspaceId")
      .lean(),
    Team.findOne({
      _id: req.body.teamId,
      workspaceId,
    })
      .select("_id name workspaceId")
      .lean(),
    ProjectTeam.findOne({
      projectId: req.params.id,
      teamId: req.body.teamId,
    })
      .select("_id")
      .lean(),
  ]);

  if (!project) {
    res.status(404);
    throw new Error("Project not found");
  }

  if (!team) {
    res.status(404);
    throw new Error("Selected team could not be found in this workspace");
  }

  if (existingProjectTeam) {
    res.status(409);
    throw new Error("This team is already attached to the project");
  }

  await ProjectTeam.create({
    projectId: project._id,
    teamId: team._id,
  });

  res.status(200).json({
    message: `${team.name} attached to the project`,
    ...(await buildProjectResponse(project._id)),
  });
});

const detachProjectTeam = asyncHandler(async (req, res) => {
  if (!req.user) {
    res.status(401);
    throw new Error("Unauthorized");
  }

  if (!hasAdminAccess(req.user.role)) {
    res.status(403);
    throw new Error("Only admins and managers can detach teams from projects");
  }

  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400);
    throw new Error("Invalid project id");
  }

  if (!mongoose.isValidObjectId(req.params.teamId)) {
    res.status(400);
    throw new Error("Invalid team id");
  }

  const workspaceId = normalizeWorkspaceId(req.user.workspaceId);
  const [project, team, projectTeam] = await Promise.all([
    Project.findOne({
      _id: req.params.id,
      workspaceId,
    })
      .select("_id workspaceId")
      .lean(),
    Team.findOne({
      _id: req.params.teamId,
      workspaceId,
    })
      .select("_id name")
      .lean(),
    ProjectTeam.findOne({
      projectId: req.params.id,
      teamId: req.params.teamId,
    })
      .select("_id")
      .lean(),
  ]);

  if (!project) {
    res.status(404);
    throw new Error("Project not found");
  }

  if (!team) {
    res.status(404);
    throw new Error("Selected team could not be found in this workspace");
  }

  if (!projectTeam) {
    res.status(404);
    throw new Error("This team is not attached to the project");
  }

  await ProjectTeam.deleteOne({
    _id: projectTeam._id,
  });

  res.status(200).json({
    message: `${team.name} detached from the project`,
    ...(await buildProjectResponse(project._id)),
  });
});

const updateProjectStatus = asyncHandler(async (req, res) => {
  if (!req.user) {
    res.status(401);
    throw new Error("Unauthorized");
  }

  if (!hasAdminAccess(req.user.role)) {
    res.status(403);
    throw new Error("Only admins and managers can update project status");
  }

  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400);
    throw new Error("Invalid project id");
  }

  const completedValueResult = parseProjectCompletedValue(req.body?.isCompleted);

  if (completedValueResult.error) {
    res.status(completedValueResult.error.status);
    throw new Error(completedValueResult.error.message);
  }

  const workspaceId = normalizeWorkspaceId(req.user.workspaceId);
  const project = await Project.findOne({
    _id: req.params.id,
    workspaceId,
  });

  if (!project) {
    res.status(404);
    throw new Error("Project not found");
  }

  project.isCompleted = completedValueResult.value;
  await project.save();

  res.status(200).json({
    message: project.isCompleted ? "Project marked as completed" : "Project reopened",
    ...(await buildProjectResponse(project._id)),
  });
});

const scheduleProjectMeeting = asyncHandler(async (req, res) => {
  if (!req.user) {
    res.status(401);
    throw new Error("Unauthorized");
  }

  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400);
    throw new Error("Invalid project id");
  }

  const subject = typeof req.body?.subject === "string" ? req.body.subject.trim() : "";
  const meetingWindow = resolveMeetingWindow({
    startDateTime: req.body?.startDateTime,
    endDateTime: req.body?.endDateTime,
    durationMinutes: req.body?.durationMinutes,
  });

  if (!subject) {
    res.status(400);
    throw new Error("Meeting title is required");
  }

  if (meetingWindow.error) {
    res.status(400);
    throw new Error(meetingWindow.error);
  }

  const { startDate, endDate, durationMinutes } = meetingWindow;
  const project = await loadAccessibleProject(req.user, req.params.id);

  if (!project) {
    res.status(404);
    throw new Error("Project not found");
  }

  const workspaceId = normalizeWorkspaceId(req.user.workspaceId);
  const mailWorkspaceId = normalizeWorkspaceId(project.workspaceId || workspaceId);
  const participants = await getAttachedTeamParticipants({
    projectId: project._id,
    workspaceId,
  });

  if (!participants.length) {
    res.status(400);
    throw new Error("No users found in attached teams. Attach a team with members first.");
  }

  const attendees = participants.map((participant) => ({
    emailAddress: {
      address: participant.email,
      name: participant.name,
    },
    type: "required",
  }));
  const meetingResult = await createOnlineMeeting({
    subject,
    startDateTime: startDate.toISOString(),
    endDateTime: endDate.toISOString(),
    attendees,
    organizerEmail: req.user.email,
  });
  const meeting = await ProjectMeeting.create({
    projectId: project._id,
    workspaceId,
    scheduledBy: req.user._id,
    provider: "microsoft_teams",
    subject,
    meetingId: meetingResult.meetingId,
    joinUrl: meetingResult.joinUrl,
    startDateTime: meetingResult.startDateTime,
    endDateTime: meetingResult.endDateTime,
    durationMinutes,
    participants: participants.map((participant) => ({
      userId: participant.userId,
      name: participant.name,
      email: participant.email,
      role: participant.role,
    })),
  });

  let inviteWarning = "";

  try {
    await sendProjectMeetingInviteEmail(
      participants.map((participant) => participant.email),
      {
        subject: meeting.subject,
        joinUrl: meeting.joinUrl,
        startDateTime: meeting.startDateTime,
        endDateTime: meeting.endDateTime,
        projectName: project.name,
      },
      {
        workspaceId: mailWorkspaceId,
      }
    );
  } catch (inviteError) {
    inviteWarning =
      "Meeting created, but invite emails could not be sent right now.";
    console.error("[project-meetings] Failed to send meeting invites", {
      projectId: String(project._id),
      error: inviteError?.message || inviteError,
    });
  }

  res.status(201).json({
    message: "Meeting scheduled successfully",
    meeting: serializeProjectMeeting(meeting),
    warning: inviteWarning || undefined,
  });
});

const getProjectMeetings = asyncHandler(async (req, res) => {
  if (!req.user) {
    res.status(401);
    throw new Error("Unauthorized");
  }

  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400);
    throw new Error("Invalid project id");
  }

  const project = await loadAccessibleProject(req.user, req.params.id);

  if (!project) {
    res.status(404);
    throw new Error("Project not found");
  }

  const workspaceId = normalizeWorkspaceId(req.user.workspaceId);
  const meetings = await ProjectMeeting.find({
    projectId: req.params.id,
    workspaceId,
    endDateTime: {
      $gte: new Date(),
    },
  })
    .sort({ startDateTime: 1 })
    .limit(8)
    .lean();

  res.status(200).json(meetings.map(serializeProjectMeeting).filter(Boolean));
});

module.exports = {
  getProjects,
  createProject,
  deleteProject,
  attachProjectTeam,
  detachProjectTeam,
  updateProjectStatus,
  scheduleProjectMeeting,
  getProjectMeetings,
};
