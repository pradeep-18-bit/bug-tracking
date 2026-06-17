const mongoose = require("mongoose");

const { Schema, model, models } = mongoose;

const callParticipantSchema = new Schema(
  {
    callId: {
      type: Schema.Types.ObjectId,
      ref: "CallLog",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    joinedAt: {
      type: Date,
      default: null,
    },
    leftAt: {
      type: Date,
      default: null,
    },
    role: {
      type: String,
      enum: ["host", "participant"],
      default: "participant",
    },
    status: {
      type: String,
      enum: ["Invited", "Joined", "Declined", "Missed", "Left"],
      default: "Invited",
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

callParticipantSchema.index({ callId: 1, userId: 1 }, { unique: true });

module.exports =
  models.CallParticipant || model("CallParticipant", callParticipantSchema);
