const express = require("express");
const {
  login,
  register,
  getUsers,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/users", protect, getUsers);

module.exports = router;
