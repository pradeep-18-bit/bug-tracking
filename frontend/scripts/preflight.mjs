import { existsSync } from "node:fs";
import process from "node:process";

const MIN_NODE_20 = [20, 19, 0];
const MIN_NODE_22 = [22, 12, 0];
const MIN_NPM = [10, 0, 0];

function parseVersion(raw) {
  const match = String(raw).trim().match(/^v?(\d+)\.(\d+)\.(\d+)/);
  return match ? match.slice(1).map(Number) : null;
}

function compareVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) {
      return left[index] - right[index];
    }
  }

  return 0;
}

function formatVersion(version) {
  return version.join(".");
}

function isSupportedNode(version) {
  return (
    (version[0] === 20 && compareVersions(version, MIN_NODE_20) >= 0) ||
    compareVersions(version, MIN_NODE_22) >= 0
  );
}

function readNpmVersion() {
  const userAgent = process.env.npm_config_user_agent ?? "";
  const match = userAgent.match(/npm\/(\d+\.\d+\.\d+)/);
  return match ? parseVersion(match[1]) : null;
}

const issues = [];
const nodeVersion = parseVersion(process.version);
const npmVersion = readNpmVersion();

if (!nodeVersion || !isSupportedNode(nodeVersion)) {
  issues.push(
    `Detected Node ${process.version}. Use Node 20.19.0+ on the 20.x line or Node 22.12.0+.`,
  );
}

if (npmVersion && compareVersions(npmVersion, MIN_NPM) < 0) {
  issues.push(`Detected npm ${formatVersion(npmVersion)}. Use npm 10 or newer.`);
}

if (!existsSync("package-lock.json")) {
  issues.push("Missing package-lock.json. Restore it before running installs.");
}

if (issues.length > 0) {
  console.error("Frontend preflight failed:");
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }

  console.error("");
  console.error("Recommended setup:");
  console.error("- nvm install 20.19.0");
  console.error("- nvm use 20.19.0");
  console.error("- cd frontend && npm ci");
  console.error("");
  console.error("If you change dependencies, commit both package.json and package-lock.json.");
  process.exit(1);
}

if (npmVersion) {
  console.log(
    `Frontend preflight passed with Node ${process.version} and npm ${formatVersion(npmVersion)}.`,
  );
}
