const express = require("express");
const {
  getBugEffortAnalytics,
  getProductivityReport,
  getTeamActivity,
} = require("../controllers/activityController");
const auth = require("../middleware/auth");

const router = express.Router();

router.get("/team", auth, getTeamActivity);
router.get("/productivity", auth, getProductivityReport);
router.get("/bug-effort", auth, getBugEffortAnalytics);

module.exports = router;
