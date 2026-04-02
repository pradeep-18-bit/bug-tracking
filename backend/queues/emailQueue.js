const Queue = require("bull");
const { getRedisConfig } = require("../utils/redis");

const EMAIL_JOB_NAMES = {
  ISSUE_CREATED: "issue-created",
};

const emailQueue = new Queue("emailQueue", {
  redis: getRedisConfig(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

emailQueue.on("error", (error) => {
  console.error("[queue] Email queue error:", error.message);
});

const queueIssueCreatedEmail = (issue) =>
  emailQueue.add(
    EMAIL_JOB_NAMES.ISSUE_CREATED,
    { issue },
    {
      jobId: `issue-created:${issue._id}:${Date.now()}`,
    }
  );

module.exports = {
  emailQueue,
  EMAIL_JOB_NAMES,
  queueIssueCreatedEmail,
};
