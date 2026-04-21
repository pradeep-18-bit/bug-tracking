const mongoose = require("mongoose");
const Epic = require("../models/Epic");
const Issue = require("../models/Issue");
const asyncHandler = require("../utils/asyncHandler");
const {
  canManageProjectPlanning,
  loadReadableProject,
} = require("../utils/backlogAccess");
const { PLANNING_ORDER_INCREMENT } = require("../utils/planningOrder");
const { normalizeWorkspaceId } = require("../utils/workspace");

const loadEpicWithProject = async (epicId) =>
  Epic.findById(epicId)
    .populate("projectId", "name workspaceId createdBy manager teamLead")
    .lean();

const getEpics = asyncHandler(async (req, res) => {
  const { projectId } = req.query;

  if (!projectId || !mongoose.isValidObjectId(projectId)) {
    res.status(400);
    throw new Error("A valid project id is required");
  }

  const project = await loadReadableProject(req.user, projectId);

  if (!project) {
    res.status(404);
    throw new Error("Project not found or inaccessible");
  }

  const epics = await Epic.find({
    projectId,
    workspaceId: normalizeWorkspaceId(req.user.workspaceId),
  })
    .sort({
      planningOrder: 1,
      createdAt: 1,
    })
    .lean();

  res.status(200).json(epics);
});

const createEpic = asyncHandler(async (req, res) => {
  const { projectId, name, description = "", color = "#3B82F6" } = req.body;

  if (!projectId || !mongoose.isValidObjectId(projectId)) {
    res.status(400);
    throw new Error("A valid project id is required");
  }

  if (!name || !String(name).trim()) {
    res.status(400);
    throw new Error("Epic name is required");
  }

  const project = await loadReadableProject(req.user, projectId);

  if (!project) {
    res.status(404);
    throw new Error("Project not found or inaccessible");
  }

  if (!canManageProjectPlanning(req.user, project)) {
    res.status(403);
    throw new Error("You do not have permission to manage epics for this project");
  }

  const lastEpic = await Epic.findOne({
    projectId,
  })
    .sort({
      planningOrder: -1,
      createdAt: -1,
    })
    .select("planningOrder")
    .lean();

  const epic = await Epic.create({
    projectId,
    workspaceId: normalizeWorkspaceId(req.user.workspaceId),
    name: String(name).trim(),
    description: typeof description === "string" ? description.trim() : "",
    color: typeof color === "string" && color.trim() ? color.trim() : "#3B82F6",
    planningOrder: (lastEpic?.planningOrder || 0) + PLANNING_ORDER_INCREMENT,
    status: "ACTIVE",
    createdBy: req.user._id,
  });

  res.status(201).json(epic);
});

const updateEpic = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400);
    throw new Error("Invalid epic id");
  }

  const epic = await Epic.findById(req.params.id);

  if (!epic) {
    res.status(404);
    throw new Error("Epic not found");
  }

  const project = await loadReadableProject(req.user, epic.projectId);

  if (!project) {
    res.status(404);
    throw new Error("Project not found or inaccessible");
  }

  if (!canManageProjectPlanning(req.user, project)) {
    res.status(403);
    throw new Error("You do not have permission to update epics for this project");
  }

  ["name", "description", "color", "status"].forEach((field) => {
    if (typeof req.body[field] !== "undefined") {
      epic[field] =
        typeof req.body[field] === "string" ? req.body[field].trim() : req.body[field];
    }
  });

  await epic.save();

  res.status(200).json(epic);
});

const deleteEpic = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400);
    throw new Error("Invalid epic id");
  }

  const epic = await loadEpicWithProject(req.params.id);

  if (!epic) {
    res.status(404);
    throw new Error("Epic not found");
  }

  if (!canManageProjectPlanning(req.user, epic.projectId)) {
    res.status(403);
    throw new Error("You do not have permission to delete epics for this project");
  }

  const linkedIssues = await Issue.find({
    epicId: epic._id,
  })
    .select("_id")
    .lean();

  if (linkedIssues.length) {
    const replacementEpicId = req.body?.replacementEpicId || "";
    const clearIssues = Boolean(req.body?.clearIssues);

    if (!replacementEpicId && !clearIssues) {
      res.status(409);
      throw new Error(
        "This epic still has linked issues. Reassign or clear them before deletion."
      );
    }

    if (replacementEpicId) {
      if (!mongoose.isValidObjectId(replacementEpicId)) {
        res.status(400);
        throw new Error("Invalid replacement epic id");
      }

      if (String(replacementEpicId) === String(epic._id)) {
        res.status(400);
        throw new Error("Replacement epic must be different from the deleted epic");
      }

      const replacementEpic = await Epic.findOne({
        _id: replacementEpicId,
        projectId: epic.projectId._id,
      })
        .select("_id")
        .lean();

      if (!replacementEpic) {
        res.status(404);
        throw new Error("Replacement epic could not be found in this project");
      }

      await Issue.updateMany(
        {
          epicId: epic._id,
        },
        {
          $set: {
            epicId: replacementEpic._id,
          },
        }
      );
    } else {
      await Issue.updateMany(
        {
          epicId: epic._id,
        },
        {
          $set: {
            epicId: null,
          },
        }
      );
    }
  }

  await Epic.deleteOne({
    _id: epic._id,
  });

  res.status(200).json({
    message: "Epic deleted successfully",
  });
});

module.exports = {
  getEpics,
  createEpic,
  updateEpic,
  deleteEpic,
};
