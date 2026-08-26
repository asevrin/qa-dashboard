const state = {
  reports: [],
  type: "all",
  status: "all",
  environment: "all",
  period: "all",
  query: "",
  page: 1,
  pageSize: 9,
};
const $ = (selector) => document.querySelector(selector);
const formatNumber = new Intl.NumberFormat("en-US");
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function duration(value) {
  if (!value) return "—";
  const seconds = Math.round(value / 1000);
  return seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function passRate(report) {
  return report.total ? Math.round((report.passed / report.total) * 100) : 0;
}
function reportDate(report) {
  return dateFormatter.format(new Date(report.createdAt));
}

function filteredReports() {
  const now = Date.now();
  return state.reports.filter((report) => {
    const matchesType = state.type === "all" || report.type === state.type;
    const matchesStatus =
      state.status === "all" || report.status === state.status;
    const matchesEnvironment =
      state.environment === "all" || report.environment === state.environment;
    const matchesPeriod =
      state.period === "all" ||
      Date.parse(report.createdAt) >= now - Number(state.period) * 86400000;
    const search =
      `${report.id} ${report.branch} ${report.commit} ${report.environment}`.toLowerCase();
    return (
      matchesType &&
      matchesStatus &&
      matchesEnvironment &&
      matchesPeriod &&
      search.includes(state.query)
    );
  });
}

function renderKpis(reports) {
  const latest = reports[0];
  const totalTests = reports.reduce((sum, report) => sum + report.total, 0);
  const failures = reports.reduce(
    (sum, report) => sum + report.failed + report.broken,
    0,
  );
  const averageRate = reports.length
    ? Math.round(
        reports.reduce((sum, report) => sum + passRate(report), 0) /
          reports.length,
      )
    : 0;
  $("#kpi-grid").innerHTML = [
    [
      "Latest run",
      latest ? passRate(latest) + "%" : "—",
      latest
        ? `${latest.type.toUpperCase()} · ${reportDate(latest)}`
        : "No reports yet",
      latest?.status === "failed" ? "down" : "up",
    ],
    [
      "Pass rate",
      `${averageRate}%`,
      `${reports.length} published run${reports.length === 1 ? "" : "s"}`,
      averageRate >= 90 ? "up" : "down",
    ],
    [
      "Tests executed",
      formatNumber.format(totalTests),
      "Across visible runs",
      "",
    ],
    [
      "Failures found",
      formatNumber.format(failures),
      failures ? "Needs attention" : "All clear",
      failures ? "down" : "up",
    ],
  ]
    .map(
      ([label, value, detail, tone]) =>
        `<article class="kpi"><div class="kpi-label">${label}</div><div class="kpi-value ${tone}">${value}</div><div class="kpi-detail">${detail}</div></article>`,
    )
    .join("");
  const gate = $("#quality-gate");
  const gateLabel =
    latest?.gate === "at-risk"
      ? "At risk"
      : latest?.gate === "blocked"
        ? "Blocked"
        : latest?.gate === "ready"
          ? "Ready"
          : "No data";
  gate.className = `quality-gate ${latest?.gate || "loading"}`;
  gate.textContent = gateLabel;
}

function renderChart(reports) {
  const series = [...reports].slice(0, 12).reverse();
  if (!series.length) {
    $("#trend-chart").innerHTML = "<p class='run-meta'>No trend data yet.</p>";
    return;
  }
  const width = 680,
    height = 190,
    padding = 18;
  const points = series.map((report, index) => {
    const x =
      padding +
      index * ((width - padding * 2) / Math.max(series.length - 1, 1));
    const y =
      padding + (100 - passRate(report)) * ((height - padding * 2) / 100);
    return { x, y, report };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${padding},${height - padding} ${line} ${width - padding},${height - padding}`;
  const chart = $("#trend-chart");
  chart.innerHTML = `<div class="chart-tooltip" id="chart-tooltip"></div><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Pass rate trend"><defs><linearGradient id="chart-gradient" x1="0" x2="0" y1="0" y2="1"><stop stop-color="var(--blue)" stop-opacity=".32"/><stop offset="1" stop-color="var(--blue)" stop-opacity="0"/></linearGradient></defs><line class="chart-grid" x1="${padding}" x2="${width - padding}" y1="${padding}" y2="${padding}"/><line class="chart-grid" x1="${padding}" x2="${width - padding}" y1="${height / 2}" y2="${height / 2}"/><line class="chart-grid" x1="${padding}" x2="${width - padding}" y1="${height - padding}" y2="${height - padding}"/><polygon class="chart-area" points="${area}"/><polyline class="chart-line" points="${line}"/>${points.map((point, index) => `<circle class="chart-point" cx="${point.x}" cy="${point.y}" r="5" data-index="${index}" tabindex="0" aria-label="${point.report.id}, ${passRate(point.report)} percent passed"></circle>`).join("")}</svg>`;

  const tooltip = $("#chart-tooltip");
  const showTooltip = (index, clientX, clientY) => {
    const report = points[index].report;
    tooltip.innerHTML = `<strong>Run #${report.runId || "—"} <span class="tooltip-rate">${passRate(report)}%</span></strong><p>${reportDate(report)} · ${report.type.toUpperCase()}</p><p>${report.passed}/${report.total} passed · ${report.failed + report.broken} issues · ${duration(report.duration)}</p>`;
    const bounds = chart.getBoundingClientRect();
    const x = clientX
      ? Math.max(88, Math.min(clientX - bounds.left, bounds.width - 88))
      : (points[index].x / width) * bounds.width;
    const y = clientY
      ? clientY - bounds.top
      : (points[index].y / height) * bounds.height;
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${Math.max(y, 48)}px`;
    tooltip.classList.add("visible");
  };

  chart.querySelectorAll(".chart-point").forEach((point) => {
    const index = Number(point.dataset.index);
    point.addEventListener("pointerenter", (event) =>
      showTooltip(index, event.clientX, event.clientY),
    );
    point.addEventListener("pointermove", (event) =>
      showTooltip(index, event.clientX, event.clientY),
    );
    point.addEventListener("pointerleave", () =>
      tooltip.classList.remove("visible"),
    );
    point.addEventListener("focus", () => showTooltip(index));
    point.addEventListener("blur", () => tooltip.classList.remove("visible"));
  });
}

function renderInsights(reports) {
  const latest = reports[0];
  const failed = reports.filter((report) => report.status === "failed").length;
  const averageDuration = reports.length
    ? reports.reduce((sum, report) => sum + report.duration, 0) / reports.length
    : 0;
  const delta = latest?.delta;
  const regressionRows = delta?.comparable
    ? `<div class="insight"><span class="insight-label">New failures</span><strong class="insight-value ${delta.newFailures.length ? "down" : "up"}">${delta.newFailures.length || "None"}</strong></div><div class="insight"><span class="insight-label">Recovered tests</span><strong class="insight-value ${delta.recovered.length ? "up" : ""}">${delta.recovered.length || "None"}</strong></div>`
    : `<div class="insight"><span class="insight-label">Regression comparison</span><strong class="insight-value">Waiting for next run</strong></div>`;
  $("#insights-panel").innerHTML =
    `<p class="panel-kicker">Comparison</p><h2>Changes since previous run</h2><div class="insight-list"><div class="insight"><span class="insight-label">Latest run status</span><strong class="insight-value ${latest?.status === "failed" ? "down" : "up"}">${latest ? (latest.status === "failed" ? "Failed" : "Passed") : "—"}</strong></div>${regressionRows}<div class="insight"><span class="insight-label">Failed runs</span><strong class="insight-value ${failed ? "down" : "up"}">${failed} of ${reports.length}</strong></div><div class="insight"><span class="insight-label">Average duration</span><strong class="insight-value">${duration(averageDuration)}</strong></div></div>`;
}

function renderRuns(reports) {
  if (!reports.length) {
    $("#result-count").textContent = "0 runs";
    $("#run-grid").innerHTML = $("#empty-template").innerHTML;
    $("#pagination").innerHTML = "";
    return;
  }

  const pages = Math.ceil(reports.length / state.pageSize);
  state.page = Math.min(state.page, pages);
  const start = (state.page - 1) * state.pageSize;
  const pageReports = reports.slice(start, start + state.pageSize);
  $("#result-count").textContent =
    `Showing ${start + 1}–${Math.min(start + state.pageSize, reports.length)} of ${reports.length} runs`;
  $("#run-grid").innerHTML = pageReports
    .map((report) => {
      const delta = report.delta;
      const branch = report.branch
        ? report.branchUrl
          ? `<a href="${report.branchUrl}" target="_blank" rel="noreferrer">${report.branch}</a>`
          : report.branch
        : "";
      const commit = report.commit
        ? report.commitUrl
          ? `<a href="${report.commitUrl}" target="_blank" rel="noreferrer">${report.commit}</a>`
          : report.commit
        : "";
      const context = [report.environment, branch, commit]
        .filter(Boolean)
        .join(" · ");
      const workflowLink = report.workflowUrl
        ? `<a class="workflow-link" href="${report.workflowUrl}" target="_blank" rel="noreferrer">GitHub run ↗</a>`
        : "";
      const regression = delta?.comparable
        ? `<div class="regression"><span class="${delta.newFailures.length ? "negative" : "neutral"}">+${delta.newFailures.length} new failures</span><span class="${delta.recovered.length ? "positive" : "neutral"}">↗ ${delta.recovered.length} recovered</span></div>`
        : "";
      const gateLabel =
        report.gate === "at-risk"
          ? "At risk"
          : report.gate === "blocked"
            ? "Blocked"
            : "Ready";
      return `<article class="run-card ${report.status}"><div class="run-top"><span class="badge ${report.type}">${report.type}</span><span class="run-badges"><span class="quality-gate ${report.gate}">${gateLabel}</span><span class="run-time">${reportDate(report)}</span></span></div><h3 class="run-title">Run #${report.runId || "—"}</h3><div class="run-meta">${context}</div><div class="metrics"><div class="metric"><span>Pass rate</span><strong class="${passRate(report) >= 90 ? "up" : "down"}">${passRate(report)}%</strong></div><div class="metric"><span>Tests</span><strong>${report.total}</strong></div><div class="metric"><span>Issues</span><strong class="${report.failed + report.broken ? "down" : "up"}">${report.failed + report.broken}</strong></div></div>${regression}<div class="run-footer"><span>${duration(report.duration)}</span><span class="run-links">${workflowLink}<a class="open-report" href="${report.href}">Open report →</a></span></div></article>`;
    })
    .join("");
  renderPagination(pages);
}

function renderPagination(pages) {
  if (pages <= 1) {
    $("#pagination").innerHTML = "";
    return;
  }

  const first = Math.max(1, Math.min(state.page - 2, pages - 4));
  const last = Math.min(pages, first + 4);
  const pageButtons = Array.from({ length: last - first + 1 }, (_, index) => {
    const page = first + index;
    return `<button type="button" data-page="${page}" class="${page === state.page ? "active" : ""}" aria-label="Page ${page}" ${page === state.page ? "aria-current='page'" : ""}>${page}</button>`;
  }).join("");

  $("#pagination").innerHTML =
    `<button type="button" data-page="${state.page - 1}" ${state.page === 1 ? "disabled" : ""}>← Previous</button>${first > 1 ? "<span>…</span>" : ""}${pageButtons}${last < pages ? "<span>…</span>" : ""}<button type="button" data-page="${state.page + 1}" ${state.page === pages ? "disabled" : ""}>Next →</button>`;
  $("#pagination")
    .querySelectorAll("button[data-page]")
    .forEach((button) =>
      button.addEventListener("click", () => {
        state.page = Number(button.dataset.page);
        render();
        $("#run-grid").scrollIntoView({ behavior: "smooth", block: "start" });
      }),
    );
}

function render() {
  const visible = filteredReports();
  renderKpis(visible);
  renderChart(visible);
  renderInsights(visible);
  renderRuns(visible);
}

function initializeTheme() {
  const saved = localStorage.getItem("qa-theme");
  const theme =
    saved ||
    (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  document.documentElement.dataset.theme = theme;
  $("#theme-label").textContent = theme === "dark" ? "Dark" : "Light";
  $("#theme-toggle").addEventListener("click", () => {
    const next =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("qa-theme", next);
    $("#theme-label").textContent = next === "dark" ? "Dark" : "Light";
  });
}

async function boot() {
  initializeTheme();
  const response = await fetch("./dashboard-data/reports.json", {
    cache: "no-store",
  });
  const payload = await response.json();
  state.reports = payload.reports || [];
  const environments = [
    ...new Set(
      state.reports.map((report) => report.environment).filter(Boolean),
    ),
  ].sort();
  $("#environment-filter").insertAdjacentHTML(
    "beforeend",
    environments
      .map(
        (environment) =>
          `<option value="${environment}">${environment}</option>`,
      )
      .join(""),
  );
  $("#latest-button").href = state.reports[0]?.href || "./latest/";
  document.querySelectorAll("#type-tabs button").forEach((button) =>
    button.addEventListener("click", () => {
      state.type = button.dataset.type;
      state.page = 1;
      document.querySelector("#type-tabs .active").classList.remove("active");
      button.classList.add("active");
      render();
    }),
  );
  $("#search").addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    state.page = 1;
    render();
  });
  $("#status-filter").addEventListener("change", (event) => {
    state.status = event.target.value;
    state.page = 1;
    render();
  });
  $("#environment-filter").addEventListener("change", (event) => {
    state.environment = event.target.value;
    state.page = 1;
    render();
  });
  $("#period-filter").addEventListener("change", (event) => {
    state.period = event.target.value;
    state.page = 1;
    render();
  });
  render();
}

boot().catch(() => {
  $("#run-grid").innerHTML =
    "<div class='empty-state'><h3>Could not load report data</h3><p>Refresh the page or contact the QA team.</p></div>";
});
