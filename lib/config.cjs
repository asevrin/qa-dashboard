const fs = require("fs");
const path = require("path");

const CONFIG_FILE = "qa-dashboard.config.json";

const defaults = {
  reportType: "api",
  reportTypes: ["api", "ui", "integrations"],
  environment: "Staging",
  allureReportDirectory: "allure-report",
  reportsSiteDirectory: "reports-site/site",
  retentionLimit: 30,
  performanceRetentionLimit: 30,
  qualityGates: {
    readyPassRate: 95,
    blockedPassRate: 85,
  },
  performanceGates: {
    readyErrorRate: 0.01,
    blockedErrorRate: 0.03,
    readyP95Ms: 800,
    blockedP95Ms: 1500,
    readyP99Ms: 1500,
    blockedP99Ms: 3000,
  },
};

function loadConfig(rootDirectory) {
  const configPath = path.join(rootDirectory, CONFIG_FILE);
  if (!fs.existsSync(configPath)) return { ...defaults };

  const raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
  return {
    ...defaults,
    ...raw,
    qualityGates: { ...defaults.qualityGates, ...raw.qualityGates },
    performanceGates: { ...defaults.performanceGates, ...raw.performanceGates },
    reportTypes: raw.reportTypes || defaults.reportTypes,
  };
}

module.exports = { CONFIG_FILE, defaults, loadConfig };
