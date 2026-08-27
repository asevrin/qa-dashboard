const fs = require("fs");
const path = require("path");
const { readJson } = require("./report-archive.cjs");

function copyFileIfPresent(source, destination) {
  if (!source || !fs.existsSync(source)) return false;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  return true;
}

function listPerformanceRuns(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const metadata = readJson(path.join(directory, entry.name, ".qa-performance.json"), {});
      return {
        ...metadata,
        id: entry.name,
        href: metadata.htmlFile ? `./performance/${encodeURIComponent(entry.name)}/${metadata.htmlFile}` : "",
      };
    })
    .filter((run) => run.createdAt);
}

function writePerformanceRun(directory, run, summaryPath, htmlPath) {
  fs.rmSync(directory, { force: true, recursive: true });
  fs.mkdirSync(directory, { recursive: true });
  copyFileIfPresent(summaryPath, path.join(directory, "summary.json"));
  const htmlFile = htmlPath && fs.existsSync(htmlPath) ? "report.html" : "";
  if (htmlFile) copyFileIfPresent(htmlPath, path.join(directory, htmlFile));
  fs.writeFileSync(
    path.join(directory, ".qa-performance.json"),
    JSON.stringify({ ...run, htmlFile }),
  );
}

module.exports = { listPerformanceRuns, writePerformanceRun };
