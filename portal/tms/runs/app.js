const $ = (selector) => document.querySelector(selector);
const state = { runs: [], plans: [], query: "", status: "all" };

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

function runUrl(run) {
  const screen = run.status === "in_progress" ? "execute" : "summary";
  return `./${screen}/?id=${encodeURIComponent(run.id)}`;
}

function visibleRuns() {
  return state.runs.filter(
    (run) =>
      (state.status === "all" || run.status === state.status) &&
      `${run.name} ${run.environment} ${run.buildLabel} ${run.executorName}`
        .toLowerCase()
        .includes(state.query),
  );
}

function render() {
  const runs = visibleRuns();
  $("#runs-list").innerHTML = runs.length
    ? runs
        .map(
          (run) => `
    <article class="run-row"><div><h2>#${run.runNumber} · ${escapeHtml(run.name)}</h2><p>${escapeHtml(run.environment)}${run.buildLabel ? ` · ${escapeHtml(run.buildLabel)}` : ""}${run.executorName ? ` · ${escapeHtml(run.executorName)}` : ""}</p></div><div class="run-results"><span class="passed">P ${run.passedCount}</span><span class="failed">F ${run.failedCount}</span><span class="blocked">B ${run.blockedCount}</span><span class="skipped">S ${run.skippedCount}</span></div><span class="run-progress">${run.passedCount + run.failedCount + run.blockedCount + run.skippedCount}/${run.caseCount} complete</span><span class="run-status ${run.status}">${escapeHtml(run.status)}</span><a class="secondary-button" href="${runUrl(run)}">${run.status === "in_progress" ? "Execute" : "Summary"}</a></article>`,
        )
        .join("")
    : state.runs.length
      ? `<div class="empty-state"><h2>No matching runs</h2><p>Try another search or status.</p></div>`
      : `<div class="empty-state"><h2>No test runs yet</h2><p>Create a run from an active test plan.</p></div>`;
}

async function load() {
  const [runsResponse, plansResponse] = await Promise.all([
    fetch("/api/tms/runs"),
    fetch("/api/tms/plans"),
  ]);
  state.runs = await runsResponse.json();
  state.plans = (await plansResponse.json()).filter(
    (plan) => plan.status === "active",
  );
  $("#run-plan").innerHTML = state.plans
    .map(
      (plan) =>
        `<option value="${plan.id}">${escapeHtml(plan.name)} · ${plan.caseIds.length} cases</option>`,
    )
    .join("");
  render();
}

function closeDialog() {
  $("#run-dialog").close();
  $("#run-form").reset();
}

function setupFilters() {
  const toolbar = document.createElement("section");
  toolbar.className = "run-toolbar";
  toolbar.innerHTML = `<label class="search"><span aria-hidden="true">⌕</span><input id="run-search" type="search" placeholder="Search runs…"></label><select id="run-status-filter" aria-label="Filter by run status"><option value="all">All statuses</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="aborted">Aborted</option></select>`;
  $("#runs-list").before(toolbar);
  $("#run-search").oninput = (event) => {
    state.query = event.target.value.trim().toLowerCase();
    render();
  };
  $("#run-status-filter").onchange = (event) => {
    state.status = event.target.value;
    render();
  };
}

applyTheme();
setupFilters();
$("#new-run").onclick = () => {
  $("#run-message").textContent = state.plans.length
    ? ""
    : "Create an active test plan first.";
  $("#run-dialog").showModal();
};
document.querySelectorAll("[data-close]").forEach((button) => {
  button.onclick = closeDialog;
});
$("#run-form").onsubmit = async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (form.dataset.submitting) return;
  TmsUi.setSubmitting(form, true);
  try {
    const response = await fetch("/api/tms/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: $("#run-name").value,
        planId: $("#run-plan").value,
        environment: $("#run-environment").value,
        buildLabel: $("#run-build").value,
        executorName: $("#run-executor").value,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      $("#run-message").textContent =
        payload.error || "Could not create test run";
      return;
    }
    location.assign(`./execute/?id=${encodeURIComponent(payload.id)}`);
  } catch {
    $("#run-message").textContent = "Could not reach Manual TMS. Try again.";
  } finally {
    TmsUi.setSubmitting(form, false);
  }
};
load().catch((error) => {
  TmsUi.showError($("#runs-list"), "Test runs are unavailable", error.message);
});
