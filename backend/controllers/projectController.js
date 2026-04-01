const mongoose = require("mongoose");
const Issue = require("../models/Issue");
const Project = require("../models/Project");
const ProjectTeam = require("../models/ProjectTeam");
const Team = require("../models/Team");
const asyncHandler = require("../utils/asyncHandler");
const {
  buildProjectAccessQuery,
  loadSerializedProjectById,
  serializeProjectsWithRelations,
} = require("../utils/projectRelations");
const { normalizeWorkspaceId } = require("../utils/workspace");

const projectPopulation = [{ path: "createdBy", select: "name email role workspaceId" }];

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

const buildProjectQuery = async (user) => {
  const accessQuery = await buildProjectAccessQuery(user);

  if (user.role === "Admin") {
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
  const { name, description = "" } = req.body;

  if (!userId) {
    res.status(401);
    throw new Error("Unauthorized");
  }

  if (req.user.role !== "Admin") {
    res.status(403);
    throw new Error("Only admins can create projects");
  }

  if (!name || !name.trim()) {
    res.status(400);
    throw new Error("Project name is required");
  }

  const project = await Project.create({
    name: name.trim(),
    description: typeof description === "string" ? description.trim() : "",
    workspaceId,
    createdBy: userId,
    isCompleted: false,
  });

  res.status(201).json(await buildProjectResponse(project._id));
});

const attachProjectTeam = asyncHandler(async (req, res) => {
  if (!req.user) {
    res.status(401);
    throw new Error("Unauthorized");
  }

  if (req.user.role !== "Admin") {
    res.status(403);
    throw new Error("Only admins can attach teams to projects");
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

  if (req.user.role !== "Admin") {
    res.status(403);
    throw new Error("Only admins can detach teams from projects");
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

  if (req.user.role !== "Admin") {
    res.status(403);
    throw new Error("Only admins can update project status");
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

module.exports = {
  getProjects,
  createProject,
  attachProjectTeam,
  detachProjectTeam,
  updateProjectStatus,
};
