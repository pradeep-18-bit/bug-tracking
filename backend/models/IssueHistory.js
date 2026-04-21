const mongoose = require("mongoose");

const { Schema, model, models } = mongoose;

const issueHistorySchema = new Schema(
  {
    issueId: {
      type: Schema.Types.ObjectId,
      ref: "Issue",
      required: [true, "Issue is required"],
      index: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: [true, "Project is required"],
      index: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Actor is required"],
      index: true,
    },
    eventType: {
      type: String,
      required: [true, "Event type is required"],
      trim: true,
      index: true,
    },
    field: {
      type: String,
      trim: true,
      default: "",
    },
    fromValue: {
      type: Schema.Types.Mixed,
      default: null,
    },
    toValue: {
      type: Schema.Types.Mixed,
      default: null,
    },
    meta: {
      type: Schema.Types.Mixed,
      default: {},
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
  },
  {
    versionKey: false,
  }
);

issueHistorySchema.index({ issueId: 1, createdAt: -1 });
issueHistorySchema.index({ projectId: 1, createdAt: -1 });

module.exports = models.IssueHistory || model("IssueHistory", issueHistorySchema);
