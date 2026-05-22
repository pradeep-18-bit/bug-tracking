const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, "..", ".env"),
});

dotenv.config({
  path: path.resolve(__dirname, "..", "..", ".env"),
});

const LOCAL_DEV_HOST = ["local", "host"].join("");
const DEFAULT_APP_URL = `http://${LOCAL_DEV_HOST}:3000`;

let warnedMissingAppUrl = false;

const normalizeBaseUrl = (value = DEFAULT_APP_URL) =>
  String(value || DEFAULT_APP_URL).trim().replace(/\/+$/, "");

const warnMissingAppUrl = () => {
  if (warnedMissingAppUrl) {
    return;
  }

  warnedMissingAppUrl = true;
  console.warn("APP_URL environment variable is not configured");
};

const getAppUrl = () => {
  const appUrl = String(process.env.APP_URL || "").trim();

  if (appUrl) {
    return normalizeBaseUrl(appUrl);
  }

  warnMissingAppUrl();
  return normalizeBaseUrl(DEFAULT_APP_URL);
};

const buildAppUrl = (pathname = "") => {
  const normalizedPath = String(pathname || "").startsWith("/")
    ? String(pathname || "")
    : `/${String(pathname || "")}`;

  return `${getAppUrl()}${normalizedPath}`;
};

const generateIssueUrl = (issueId) => buildAppUrl(`/issues/${issueId}`);
const generateIssueRedirectUrl = (issueId) =>
  buildAppUrl(`/login?redirect=/issues/${encodeURIComponent(String(issueId || ""))}`);

module.exports = {
  APP_URL: getAppUrl(),
  DEFAULT_APP_URL,
  buildAppUrl,
  generateIssueRedirectUrl,
  generateIssueUrl,
  getAppUrl,
  normalizeBaseUrl,
};
