const dotenv = require("dotenv");

dotenv.config();

const { EMAIL_JOB_NAMES, emailQueue } = require("../queues/emailQueue");
const { sendIssueCreatedEmail } = require("../services/email/sendIssueCreatedEmail");

const workerConcurrency = Number(process.env.EMAIL_WORKER_CONCURRENCY || 3);

emailQueue.process(EMAIL_JOB_NAMES.ISSUE_CREATED, workerConcurrency, async (job) => {
  const result = await sendIssueCreatedEmail(job.data.issue);

  console.log("[worker] Issue-created email processed", {
    issueId: job.data?.issue?._id || null,
    provider: result?.provider || "skipped",
    skipped: Boolean(result?.skipped),
  });

  return result;
});

emailQueue.on("failed", (job, error) => {
  console.error("[worker] Email job failed", {
    jobId: job?.id || null,
    issueId: job?.data?.issue?._id || null,
    message: error.message,
  });
});

emailQueue.on("completed", (job, result) => {
  console.log("[worker] Email job completed", {
    jobId: job?.id || null,
    issueId: job?.data?.issue?._id || null,
    provider: result?.provider || null,
    skipped: Boolean(result?.skipped),
  });
});

const shutdown = async (signal) => {
  console.log(`[worker] Shutting down email worker (${signal})`);
  await emailQueue.close();
  process.exit(0);
};

process.on("SIGINT", () => {
  shutdown("SIGINT").catch((error) => {
    console.error("[worker] Failed to close cleanly", error);
    process.exit(1);
  });
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM").catch((error) => {
    console.error("[worker] Failed to close cleanly", error);
    process.exit(1);
  });
});

console.log("[worker] Email worker listening for jobs", {
  queue: "emailQueue",
  concurrency: workerConcurrency,
});
