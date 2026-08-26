const fs = require("fs");
const path = require("path");

const CONFIG_FILE = "qa-dashboard.config.json";

const defaults = {
  reportType: "api",
  environment: "Staging",
  allureReportDirectory: "allure-report",
  reportsSiteDirectory: "reports-site/site",
  retentionLimit: 30,
  qualityGates: {
    readyPassRate: 95,
    blockedPassRate: 85,
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
  };
}

module.exports = { CONFIG_FILE, defaults, loadConfig };
