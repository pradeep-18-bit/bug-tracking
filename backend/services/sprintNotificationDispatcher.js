const { sendIssueNotificationEmail } = require("./emailService");
const {
  buildSprintStartedAssigneeEmail,
  buildSprintStartedStakeholderEmail,
  buildTaskAddedToActiveSprintEmail,
  buildAssigneeChangedInActiveSprintEmail,
} = require("./sprintNotificationTemplates");

const buildEmailFromNotification = (notification) => {
  switch (notification?.eventType) {
    case "SPRINT_STARTED_ASSIGNEE_SUMMARY":
      return buildSprintStartedAssigneeEmail(notification.payload);
    case "SPRINT_STARTED_STAKEHOLDER_SUMMARY":
      return buildSprintStartedStakeholderEmail(notification.payload);
    case "ISSUE_ADDED_TO_ACTIVE_SPRINT":
      return buildTaskAddedToActiveSprintEmail(notification.payload);
    case "ASSIGNEE_CHANGED_IN_ACTIVE_SPRINT":
      return buildAssigneeChangedInActiveSprintEmail(notification.payload);
    default:
      throw new Error(`Unsupported sprint notification event type: ${notification?.eventType || ""}`);
  }
};

const deliverSprintNotificationRecord = async (notification) => {
  if (!notification?.recipientEmail) {
    throw new Error("Notification recipient email is required");
  }

  const email = buildEmailFromNotification(notification);

  return sendIssueNotificationEmail({
    creatorUserId: notification.creatorUserId,
    workspaceId: notification.workspaceId,
    to: [notification.recipientEmail],
    cc: notification.payload?.ccEmails || [],
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
};

module.exports = {
  deliverSprintNotificationRecord,
};
