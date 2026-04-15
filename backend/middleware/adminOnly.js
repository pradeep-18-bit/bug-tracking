const asyncHandler = require("../utils/asyncHandler");
const { hasAdminAccess } = require("../utils/roles");

const adminOnly = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    res.status(401);
    throw new Error("Unauthorized");
  }

  if (!hasAdminAccess(req.user.role)) {
    res.status(403);
    throw new Error("Admin or manager access required");
  }

  next();
});

module.exports = adminOnly;
