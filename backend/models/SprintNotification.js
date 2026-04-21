const mongoose = require("mongoose");
const { normalizeWorkspaceId } = require("../utils/workspace");

const { Schema, model, models } = mongoose;

const SPRINT_NOTIFICATION_EVENT_TYPES = Object.freeze([
  "SPRINT_STARTED_ASSIGNEE_SUMMARY",
  "SPRINT_STARTED_STAKEHOLDER_SUMMARY",
  "ISSUE_ADDED_TO_ACTIVE_SPRINT",
  "ASSIGNEE_CHANGED_IN_ACTIVE_SPRINT",
]);

const SPRINT_NOTIFICATION_STATUSES = Object.freeze([
  "pending",
  "processing",
  "sent",
  "failed",
]);

const sprintNotificationSchema = new Schema(
  {
    eventType: {
      type: String,
      enum: {
        values: SPRINT_NOTIFICATION_EVENT_TYPES,
        message: `Event type must be ${SPRINT_NOTIFICATION_EVENT_TYPES.join(", ")}`,
      },
      required: true,
      index: true,
    },
    sprintId: {
      type: Schema.Types.ObjectId,
      ref: "Sprint",
      required: true,
      index: true,
    },
    issueId: {
      type: Schema.Types.ObjectId,
      ref: "Issue",
      default: null,
      index: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    recipientUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    recipientEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    dedupeKey: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: SPRINT_NOTIFICATION_STATUSES,
        message: `Status must be ${SPRINT_NOTIFICATION_STATUSES.join(", ")}`,
      },
      default: "pending",
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
      min: 1,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    lastAttemptAt: {
      type: Date,
      default: null,
    },
    nextAttemptAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    errorMessage: {
      type: String,
      trim: true,
      default: "",
    },
    creatorUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    payload: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
    workspaceId: {
      type: String,
      required: true,
      trim: true,
      index: true,
      default: normalizeWorkspaceId(),
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
  }
);

sprintNotificationSchema.pre("save", function updateTimestamp(next) {
  this.updatedAt = new Date();
  next();
});

sprintNotificationSchema.index({ status: 1, nextAttemptAt: 1, createdAt: 1 });
sprintNotificationSchema.index({ sprintId: 1, createdAt: -1 });
sprintNotificationSchema.index({ recipientUserId: 1, status: 1, createdAt: -1 });

module.exports = models.SprintNotification || model("SprintNotification", sprintNotificationSchema);
module.exports.SPRINT_NOTIFICATION_EVENT_TYPES = SPRINT_NOTIFICATION_EVENT_TYPES;
module.exports.SPRINT_NOTIFICATION_STATUSES = SPRINT_NOTIFICATION_STATUSES;
