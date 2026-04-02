const express = require("express");
const {
  login,
  register,
  getUsers,
  getAdminCredentials,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/admin-credentials", getAdminCredentials);
router.get("/users", protect, getUsers);

module.exports = router;
