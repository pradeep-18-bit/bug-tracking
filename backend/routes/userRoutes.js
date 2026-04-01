const express = require("express");
const multer = require("multer");
const {
  getManagedUsers,
  inviteUser,
  bulkInviteUsers,
  importUsers,
} = require("../controllers/userController");
const { protect } = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/adminOnly");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

router.use(protect, adminOnly);

router.get("/", getManagedUsers);
router.post("/invite", inviteUser);
router.post("/bulk", bulkInviteUsers);
router.post("/import", upload.single("file"), importUsers);
router.post("/import-users", upload.single("file"), importUsers);

module.exports = router;
