const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeK6Summary, performanceGate } = require("../lib/performance-domain.cjs");

const thresholds = {
  readyErrorRate: 0.01,
  blockedErrorRate: 0.03,
  readyP95Ms: 800,
  blockedP95Ms: 1500,
  readyP99Ms: 1500,
  blockedP99Ms: 3000,
};

function summary(overrides = {}) {
  return {
    metrics: {
      http_req_duration: { values: { "p(95)": 420, "p(99)": 810 } },
      http_req_failed: { values: { rate: 0.002 } },
      http_reqs: { values: { count: 1200, rate: 20 } },
      vus_max: { values: { max: 10 } },
    },
    ...overrides,
  };
}

test("normalizes standard k6 summary metrics", () => {
  assert.deepEqual(normalizeK6Summary(summary()), {
    p95: 420,
    p99: 810,
    errorRate: 0.002,
    requestsPerSecond: 20,
    requests: 1200,
    maxVUs: 10,
    thresholdFailures: [],
  });
});

test("marks threshold failures as blocked", () => {
  const metrics = normalizeK6Summary(summary({
    metrics: {
      ...summary().metrics,
      http_req_duration: {
        values: { "p(95)": 420, "p(99)": 810 },
        thresholds: { "p(95)<750": { ok: false } },
      },
    },
  }));
  assert.equal(performanceGate(metrics, thresholds), "blocked");
});

test("uses default bands for ready and at-risk runs", () => {
  assert.equal(performanceGate(normalizeK6Summary(summary()), thresholds), "ready");
  const atRisk = normalizeK6Summary(summary({
    metrics: { ...summary().metrics, http_req_duration: { values: { "p(95)": 900, "p(99)": 810 } } },
  }));
  assert.equal(performanceGate(atRisk, thresholds), "at-risk");
});
