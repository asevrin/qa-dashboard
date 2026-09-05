const $ = (selector) => document.querySelector(selector);
const state = { run: null };

function escapeHtml(value) {
  const node = document.createElement("span");
  node.textContent = value || "";
  return node.innerHTML;
}

function applyTheme() {
  const current = localStorage.getItem("qa-theme") || "dark";
  document.documentElement.dataset.theme = current;
  $("#theme-label").textContent = current === "dark" ? "Dark" : "Light";
  $("#theme-toggle").onclick = () => {
    const next =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("qa-theme", next);
    $("#theme-label").textContent = next === "dark" ? "Dark" : "Light";
  };
}

function artifactList(caseItem) {
  const evidence = caseItem.evidence.length
    ? `<ul class="summary-artifact-list">${caseItem.evidence.map((item) => `<li><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.label)}</a></li>`).join("")}</ul>`
    : "";
  const defects = caseItem.defects.length
    ? `<ul class="summary-artifact-list">${caseItem.defects.map((item) => `<li><span class="severity ${escapeHtml(item.severity)}">${escapeHtml(item.severity)}</span><strong>#${item.defectNumber} · ${escapeHtml(item.title)}</strong></li>`).join("")}</ul>`
    : "";
  if (!evidence && !defects) return "";
  return `<div class="summary-artifacts">${evidence ? `<div><h3>Evidence</h3>${evidence}</div>` : ""}${defects ? `<div><h3>Defects</h3>${defects}</div>` : ""}</div>`;
}

function snapshotDetails(caseItem) {
  const steps = caseItem.steps.length
    ? `<ol class="summary-steps">${caseItem.steps.map((step) => `<li><strong>${escapeHtml(step.action)}</strong>${step.testData ? `<p><span>Test data</span>${escapeHtml(step.testData)}</p>` : ""}${step.expectedResult ? `<p><span>Expected</span>${escapeHtml(step.expectedResult)}</p>` : ""}</li>`).join("")}</ol>`
    : "<p class=detail-empty>No explicit steps.</p>";
  return `<div class="problem-case-content"><div class="snapshot-properties"><span>${escapeHtml(caseItem.priority)} priority</span><span>${escapeHtml(caseItem.executionScope)} scope</span></div><div class="snapshot-grid"><section><h3>Preconditions</h3><p>${escapeHtml(caseItem.preconditions || "None")}</p></section></div><section class="snapshot-section"><h3>Steps</h3>${steps}</section><section class="snapshot-section"><h3>Expected result</h3><p>${escapeHtml(caseItem.expectedResult || "Not specified")}</p></section>${caseItem.notes ? `<section class="snapshot-section"><h3>Notes</h3><p>${escapeHtml(caseItem.notes)}</p></section>` : ""}<section class="snapshot-section execution-note"><h3>Execution result</h3><p>${caseItem.resultComment ? escapeHtml(caseItem.resultComment) : "No comment provided."}</p></section>${artifactList(caseItem)}</div>`;
}

function render() {
  const counts = Object.fromEntries(
    ["passed", "failed", "blocked", "skipped", "pending"].map((result) => [
      result,
      state.run.cases.filter((caseItem) => caseItem.result === result).length,
    ]),
  );
  const completed = state.run.cases.length - counts.pending;
  const problems = state.run.cases.filter((caseItem) =>
    ["failed", "blocked"].includes(caseItem.result),
  );
  $("#run-name").textContent = `#${state.run.runNumber} · ${state.run.name}`;
  $("#run-meta").textContent =
    `${state.run.status.replaceAll("_", " ")} · ${state.run.environment}${state.run.buildLabel ? ` · ${state.run.buildLabel}` : ""}${state.run.executorName ? ` · ${state.run.executorName}` : ""}`;
  $("#summary-metrics").innerHTML =
    `<article class="summary-total"><strong>${completed}<span>/${state.run.cases.length}</span></strong><span>Cases completed</span></article><div class="status-metrics">${["passed", "failed", "blocked", "skipped", "pending"].map((result) => `<article class="status-metric ${result}"><span>${result}</span><strong>${counts[result]}</strong></article>`).join("")}</div>`;
  $("#problem-count").textContent = `${problems.length} cases`;
  $("#problem-cases").innerHTML = problems.length
    ? problems
        .map(
          (caseItem) =>
            `<details class="problem-case"><summary class="problem-case-heading"><div><span class="case-key">${escapeHtml(caseItem.caseKey)}</span><h3>${escapeHtml(caseItem.title)}</h3></div><span class="problem-case-meta"><span class="result-pill ${caseItem.result}">${caseItem.result}</span><span class="disclosure" aria-hidden="true">⌄</span></span></summary>${snapshotDetails(caseItem)}</details>`,
        )
        .join("")
    : `<div class="empty-state"><span>✓</span><h2>No problem cases</h2><p>This run has no failed or blocked cases.</p></div>`;
}

async function load() {
  const id = new URLSearchParams(location.search).get("id");
  if (!id) throw new Error("This summary link has no test run ID.");
  const response = await fetch(`/api/tms/runs/${id}`);
  if (!response.ok) throw new Error("Could not load run summary");
  state.run = await response.json();
  render();
}

applyTheme();
load().catch((error) => {
  TmsUi.showError(
    $("#problem-cases"),
    "Run summary is unavailable",
    error.message,
    "../",
  );
});
