const express = require("express");
const {
  createEpic,
  deleteEpic,
  getEpics,
  updateEpic,
} = require("../controllers/epicController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.route("/").get(protect, getEpics).post(protect, createEpic);
router.route("/:id").patch(protect, updateEpic).delete(protect, deleteEpic);

module.exports = router;
