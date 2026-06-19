const mongoose = require("mongoose");

const { Schema, model, models } = mongoose;

const userActivitySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
      index: true,
    },
    workspaceId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    loginTime: {
      type: Date,
      default: null,
    },
    logoutTime: {
      type: Date,
      default: null,
    },
    lastActiveTime: {
      type: Date,
      default: null,
      index: true,
    },
    totalActiveMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalIdleMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalLoginMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    currentStatus: {
      type: String,
      enum: ["active", "idle", "away", "offline"],
      default: "offline",
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

userActivitySchema.index({ userId: 1, date: 1 }, { unique: true });
userActivitySchema.index({ workspaceId: 1, date: 1, currentStatus: 1 });

module.exports = models.UserActivity || model("UserActivity", userActivitySchema);
