const express = require("express");
const { updateTaskStatus } = require("../controllers/taskController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.patch("/:id/status", protect, updateTaskStatus);

module.exports = router;
