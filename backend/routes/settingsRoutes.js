const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/adminOnly");
const {
  getEmailConfig,
  saveEmailConfig,
  testEmailConfig,
  getWorkspaceSender,
  saveWorkspaceSender,
  getEligibleSenders,
} = require("../controllers/settingsController");

const router = express.Router();

router.use(protect, adminOnly);

router.get("/email-config", getEmailConfig);
router.post("/email-config", saveEmailConfig);
router.post("/test-email", testEmailConfig);
router.get("/workspace-sender", getWorkspaceSender);
router.post("/workspace-sender", saveWorkspaceSender);
router.get("/eligible-senders", getEligibleSenders);

module.exports = router;
