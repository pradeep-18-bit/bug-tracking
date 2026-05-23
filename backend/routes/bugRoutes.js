const express = require("express");
const {
  createBug,
  deleteBug,
  ensureBugRecord,
  getBugs,
  updateBug,
} = require("../controllers/bugController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.route("/").get(protect, getBugs).post(protect, createBug);
router.route("/:id").put(protect, ensureBugRecord, updateBug).delete(protect, ensureBugRecord, deleteBug);

module.exports = router;
