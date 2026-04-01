const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { getWorkspaceUsers } = require("../controllers/workspaceController");

const router = express.Router();

router.get("/:workspaceId/users", protect, getWorkspaceUsers);

module.exports = router;
