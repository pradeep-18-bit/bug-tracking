const mongoose = require("mongoose");

const { Schema, model, models } = mongoose;

const workspaceSettingSchema = new Schema(
  {
    workspaceId: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    workspaceSender: {
      userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      enabled: {
        type: Boolean,
        default: false,
      },
      updatedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      updatedAt: {
        type: Date,
        default: null,
      },
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

module.exports =
  models.WorkspaceSetting || model("WorkspaceSetting", workspaceSettingSchema);
