const express = require("express");
const {
  getProjects,
  createProject,
  attachProjectTeam,
  detachProjectTeam,
  updateProjectStatus,
} = require("../controllers/projectController");
const auth = require("../middleware/auth");

const router = express.Router();

router.get("/", auth, getProjects);
router.post("/", auth, createProject);
router.post("/:id/teams", auth, attachProjectTeam);
router.delete("/:id/teams/:teamId", auth, detachProjectTeam);
router.patch("/:id/status", auth, updateProjectStatus);

module.exports = router;
