const jwt = require("jsonwebtoken");

const generateToken = (userId, workspaceId) =>
  jwt.sign({ id: userId, workspaceId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

module.exports = generateToken;
