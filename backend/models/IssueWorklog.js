const mongoose = require("mongoose");

const { Schema, model, models } = mongoose;

const issueWorklogSchema = new Schema(
  {
    issueId: {
      type: Schema.Types.ObjectId,
      ref: "Issue",
      required: [true, "Issue is required"],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
      index: true,
    },
    minutes: {
      type: Number,
      required: [true, "Logged minutes are required"],
      min: [1, "Logged minutes must be at least 1"],
    },
    note: {
      type: String,
      trim: true,
      default: "",
    },
    loggedAt: {
      type: Date,
      required: [true, "Logged time is required"],
    },
    sprintId: {
      type: Schema.Types.ObjectId,
      ref: "Sprint",
      default: null,
      index: true,
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

issueWorklogSchema.index({ issueId: 1, loggedAt: -1 });
issueWorklogSchema.index({ sprintId: 1, createdAt: -1 });

module.exports = models.IssueWorklog || model("IssueWorklog", issueWorklogSchema);
