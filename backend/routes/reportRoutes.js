const express = require("express");
const { getReports } = require("../controllers/issueController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protect, getReports);

module.exports = router;
