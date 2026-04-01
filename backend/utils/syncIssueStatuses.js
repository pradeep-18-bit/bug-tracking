const Issue = require("../models/Issue");
const { getCanonicalIssueStatus } = require("./issueStatus");

const syncIssueStatuses = async () => {
  const issues = await Issue.find({})
    .select("_id status")
    .lean();

  const operations = issues
    .map((issue) => {
      const normalizedStatus = getCanonicalIssueStatus(issue.status);

      if (String(issue.status) === normalizedStatus) {
        return null;
      }

      return {
        updateOne: {
          filter: { _id: issue._id },
          update: { $set: { status: normalizedStatus } },
        },
      };
    })
    .filter(Boolean);

  if (!operations.length) {
    return;
  }

  await Issue.bulkWrite(operations, { ordered: false });
  console.log(`[issues] normalized ${operations.length} legacy issue statuses`);
};

module.exports = syncIssueStatuses;
