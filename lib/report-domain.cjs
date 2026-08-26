const RETENTION_LIMIT = 30;

function isFailing(status) {
  return status === "failed" || status === "broken";
}

function passRate(report) {
  return report.total > 0 ? (report.passed / report.total) * 100 : 0;
}

function sortNewestFirst(first, second) {
  return (
    Date.parse(second.createdAt) - Date.parse(first.createdAt) ||
    second.runId - first.runId ||
    second.id.localeCompare(first.id)
  );
}

function compareRuns(current, previous) {
  if (!previous || current.tests.length === 0 || previous.tests.length === 0) {
    return { comparable: false, newFailures: [], recovered: [] };
  }

  const previousStatuses = new Map(
    previous.tests.map((test) => [test.name, test.status]),
  );
  const newFailures = [];
  const recovered = [];

  for (const test of current.tests) {
    const previousStatus = previousStatuses.get(test.name);
    if (!previousStatus) continue;
    if (!isFailing(previousStatus) && isFailing(test.status))
      newFailures.push(test.name);
    if (isFailing(previousStatus) && !isFailing(test.status))
      recovered.push(test.name);
  }

  return { comparable: true, newFailures, recovered };
}

function qualityGate(report, thresholds = {}) {
  const readyPassRate = thresholds.readyPassRate ?? 95;
  const blockedPassRate = thresholds.blockedPassRate ?? 85;
  const issues = report.failed + report.broken;
  if (report.delta.newFailures.length > 0 || passRate(report) < blockedPassRate)
    return "blocked";
  if (issues > 0 || passRate(report) < readyPassRate) return "at-risk";
  return "ready";
}

function enrichReports(reports, thresholds) {
  return reports.map((report, index) => {
    const previousComparable = reports
      .slice(index + 1)
      .find(
        (candidate) =>
          candidate.type === report.type &&
          candidate.environment === report.environment,
      );
    const withDelta = {
      ...report,
      delta: compareRuns(report, previousComparable),
    };
    return { ...withDelta, gate: qualityGate(withDelta, thresholds) };
  });
}

module.exports = {
  RETENTION_LIMIT,
  enrichReports,
  isFailing,
  passRate,
  qualityGate,
  sortNewestFirst,
};
