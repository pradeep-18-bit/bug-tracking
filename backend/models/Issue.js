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
const { BUG_SEVERITY_VALUES } = require("../utils/bugLifecycle");

const { Schema, model, models } = mongoose;

const bugDetailsSchema = new Schema(
  {
    moduleName: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    category: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    affectedPlatform: {
      type: String,
      trim: true,
      default: "",
    },
    suggestedTeam: {
      type: String,
      trim: true,
      default: "",
    },
    addToBucket: {
      type: Boolean,
      default: false,
      index: true,
    },
    estimatedEffort: {
      type: String,
      trim: true,
      default: "",
    },
    severity: {
      type: String,
      enum: {
        values: BUG_SEVERITY_VALUES,
        message: `Severity must be ${BUG_SEVERITY_VALUES.join(", ")}`,
      },
      default: null,
    },
    testerOwner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    developerLead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    stepsToReproduce: {
      type: String,
      trim: true,
      default: "",
    },
    expectedResult: {
      type: String,
      trim: true,
      default: "",
    },
    actualResult: {
      type: String,
      trim: true,
      default: "",
    },
    reopenReason: {
      type: String,
      trim: true,
      default: "",
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: "",
    },
    targetRelease: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    _id: false,
  }
);

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
        values: ["Low", "Medium", "High", "Critical"],
        message: "Priority must be Low, Medium, High, or Critical",
      },
      default: "Medium",
    },
    displayBugId: {
      type: String,
      trim: true,
      uppercase: true,
      default: undefined,
      index: true,
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
    bugDetails: {
      type: bugDetailsSchema,
      default: () => ({}),
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
      index: true,
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
issueSchema.index({ displayBugId: 1 }, { unique: true, sparse: true });
issueSchema.index({ projectId: 1, displayBugId: 1 });

module.exports = models.Issue || model("Issue", issueSchema);
