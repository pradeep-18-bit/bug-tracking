const asyncHandler = require("../utils/asyncHandler");

const adminOnly = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    res.status(401);
    throw new Error("Unauthorized");
  }

  if (req.user.role !== "Admin") {
    res.status(403);
    throw new Error("Admin access required");
  }

  next();
});

module.exports = adminOnly;
