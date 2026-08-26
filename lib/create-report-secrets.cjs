const fs = require("fs");

function createReportSecrets(outputPath) {
  const names = ["REPORTS_USERNAME", "REPORTS_PASSWORD", "REPORTS_SESSION_SECRET"];
  const secrets = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  const missing = names.filter((name) => !secrets[name]);
  if (missing.length) throw new Error(`Missing required secrets: ${missing.join(", ")}`);
  fs.writeFileSync(outputPath, JSON.stringify(secrets), { mode: 0o600 });
}

module.exports = { createReportSecrets };
