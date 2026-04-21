const Epic = require("../models/Epic");
const Project = require("../models/Project");
const { normalizeWorkspaceId } = require("./workspace");
const { PLANNING_ORDER_INCREMENT } = require("./planningOrder");

const syncProjectEpics = async () => {
  const projects = await Project.find({})
    .select("_id epics createdBy workspaceId")
    .lean();

  for (const project of projects) {
    if (!Array.isArray(project.epics) || !project.epics.length) {
      continue;
    }

    const existingEpics = await Epic.find({
      projectId: project._id,
    })
      .select("_id name")
      .lean();
    const existingByName = new Map(
      existingEpics.map((epic) => [String(epic.name || "").trim().toLowerCase(), epic])
    );
    const bulkOperations = [];

    project.epics.forEach((epicName, index) => {
      const normalizedName = String(epicName || "").trim();

      if (!normalizedName) {
        return;
      }

      if (existingByName.has(normalizedName.toLowerCase())) {
        return;
      }

      bulkOperations.push({
        insertOne: {
          document: {
            projectId: project._id,
            name: normalizedName,
            description: "",
            color: "#3B82F6",
            planningOrder: (index + 1) * PLANNING_ORDER_INCREMENT,
            status: "ACTIVE",
            createdBy: project.createdBy,
            workspaceId: normalizeWorkspaceId(project.workspaceId),
          },
        },
      });
    });

    if (bulkOperations.length) {
      await Epic.bulkWrite(bulkOperations);
    }
  }
};

module.exports = syncProjectEpics;
