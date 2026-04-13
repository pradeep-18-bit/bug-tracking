const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "..", ".env"),
});

const nodemailer = require("nodemailer");

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

  return new Date(value).toLocaleString();
};

const getStatusLabel = (status = "") => {
  if (!status) {
    return "N/A";
  }

  return String(status)
    .split("_")
    .filter(Boolean)
    .map((segment) => segment.charAt(0) + segment.slice(1).toLowerCase())
    .join(" ");
};

const getEmailUser = () => (process.env.EMAIL_USER || "").trim();
const getEmailPass = () => (process.env.EMAIL_PASS || "").replace(/\s+/g, "");

const createTransporter = () => {
  const emailUser = getEmailUser();
  const emailPass = getEmailPass();

  console.log("EMAIL_USER:", emailUser);
  console.log("EMAIL_PASS loaded:", Boolean(emailPass));

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: emailUser,
      pass: emailPass,
    },
  });
};

const sendIssueEmail = async (emails, issue) => {
  const recipients = [...new Set((emails || []).filter(Boolean))];

  if (recipients.length === 0) {
    return;
  }

  const emailUser = getEmailUser();
  const emailPass = getEmailPass();

  if (!emailUser || !emailPass) {
    throw new Error("EMAIL_USER and EMAIL_PASS must be configured");
  }

  const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  const issueUrl = `${appUrl}/issues/${issue._id}`;

  const mailOptions = {
    from: `"Pirnav Workspace" <${emailUser}>`,
    to: recipients.join(","),
    subject: `New Issue Created: ${issue.title}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #2563EB;">New Issue Created</h2>

        <p><b>Title:</b> ${escapeHtml(issue.title)}</p>
        <p><b>Description:</b> ${escapeHtml(issue.description || "N/A")}</p>

        <hr />

        <p><b>Project:</b> ${escapeHtml(issue.projectName || "N/A")}</p>
        <p><b>Assigned To:</b> ${escapeHtml(issue.assigneeName || "Unassigned")}</p>
        <p><b>Priority:</b> ${escapeHtml(issue.priority || "Medium")}</p>
        <p><b>Status:</b> ${escapeHtml(getStatusLabel(issue.status))}</p>

        <hr />

        <p><b>Created At:</b> ${escapeHtml(formatDateTime(issue.createdAt))}</p>
        <p><b>Due Date:</b> ${escapeHtml(formatDateTime(issue.dueDate))}</p>

        <br />

        <a
          href="${escapeHtml(issueUrl)}"
          style="background: #2563EB; color: #fff; padding: 10px 16px; border-radius: 6px; text-decoration: none;"
        >
          View Issue
        </a>

        <p style="margin-top: 20px; color: #888; font-size: 12px;">
          Automated notification from Pirnav Workspace
        </p>
      </div>
    `,
  };

  const transporter = createTransporter();
  console.log("\uD83D\uDCE8 Sending email...");
  const info = await transporter.sendMail(mailOptions);
  console.log(`\u2705 Email sent: ${info.response}`);

  return info;
};

const sendProjectMeetingInviteEmail = async (emails, meeting) => {
  const recipients = [...new Set((emails || []).filter(Boolean))];

  if (recipients.length === 0) {
    return;
  }

  const emailUser = getEmailUser();
  const emailPass = getEmailPass();

  if (!emailUser || !emailPass) {
    throw new Error("EMAIL_USER and EMAIL_PASS must be configured");
  }

  const meetingTitleText = String(meeting?.subject || "Project team meeting").trim();
  const meetingTitle = escapeHtml(meetingTitleText || "Project team meeting");
  const projectName = escapeHtml(meeting?.projectName || "Project");
  const joinUrl = String(meeting?.joinUrl || "").trim();
  const hasJoinUrl = Boolean(joinUrl);

  const mailOptions = {
    from: `"Pirnav Workspace" <${emailUser}>`,
    to: recipients.join(","),
    subject: `Meeting Scheduled: ${meetingTitleText || "Project team meeting"}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #2563EB;">Team Meeting Scheduled</h2>

        <p><b>Project:</b> ${projectName}</p>
        <p><b>Title:</b> ${meetingTitle}</p>
        <p><b>Start:</b> ${escapeHtml(formatDateTime(meeting?.startDateTime))}</p>
        <p><b>End:</b> ${escapeHtml(formatDateTime(meeting?.endDateTime))}</p>

        ${
          hasJoinUrl
            ? `
          <br />
          <a
            href="${escapeHtml(joinUrl)}"
            style="background: #2563EB; color: #fff; padding: 10px 16px; border-radius: 6px; text-decoration: none;"
          >
            Join Microsoft Teams Meeting
          </a>
          <p style="margin-top: 12px; font-size: 12px; color: #64748B;">
            If the button does not work, copy this URL:
            <br />
            <a href="${escapeHtml(joinUrl)}">${escapeHtml(joinUrl)}</a>
          </p>
        `
            : ""
        }

        <p style="margin-top: 20px; color: #888; font-size: 12px;">
          Automated notification from Pirnav Workspace
        </p>
      </div>
    `,
  };

  const transporter = createTransporter();
  console.log("[meeting-email] Sending meeting invite...");
  const info = await transporter.sendMail(mailOptions);
  console.log(`[meeting-email] Invite sent: ${info.response}`);

  return info;
};

module.exports = {
  sendIssueEmail,
  sendProjectMeetingInviteEmail,
};
