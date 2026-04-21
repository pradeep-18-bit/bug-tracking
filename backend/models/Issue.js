const mongoose = require("mongoose");
const {
  ISSUE_STATUS,
  ISSUE_STATUS_VALUES,
  getCanonicalIssueStatus,
} = require("../utils/issueStatus");
const {
  ISSUE_TYPES,
  ISSUE_TYPE_VALUES,
  getCanonicalIssueType,
} = require("../utils/issueTypes");

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
        values: ISSUE_TYPE_VALUES,
        message: `Type must be ${ISSUE_TYPE_VALUES.join(", ")}`,
      },
      default: ISSUE_TYPES.TASK,
      set: (value) => getCanonicalIssueType(value),
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
    epicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Epic",
      default: null,
      index: true,
    },
    sprintId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sprint",
      default: null,
      index: true,
    },
    planningOrder: {
      type: Number,
      default: 1024,
      index: true,
    },
    storyPoints: {
      type: Number,
      default: null,
      min: [0, "Story points cannot be negative"],
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
issueSchema.index({ projectId: 1, sprintId: 1, planningOrder: 1 });
issueSchema.index({ projectId: 1, epicId: 1, planningOrder: 1 });
issueSchema.index({ assignee: 1, sprintId: 1, status: 1 });

module.exports = models.Issue || model("Issue", issueSchema);
