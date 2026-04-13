const express = require("express");
const {
  getProjects,
  createProject,
  attachProjectTeam,
  detachProjectTeam,
  updateProjectStatus,
  scheduleProjectMeeting,
  getProjectMeetings,
} = require("../controllers/projectController");
const auth = require("../middleware/auth");

const router = express.Router();

router.get("/", auth, getProjects);
router.post("/", auth, createProject);
router.post("/:id/teams", auth, attachProjectTeam);
router.delete("/:id/teams/:teamId", auth, detachProjectTeam);
router.patch("/:id/status", auth, updateProjectStatus);
router.get("/:id/meetings", auth, getProjectMeetings);
router.post("/:id/meetings", auth, scheduleProjectMeeting);

module.exports = router;
