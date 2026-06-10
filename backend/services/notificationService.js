const Notification = require("../models/Notification");
const User = require("../models/User");
const TeamMember = require("../models/TeamMember");
const { emitToUser } = require("../socket");

/**
 * Creates a notification for a specific user, saves to DB, and emits via Socket.IO
 */
const createNotification = async ({
  recipientId,
  text,
  type,
  relatedId = null,
  onModel = "Issue",
  link = "",
}) => {
  if (!recipientId || !text) return null;

  try {
    const notification = await Notification.create({
      recipientId,
      text,
      type,
      relatedId,
      onModel,
      link,
    });

    emitToUser(recipientId, "notification_received", notification);

    return notification;
  } catch (error) {
    console.error("[notificationService] Error creating notification:", error);
    return null;
  }
};

/**
 * Logic for notifying about issue-related events
 */
const notifyIssueEvent = async ({
  issue,
  eventType, // 'assignment', 'status_change', 'team_queue'
  actorId,
  oldAssigneeId = null,
}) => {
  const issueKey = issue.displayBugId || issue.issueKey || "Item";
  const issueTitle = issue.title;
  const link = `/issues?search=${issueKey}`;

  if (eventType === "assignment") {
    // Notify new assignee
    const currentAssigneeId = issue.assignee?._id || issue.assignee;
    if (currentAssigneeId && String(currentAssigneeId) !== String(actorId)) {
      await createNotification({
        recipientId: currentAssigneeId,
        text: `${issue.type} ${issueKey} assigned to you.`,
        type: "assignment",
        relatedId: issue._id,
        link,
      });
    }

    // Notify old assignee if reassigned
    if (oldAssigneeId && String(oldAssigneeId) !== String(currentAssigneeId) && String(oldAssigneeId) !== String(actorId)) {
      await createNotification({
        recipientId: oldAssigneeId,
        text: `${issue.type} ${issueKey} has been reassigned.`,
        type: "assignment",
        relatedId: issue._id,
        link,
      });
    }
  }

  if (eventType === "status_change") {
    // Notify assignee about status change if actor is someone else
    const currentAssigneeId = issue.assignee?._id || issue.assignee;
    if (currentAssigneeId && String(currentAssigneeId) !== String(actorId)) {
      const statusLabel =
        issue.type === "Bug"
          ? (require("../utils/bugLifecycle").BUG_STATUS_LABELS[issue.status] || issue.status)
          : issue.status;

      await createNotification({
        recipientId: currentAssigneeId,
        text: `${issue.type} "${issueTitle}" moved to ${statusLabel}.`,
        type: "status_change",
        relatedId: issue._id,
        link,
      });
    }
  }

  if (eventType === "team_queue") {
    // Notify all developers in the team if it's an available bug
    if (issue.teamId && issue.type === "Bug") {
      const teamMembers = await TeamMember.find({ teamId: issue.teamId }).lean();
      const developers = teamMembers.map((m) => m.userId);

      for (const devId of developers) {
        if (String(devId) === String(actorId)) continue;

        await createNotification({
          recipientId: devId,
          text: `New bug ${issueKey} added to your team's queue.`,
          type: "team_queue",
          relatedId: issue._id,
          link,
        });
      }
    }
  }
};

/**
 * Logic for notifying about sprint-related events
 */
const notifySprintEvent = async ({
  sprint,
  eventType, // 'started', 'ended', 'goal_updated'
  actorId,
}) => {
  if (!sprint.teamId) return;

  const teamMembers = await TeamMember.find({ teamId: sprint.teamId }).lean();
  const recipients = teamMembers.map(m => m.userId);
  const sprintName = sprint.name;
  const link = `/backlog?projectId=${sprint.projectId}`;

  let text = "";
  if (eventType === "started") text = `Sprint "${sprintName}" has started.`;
  else if (eventType === "ended") text = `Sprint "${sprintName}" has ended.`;
  else if (eventType === "goal_updated") text = `Goal for Sprint "${sprintName}" was updated.`;

  if (!text) return;

  for (const recipientId of recipients) {
    if (String(recipientId) === String(actorId)) continue;

    await createNotification({
      recipientId,
      text,
      type: "sprint",
      relatedId: sprint._id,
      onModel: "Sprint",
      link,
    });
  }
};

module.exports = {
  createNotification,
  notifyIssueEvent,
  notifySprintEvent,
};
