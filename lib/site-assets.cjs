const fs = require("fs");
const path = require("path");

const navigation = `<style id="qa-portal-nav-style">#qa-portal-nav{position:fixed;right:20px;bottom:20px;z-index:99999;display:flex;gap:8px;font:600 14px/1 system-ui,sans-serif}#qa-portal-nav a{display:inline-flex;align-items:center;min-height:40px;padding:0 14px;border-radius:9px;background:#2563eb;box-shadow:0 10px 25px rgb(37 99 235 / .3);color:#fff;text-decoration:none}#qa-portal-nav a:last-child{background:#334155}@media(max-width:640px){#qa-portal-nav{right:12px;bottom:12px}}</style><nav id="qa-portal-nav" aria-label="Portal navigation"><a href="/">All reports</a><a href="/logout">Log out</a></nav>`;

function injectNavigation(reportDirectory) {
  const indexPath = path.join(reportDirectory, "index.html");
  if (!fs.existsSync(indexPath)) return;
  const html = fs
    .readFileSync(indexPath, "utf8")
    .replace(
      /<style id="qa-reports-navigation-style">[\s\S]*?<\/style>\s*<a id="qa-reports-home-link"[\s\S]*?<\/a>/g,
      "",
    )
    .replace(
      /<style id="qa-reports-portal-navigation-style">[\s\S]*?<\/style>\s*<nav id="qa-reports-portal-navigation"[\s\S]*?<\/nav>/g,
      "",
    )
    .replace(
      /<style id="qa-portal-nav-style">[\s\S]*?<\/style>\s*<nav id="qa-portal-nav"[\s\S]*?<\/nav>/g,
      "",
    );
  fs.writeFileSync(
    indexPath,
    html.replace(/<\/body>/i, `${navigation}</body>`),
  );
}

function publishPortalAssets({
  portalDirectory,
  siteDirectory,
  generatedAt,
  reports,
  performanceRuns = [],
  retention,
}) {
  fs.mkdirSync(path.join(siteDirectory, "dashboard-data"), { recursive: true });
  fs.cpSync(portalDirectory, siteDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(siteDirectory, "dashboard-data/reports.json"),
    JSON.stringify({ generatedAt, retention, reports }),
  );
  fs.writeFileSync(
    path.join(siteDirectory, "dashboard-data/performance.json"),
    JSON.stringify({ generatedAt, runs: performanceRuns }),
  );
}

module.exports = { injectNavigation, publishPortalAssets };
