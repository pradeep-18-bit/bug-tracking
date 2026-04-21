const mongoose = require("mongoose");
const { normalizeWorkspaceId } = require("../utils/workspace");

const { Schema, model, models } = mongoose;

const projectSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Project name is required"],
      trim: true,
      minlength: [2, "Project name must be at least 2 characters long"],
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    epics: {
      type: [
        {
          type: String,
          trim: true,
        },
      ],
      default: [],
    },
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    teamLead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    workspaceId: {
      type: String,
      required: true,
      trim: true,
      index: true,
      default: normalizeWorkspaceId(),
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Created by user is required"],
      index: true,
    },
    isCompleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    notificationSettings: {
      sprintNotificationsEnabled: {
        type: Boolean,
        default: undefined,
      },
      stakeholderUserIds: [
        {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      stakeholderEmails: [
        {
          type: String,
          trim: true,
          lowercase: true,
        },
      ],
      ccEmails: [
        {
          type: String,
          trim: true,
          lowercase: true,
        },
      ],
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

projectSchema.index({ workspaceId: 1, createdAt: -1 });
projectSchema.index({ workspaceId: 1, createdBy: 1, createdAt: -1 });

module.exports = models.Project || model("Project", projectSchema);
