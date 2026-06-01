const express = require("express");
const {
  getIssues,
  getIssueStats,
  getMyReportedBugs,
  getMyIssues,
  getBugBucket,
  getRecentIssueActivity,
  createIssue,
  updateIssue,
  pickIssue,
  deleteIssue,
} = require("../controllers/issueController");
const {
  createIssueWorklog,
  getIssueAttachments,
  downloadIssueAttachment,
  getIssueHistory,
  getIssueWorklogs,
  moveIssueToSprint,
  removeIssueFromSprint,
  suggestIssuePriority,
  updateIssuePlanning,
  uploadIssueAttachment,
  uploadIssueAttachmentMiddleware,
} = require("../controllers/issuePlanningController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/my", protect, getMyIssues);
router.get("/reported/me", protect, getMyReportedBugs);
router.get("/bucket", protect, getBugBucket);
router.get("/activity", protect, getRecentIssueActivity);
router.get("/stats", protect, getIssueStats);
router.patch("/:id/planning", protect, updateIssuePlanning);
router.post("/:id/sprint", protect, moveIssueToSprint);
router.delete("/:id/sprint", protect, removeIssueFromSprint);
router.get("/:id/attachments", protect, getIssueAttachments);
router.get("/:issueId/attachments/:attachmentId/download", protect, downloadIssueAttachment);
router.post(
  "/:id/attachments",
  protect,
  uploadIssueAttachmentMiddleware,
  uploadIssueAttachment
);
router.get("/:id/worklogs", protect, getIssueWorklogs);
router.post("/:id/worklogs", protect, createIssueWorklog);
router.get("/:id/history", protect, getIssueHistory);
router.post("/:id/suggest-priority", protect, suggestIssuePriority);
router.post("/:id/pick", protect, pickIssue);
router.route("/").get(protect, getIssues).post(protect, createIssue);
router.route("/:id").put(protect, updateIssue).delete(protect, deleteIssue);

module.exports = router;
