const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {
  getTeams,
  getTeamById,
  createTeam,
  addTeamMember,
  removeTeamMember,
  deleteTeam,
} = require("../controllers/teamController");

const router = express.Router();

router.get("/", protect, getTeams);
router.post("/", protect, createTeam);
router.get("/:id", protect, getTeamById);
router.post("/:id/members", protect, addTeamMember);
router.delete("/:id/members/:userId", protect, removeTeamMember);
router.delete("/:id", protect, deleteTeam);

module.exports = router;
