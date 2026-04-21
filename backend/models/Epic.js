const mongoose = require("mongoose");
const { normalizeWorkspaceId } = require("../utils/workspace");

const { Schema, model, models } = mongoose;

const epicSchema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: [true, "Project is required"],
      index: true,
    },
    name: {
      type: String,
      required: [true, "Epic name is required"],
      trim: true,
      minlength: [2, "Epic name must be at least 2 characters long"],
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    color: {
      type: String,
      trim: true,
      default: "#3B82F6",
    },
    planningOrder: {
      type: Number,
      default: 1024,
      index: true,
    },
    workspaceId: {
      type: String,
      required: true,
      trim: true,
      index: true,
      default: normalizeWorkspaceId(),
    },
    status: {
      type: String,
      enum: {
        values: ["ACTIVE", "ARCHIVED"],
        message: "Epic status must be ACTIVE or ARCHIVED",
      },
      default: "ACTIVE",
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Created by user is required"],
      index: true,
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

epicSchema.pre("save", function updateEpicTimestamp(next) {
  this.updatedAt = new Date();
  next();
});

epicSchema.index({ workspaceId: 1, projectId: 1, planningOrder: 1 });
epicSchema.index({ projectId: 1, status: 1, planningOrder: 1 });
epicSchema.index({ projectId: 1, name: 1 }, { unique: true });

module.exports = models.Epic || model("Epic", epicSchema);
