const express = require("express");
const { getBacklogBoard } = require("../controllers/backlogController");
const { reorderIssuePlanning } = require("../controllers/issuePlanningController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protect, getBacklogBoard);
router.post("/reorder", protect, reorderIssuePlanning);

module.exports = router;
