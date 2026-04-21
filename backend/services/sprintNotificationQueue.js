const SprintNotification = require("../models/SprintNotification");
const { deliverSprintNotificationRecord } = require("./sprintNotificationDispatcher");

const RETRY_BASE_DELAY_MS = 60 * 1000;
const MAX_PARALLEL_DELIVERIES = 5;
const QUEUE_POLL_INTERVAL_MS = 15 * 1000;
const activeDeliveries = new Set();
let pollerStarted = false;

const stringifyId = (value) => String(value || "");

const getNextRetryAt = (attempts = 1) =>
  new Date(Date.now() + RETRY_BASE_DELAY_MS * Math.max(1, attempts));

const claimNotificationForProcessing = async (notificationId) =>
  SprintNotification.findOneAndUpdate(
    {
      _id: notificationId,
      status: {
        $in: ["pending", "failed"],
      },
      $or: [{ nextAttemptAt: null }, { nextAttemptAt: { $lte: new Date() } }],
    },
    {
      $set: {
        status: "processing",
        lastAttemptAt: new Date(),
        errorMessage: "",
      },
      $inc: {
        attempts: 1,
      },
    },
    {
      new: true,
    }
  ).lean();

const markNotificationSent = async (notificationId) =>
  SprintNotification.updateOne(
    {
      _id: notificationId,
    },
    {
      $set: {
        status: "sent",
        sentAt: new Date(),
        errorMessage: "",
        nextAttemptAt: null,
        updatedAt: new Date(),
      },
    }
  );

const markNotificationFailed = async (notification, error) => {
  const attempts = Number(notification?.attempts || 1);
  const maxAttempts = Number(notification?.maxAttempts || 5);
  const hasRemainingAttempts = attempts < maxAttempts;

  await SprintNotification.updateOne(
    {
      _id: notification._id,
    },
    {
      $set: {
        status: "failed",
        errorMessage: String(error?.message || "Unable to send sprint notification").slice(
          0,
          2000
        ),
        nextAttemptAt: hasRemainingAttempts ? getNextRetryAt(attempts) : null,
        updatedAt: new Date(),
      },
    }
  );
};

const processSprintNotification = async (notificationId) => {
  const normalizedId = stringifyId(notificationId);

  if (!normalizedId || activeDeliveries.has(normalizedId)) {
    return;
  }

  activeDeliveries.add(normalizedId);

  try {
    const notification = await claimNotificationForProcessing(notificationId);

    if (!notification) {
      return;
    }

    console.info("[sprint-notifications] delivering notification", {
      notificationId: normalizedId,
      eventType: notification.eventType,
      sprintId: String(notification.sprintId || ""),
      issueId: String(notification.issueId || ""),
      recipientEmail: notification.recipientEmail || "",
      attempt: Number(notification.attempts || 0),
    });

    await deliverSprintNotificationRecord(notification);
    await markNotificationSent(notification._id);

    console.info("[sprint-notifications] notification sent", {
      notificationId: normalizedId,
      eventType: notification.eventType,
      recipientEmail: notification.recipientEmail || "",
    });
  } catch (error) {
    console.error("[sprint-notifications] delivery failed", {
      notificationId: normalizedId,
      message: error.message,
    });

    const failedNotification = await SprintNotification.findById(notificationId)
      .select("_id attempts maxAttempts")
      .lean();

    if (failedNotification) {
      await markNotificationFailed(failedNotification, error);
    }
  } finally {
    activeDeliveries.delete(normalizedId);
  }
};

const enqueueSprintNotification = (notificationId) => {
  if (!notificationId) {
    return;
  }

  setImmediate(() => {
    processSprintNotification(notificationId).catch((error) => {
      console.error("[sprint-notifications] enqueue failure", {
        notificationId: stringifyId(notificationId),
        message: error.message,
      });
    });
  });
};

const drainPendingSprintNotifications = async () => {
  if (activeDeliveries.size >= MAX_PARALLEL_DELIVERIES) {
    return;
  }

  const availableSlots = MAX_PARALLEL_DELIVERIES - activeDeliveries.size;
  const notifications = await SprintNotification.find({
    status: {
      $in: ["pending", "failed"],
    },
    $or: [{ nextAttemptAt: null }, { nextAttemptAt: { $lte: new Date() } }],
  })
    .select("_id")
    .sort({
      createdAt: 1,
    })
    .limit(availableSlots)
    .lean();

  notifications.forEach((notification) => enqueueSprintNotification(notification._id));
};

const startSprintNotificationWorker = () => {
  if (pollerStarted) {
    return;
  }

  pollerStarted = true;
  console.info("[sprint-notifications] worker started", {
    pollIntervalMs: QUEUE_POLL_INTERVAL_MS,
    maxParallelDeliveries: MAX_PARALLEL_DELIVERIES,
  });
  const interval = setInterval(() => {
    drainPendingSprintNotifications().catch((error) => {
      console.error("[sprint-notifications] poller failure", {
        message: error.message,
      });
    });
  }, QUEUE_POLL_INTERVAL_MS);

  if (typeof interval.unref === "function") {
    interval.unref();
  }

  drainPendingSprintNotifications().catch((error) => {
    console.error("[sprint-notifications] initial drain failure", {
      message: error.message,
    });
  });
};

module.exports = {
  enqueueSprintNotification,
  startSprintNotificationWorker,
  processSprintNotification,
};
