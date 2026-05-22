const Issue = require("../models/Issue");
const Project = require("../models/Project");
const {
  buildDisplayId,
  ensureProjectShortCode,
  normalizeShortCode,
} = require("./displayIds");

const parseDisplaySequence = (displayId = "", shortCode = "") => {
  const normalizedShortCode = normalizeShortCode(shortCode);
  const match = String(displayId || "").match(/^([A-Z0-9]+)-(\d+)$/i);

  if (!match || normalizeShortCode(match[1]) !== normalizedShortCode) {
    return 0;
  }

  const sequence = Number.parseInt(match[2], 10);

  return Number.isFinite(sequence) ? sequence : 0;
};

const backfillProjectIssueDisplayIds = async (project) => {
  const shortCode = await ensureProjectShortCode({
    Project,
    project,
  });
  const issues = await Issue.find({
    projectId: project._id,
  })
    .select("_id displayBugId createdAt")
    .sort({
      createdAt: 1,
      _id: 1,
    })
    .lean();
  const usedSequences = new Set();
  let maxSequence = Number(project.issueSequence || 0);

  issues.forEach((issue) => {
    const sequence = parseDisplaySequence(issue.displayBugId, shortCode);

    if (!sequence) {
      return;
    }

    usedSequences.add(sequence);
    maxSequence = Math.max(maxSequence, sequence);
  });

  let nextSequence = 1;
  const operations = [];

  issues.forEach((issue) => {
    if (issue.displayBugId) {
      return;
    }

    while (usedSequences.has(nextSequence)) {
      nextSequence += 1;
    }

    const displayBugId = buildDisplayId(shortCode, nextSequence);
    operations.push({
      updateOne: {
        filter: {
          _id: issue._id,
          $or: [
            {
              displayBugId: {
                $exists: false,
              },
            },
            {
              displayBugId: null,
            },
            {
              displayBugId: "",
            },
          ],
        },
        update: {
          $set: {
            displayBugId,
          },
        },
      },
    });
    usedSequences.add(nextSequence);
    maxSequence = Math.max(maxSequence, nextSequence);
    nextSequence += 1;
  });

  if (operations.length) {
    await Issue.bulkWrite(operations, {
      ordered: true,
    });
  }

  if (maxSequence) {
    await Project.updateOne(
      {
        _id: project._id,
      },
      {
        $max: {
          issueSequence: maxSequence,
        },
      }
    );
  }

  return operations.length;
};

const syncIssueDisplayIds = async () => {
  const projects = await Project.find({})
    .select("_id name workspaceId shortCode issueSequence createdAt")
    .sort({
      createdAt: 1,
      _id: 1,
    });
  let updatedIssueCount = 0;

  for (const project of projects) {
    updatedIssueCount += await backfillProjectIssueDisplayIds(project);
  }

  if (updatedIssueCount) {
    console.log(`[startup] Backfilled ${updatedIssueCount} issue display id(s)`);
  }
};

module.exports = syncIssueDisplayIds;
