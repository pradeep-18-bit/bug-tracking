const express = require("express");
const {
  getRecentTasks,
  updateTaskStatus,
} = require("../controllers/taskController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/recent", protect, getRecentTasks);
router.patch("/:id/status", protect, updateTaskStatus);

module.exports = router;
