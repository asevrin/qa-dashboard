function metricValue(summary, metric, keys) {
  const values = summary?.metrics?.[metric]?.values || {};
  for (const key of keys) {
    const value = Number(values[key]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function thresholdFailures(summary) {
  return Object.entries(summary?.metrics || {}).flatMap(([metric, data]) =>
    Object.entries(data.thresholds || {})
      .filter(([, result]) => result?.ok === false)
      .map(([threshold]) => `${metric}: ${threshold}`),
  );
}

function normalizeK6Summary(summary) {
  return {
    p95: metricValue(summary, "http_req_duration", ["p(95)", "p95"]),
    p99: metricValue(summary, "http_req_duration", ["p(99)", "p99"]),
    errorRate: metricValue(summary, "http_req_failed", ["rate", "value"]),
    requestsPerSecond: metricValue(summary, "http_reqs", ["rate"]),
    requests: metricValue(summary, "http_reqs", ["count"]),
    maxVUs: metricValue(summary, "vus_max", ["max", "value"]),
    thresholdFailures: thresholdFailures(summary),
  };
}

function performanceGate(metrics, thresholds) {
  if (metrics.errorRate === null || metrics.p95 === null) return "blocked";
  const blocked =
    metrics.thresholdFailures.length > 0 ||
    metrics.errorRate >= thresholds.blockedErrorRate ||
    metrics.p95 >= thresholds.blockedP95Ms ||
    (metrics.p99 !== null && metrics.p99 >= thresholds.blockedP99Ms);
  if (blocked) return "blocked";

  const atRisk =
    metrics.errorRate >= thresholds.readyErrorRate ||
    metrics.p95 >= thresholds.readyP95Ms ||
    (metrics.p99 !== null && metrics.p99 >= thresholds.readyP99Ms);
  return atRisk ? "at-risk" : "ready";
}

module.exports = { normalizeK6Summary, performanceGate, thresholdFailures };
