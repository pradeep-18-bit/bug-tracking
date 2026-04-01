const mongoose = require("mongoose");
const {
  ISSUE_STATUS,
  ISSUE_STATUS_VALUES,
  getCanonicalIssueStatus,
} = require("../utils/issueStatus");

const { Schema, model, models } = mongoose;

const issueSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, "Issue title is required"],
      trim: true,
      minlength: [3, "Issue title must be at least 3 characters long"],
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    type: {
      type: String,
      enum: {
        values: ["Bug", "Task", "Story"],
        message: "Type must be Bug, Task, or Story",
      },
      default: "Task",
    },
    status: {
      type: String,
      enum: {
        values: ISSUE_STATUS_VALUES,
        message: `Status must be ${ISSUE_STATUS_VALUES.join(", ")}`,
      },
      default: ISSUE_STATUS.TODO,
      set: (value) => getCanonicalIssueStatus(value),
    },
    priority: {
      type: String,
      enum: {
        values: ["Low", "Medium", "High"],
        message: "Priority must be Low, Medium, or High",
      },
      default: "Medium",
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: [true, "Project is required"],
      index: true,
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      default: null,
      index: true,
    },
    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Reporter is required"],
      index: true,
    },
    dueAt: {
      type: Date,
      default: null,
      index: true,
    },
    dependsOnIssueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Issue",
      default: null,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
    startedAt: {
      type: Date,
      default: null,
    },
  },
  {
    versionKey: false,
  }
);

issueSchema.index({ projectId: 1, teamId: 1, status: 1, priority: 1 });
issueSchema.index({ projectId: 1, dueAt: 1 });

module.exports = models.Issue || model("Issue", issueSchema);
