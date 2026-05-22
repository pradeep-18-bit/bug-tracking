const jwt = require("jsonwebtoken");

const STANDARD_TOKEN_MAX_AGE_SECONDS = 8 * 60 * 60;
const REMEMBER_ME_TOKEN_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const getTokenMaxAgeSeconds = ({ rememberMe = false } = {}) =>
  rememberMe ? REMEMBER_ME_TOKEN_MAX_AGE_SECONDS : STANDARD_TOKEN_MAX_AGE_SECONDS;

const generateToken = (userId, workspaceId, options = {}) =>
  jwt.sign({ id: userId, workspaceId }, process.env.JWT_SECRET, {
    expiresIn: getTokenMaxAgeSeconds(options),
  });

generateToken.getTokenMaxAgeSeconds = getTokenMaxAgeSeconds;

module.exports = generateToken;
