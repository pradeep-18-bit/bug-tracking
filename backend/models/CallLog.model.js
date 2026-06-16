const mongoose = require("mongoose");
const { normalizeWorkspaceId } = require("../utils/workspace");

const { Schema, model, models } = mongoose;

const callLogSchema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    callerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    receiverId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    participants: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      default: [],
      index: true,
    },
    workspaceId: {
      type: String,
      required: true,
      trim: true,
      index: true,
      default: normalizeWorkspaceId(),
    },
    callType: {
      type: String,
      enum: ["audio", "video"],
      required: true,
    },
    startTime: {
      type: Date,
      default: null,
    },
    endTime: {
      type: Date,
      default: null,
    },
    duration: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ["Ringing", "Answered", "Rejected", "Missed", "Ended"],
      default: "Ringing",
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

callLogSchema.index({ workspaceId: 1, participants: 1, createdAt: -1 });
callLogSchema.index({ conversationId: 1, createdAt: -1 });

module.exports = models.CallLog || model("CallLog", callLogSchema);
