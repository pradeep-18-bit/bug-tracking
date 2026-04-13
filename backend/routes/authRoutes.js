const express = require("express");
const {
  login,
  adminLogin,
  register,
  getUsers,
  changePassword,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/admin-login", adminLogin);
router.get("/users", protect, getUsers);
router.post("/change-password", protect, changePassword);

module.exports = router;
