const express = require("express");
const {
  getIssueAnalyticsRows,
  getOverview,
  getPriorities,
  getProjects,
  getRecentActivity,
  getTeams,
  getTrends,
} = require("../controllers/analyticsController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/overview", protect, getOverview);
router.get("/trends", protect, getTrends);
router.get("/priorities", protect, getPriorities);
router.get("/projects", protect, getProjects);
router.get("/teams", protect, getTeams);
router.get("/recent-activity", protect, getRecentActivity);
router.get("/issues", protect, getIssueAnalyticsRows);

module.exports = router;
