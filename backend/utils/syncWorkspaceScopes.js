const Project = require("../models/Project");
const User = require("../models/User");
const { LEGACY_WORKSPACE_ID, normalizeWorkspaceId } = require("./workspace");

const missingWorkspaceQuery = {
  $or: [
    { workspaceId: { $exists: false } },
    { workspaceId: null },
    { workspaceId: "" },
  ],
};

const syncWorkspaceScopes = async () => {
  const updatedUsers = await User.updateMany(missingWorkspaceQuery, {
    $set: {
      workspaceId: LEGACY_WORKSPACE_ID,
    },
  });

  const projectsMissingWorkspace = await Project.find(missingWorkspaceQuery)
    .select("_id createdBy")
    .lean();

  let updatedProjects = 0;

  if (projectsMissingWorkspace.length) {
    const creatorIds = Array.from(
      new Set(
        projectsMissingWorkspace
          .map((project) => String(project.createdBy || ""))
          .filter(Boolean)
      )
    );

    const creators = creatorIds.length
      ? await User.find({
          _id: {
            $in: creatorIds,
          },
        })
          .select("_id workspaceId")
          .lean()
      : [];

    const creatorWorkspaceMap = new Map(
      creators.map((user) => [String(user._id), normalizeWorkspaceId(user.workspaceId)])
    );

    const operations = projectsMissingWorkspace.map((project) => ({
      updateOne: {
        filter: {
          _id: project._id,
        },
        update: {
          $set: {
            workspaceId:
              creatorWorkspaceMap.get(String(project.createdBy || "")) ||
              LEGACY_WORKSPACE_ID,
          },
        },
      },
    }));

    if (operations.length) {
      const result = await Project.bulkWrite(operations, {
        ordered: false,
      });

      updatedProjects = result.modifiedCount || result.nModified || 0;
    }
  }

  if ((updatedUsers.modifiedCount || 0) || updatedProjects) {
    console.log("[workspace] Backfilled workspace scopes:", {
      users: updatedUsers.modifiedCount || 0,
      projects: updatedProjects,
    });
  }
};

module.exports = syncWorkspaceScopes;
