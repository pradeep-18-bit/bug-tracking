const sgMail = require("@sendgrid/mail");
const nodemailer = require("nodemailer");

const statusLabelMap = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  DONE: "Done",
};

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatDateTime = (value) => {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
};

const getIssueStatusLabel = (status) => statusLabelMap[status] || status || "To Do";

const getIssueUrl = (issueId) => {
  const appUrl = (process.env.APP_URL || "http://localhost:5173").replace(/\/+$/, "");
  return `${appUrl}/issues/${issueId}`;
};

const buildIssueCreatedEmailHtml = (issue) => `
  <div style="font-family:Inter,Arial,sans-serif;padding:24px;background:#f8fafc;color:#0f172a;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
      <div style="padding:24px 24px 12px;background:linear-gradient(90deg,#2563EB,#0EA5E9);color:#ffffff;">
        <p style="margin:0;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.86;">Issue Notification</p>
        <h2 style="margin:10px 0 0;font-size:24px;line-height:1.25;">New Issue Created</h2>
      </div>

      <div style="padding:24px;">
        <p style="margin:0 0 16px;font-size:15px;color:#334155;">
          A new issue has been created and assigned to <strong>${escapeHtml(issue.assigneeName)}</strong>.
        </p>

        <div style="padding:16px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;">
          <p style="margin:0 0 8px;font-size:20px;font-weight:600;color:#0f172a;">${escapeHtml(issue.title)}</p>
          <p style="margin:0;font-size:14px;line-height:1.6;color:#475569;">${escapeHtml(
            issue.description || "No description provided."
          )}</p>
        </div>

        <div style="margin-top:20px;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;color:#334155;">
            <tbody>
              <tr>
                <td style="padding:8px 0;font-weight:600;width:160px;">Project</td>
                <td style="padding:8px 0;">${escapeHtml(issue.projectName)}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-weight:600;">Assigned To</td>
                <td style="padding:8px 0;">${escapeHtml(issue.assigneeName)}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-weight:600;">Priority</td>
                <td style="padding:8px 0;">${escapeHtml(issue.priority || "Medium")}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-weight:600;">Status</td>
                <td style="padding:8px 0;">${escapeHtml(getIssueStatusLabel(issue.status))}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-weight:600;">Created At</td>
                <td style="padding:8px 0;">${escapeHtml(formatDateTime(issue.createdAt))}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-weight:600;">Due Date</td>
                <td style="padding:8px 0;">${escapeHtml(formatDateTime(issue.dueAt))}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style="margin-top:28px;">
          <a href="${escapeHtml(
            getIssueUrl(issue._id)
          )}" style="display:inline-block;background:#2563EB;color:#ffffff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600;">
            View Issue
          </a>
        </div>
      </div>
    </div>
  </div>
`;

const buildIssueCreatedEmailText = (issue) =>
  [
    "New Issue Created",
    "",
    `Title: ${issue.title}`,
    `Description: ${issue.description || "No description provided."}`,
    `Project: ${issue.projectName}`,
    `Assigned To: ${issue.assigneeName}`,
    `Priority: ${issue.priority || "Medium"}`,
    `Status: ${getIssueStatusLabel(issue.status)}`,
    `Created At: ${formatDateTime(issue.createdAt)}`,
    `Due Date: ${formatDateTime(issue.dueAt)}`,
    "",
    `View Issue: ${getIssueUrl(issue._id)}`,
  ].join("\n");

const getGmailTransporter = () => {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });
};

const sendIssueCreatedEmail = async (issue) => {
  if (!issue?.assigneeEmail) {
    console.log("[email] Skipping issue-created email: missing assignee email", {
      issueId: issue?._id || null,
    });
    return {
      skipped: true,
      reason: "missing-assignee-email",
    };
  }

  const fromAddress = process.env.EMAIL_FROM || process.env.GMAIL_USER;

  if (!fromAddress) {
    throw new Error("EMAIL_FROM or GMAIL_USER must be configured");
  }

  const html = buildIssueCreatedEmailHtml(issue);
  const text = buildIssueCreatedEmailText(issue);
  const message = {
    to: issue.assigneeEmail,
    from: fromAddress,
    subject: `New Task: ${issue.title}`,
    html,
    text,
  };

  if (process.env.SENDGRID_API_KEY) {
    try {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      await sgMail.send(message);

      return {
        provider: "sendgrid",
      };
    } catch (error) {
      console.warn("[email] SendGrid failed, falling back to Gmail", {
        message: error.message,
      });
    }
  }

  const gmailTransporter = getGmailTransporter();

  if (!gmailTransporter) {
    throw new Error("No email transport available. Configure SendGrid or Gmail.");
  }

  await gmailTransporter.sendMail({
    from: fromAddress,
    to: message.to,
    subject: message.subject,
    html,
    text,
  });

  return {
    provider: process.env.SENDGRID_API_KEY ? "gmail-fallback" : "gmail",
  };
};

module.exports = {
  sendIssueCreatedEmail,
  buildIssueCreatedEmailHtml,
};
