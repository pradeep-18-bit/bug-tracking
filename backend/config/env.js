const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, "..", ".env"),
});

dotenv.config({
  path: path.resolve(__dirname, "..", "..", ".env"),
});

const DEFAULT_FRONTEND_URL = "http://localhost:3000";

let warnedMissingFrontendUrl = false;

const normalizeBaseUrl = (value = DEFAULT_FRONTEND_URL) =>
  String(value || DEFAULT_FRONTEND_URL).trim().replace(/\/+$/, "");

const warnMissingFrontendUrl = (fallbackSource) => {
  if (warnedMissingFrontendUrl) {
    return;
  }

  warnedMissingFrontendUrl = true;
  console.warn(
    `[config] FRONTEND_URL is not set. Using ${fallbackSource}. Set FRONTEND_URL to your deployed frontend origin for email links.`
  );
};

const getFrontendUrl = () => {
  const frontendUrl = String(process.env.FRONTEND_URL || "").trim();

  if (frontendUrl) {
    return normalizeBaseUrl(frontendUrl);
  }

  const legacyAppUrl = String(process.env.APP_URL || "").trim();

  if (legacyAppUrl) {
    warnMissingFrontendUrl("APP_URL fallback");
    return normalizeBaseUrl(legacyAppUrl);
  }

  warnMissingFrontendUrl("local development fallback");
  return normalizeBaseUrl(DEFAULT_FRONTEND_URL);
};

const buildFrontendUrl = (pathname = "") => {
  const normalizedPath = String(pathname || "").startsWith("/")
    ? String(pathname || "")
    : `/${String(pathname || "")}`;

  return `${getFrontendUrl()}${normalizedPath}`;
};

module.exports = {
  DEFAULT_FRONTEND_URL,
  FRONTEND_URL: getFrontendUrl(),
  buildFrontendUrl,
  getFrontendUrl,
  normalizeBaseUrl,
};
