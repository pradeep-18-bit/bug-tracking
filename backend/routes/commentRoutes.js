const express = require("express");
const {
  createComment,
  getComments,
} = require("../controllers/commentController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", protect, createComment);
router.get("/:issueId", protect, getComments);

module.exports = router;
