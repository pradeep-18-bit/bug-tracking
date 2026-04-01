const mongoose = require("mongoose");

const { Schema, model, models } = mongoose;

const projectTeamSchema = new Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: [true, "Project id is required"],
      index: true,
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: [true, "Team id is required"],
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

projectTeamSchema.index({ projectId: 1, teamId: 1 }, { unique: true });

module.exports = models.ProjectTeam || model("ProjectTeam", projectTeamSchema);
