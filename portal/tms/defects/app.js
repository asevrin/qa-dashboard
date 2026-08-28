const $ = (selector) => document.querySelector(selector);
const state = {
  defects: [],
  selectedId: null,
  query: "",
  status: "all",
  severity: "all",
};

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
function filteredDefects() {
  return state.defects.filter(
    (defect) =>
      (state.status === "all" || defect.status === state.status) &&
      (state.severity === "all" || defect.severity === state.severity) &&
      [
        defect.defectNumber,
        defect.title,
        defect.caseKey,
        defect.caseTitle,
        defect.runName,
      ]
        .join(" ")
        .toLowerCase()
        .includes(state.query),
  );
}
function runLink(defect) {
  return defect.runId
    ? `../runs/${defect.runStatus === "in_progress" ? "execute" : "summary"}/?id=${encodeURIComponent(defect.runId)}`
    : "";
}
function details(defect) {
  return `<div class="defect-details"><section><h3>Steps to reproduce</h3><p>${escapeHtml(defect.stepsToReproduce || "Not provided")}</p></section><section><h3>Actual result</h3><p>${escapeHtml(defect.actualResult || "Not provided")}</p></section><section><h3>Expected result</h3><p>${escapeHtml(defect.expectedResult || "Not provided")}</p></section></div>`;
}
function render() {
  const defects = filteredDefects();
  $("#defect-list").innerHTML = defects.length
    ? defects
        .map(
          (defect) =>
            `<details class="defect-row"><summary><div class="defect-main"><div class="defect-heading"><span class="defect-number">#${defect.defectNumber}</span><span class="severity ${escapeHtml(defect.severity)}">${escapeHtml(defect.severity)}</span><span class="status ${escapeHtml(defect.status)}">${escapeHtml(defect.status.replaceAll("_", " "))}</span></div><h2>${escapeHtml(defect.title)}</h2><p>${defect.caseKey ? `${escapeHtml(defect.caseKey)} · ${escapeHtml(defect.caseTitle)}` : "Run case unavailable"}${defect.runName ? ` · ${escapeHtml(defect.runName)}` : ""}</p></div><span class="disclosure" aria-hidden="true">⌄</span></summary>${details(defect)}<div class="defect-actions">${defect.externalIssueUrl ? `<a class="secondary-button" href="${escapeHtml(defect.externalIssueUrl)}" target="_blank" rel="noopener noreferrer">External issue ↗</a>` : ""}${runLink(defect) ? `<a class="secondary-button" href="${runLink(defect)}">Open run</a>` : ""}<button class="secondary-button" data-edit="${defect.id}" type="button">Edit</button></div></details>`,
        )
        .join("")
    : `<div class="empty-state"><span>✓</span><h2>No defects found</h2><p>Defects created during runs will appear here.</p></div>`;
  $("#defect-list")
    .querySelectorAll("[data-edit]")
    .forEach((button) => {
      button.onclick = () => openDialog(button.dataset.edit);
    });
}
function openDialog(id) {
  const defect = state.defects.find((item) => item.id === id);
  if (!defect) return;
  state.selectedId = id;
  $("#defect-dialog-title").textContent = `Update #${defect.defectNumber}`;
  $("#defect-context").textContent =
    `${defect.caseKey || "Run case"} · ${defect.title}`;
  $("#defect-status").value = defect.status;
  $("#defect-external-url").value = defect.externalIssueUrl || "";
  $("#defect-message").textContent = "";
  $("#defect-dialog").showModal();
}
async function load() {
  const response = await fetch("/api/tms/defects");
  if (!response.ok) throw new Error("Could not load defects");
  state.defects = await response.json();
  render();
}
applyTheme();
$("#defect-search").oninput = (event) => {
  state.query = event.target.value.trim().toLowerCase();
  render();
};
$("#status-filter").onchange = (event) => {
  state.status = event.target.value;
  render();
};
$("#severity-filter").onchange = (event) => {
  state.severity = event.target.value;
  render();
};
document.querySelectorAll("[data-close]").forEach((button) => {
  button.onclick = () => $("#defect-dialog").close();
});
$("#defect-form").onsubmit = async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (form.dataset.submitting) return;
  TmsUi.setSubmitting(form, true);
  try {
    const response = await fetch(`/api/tms/defects/${state.selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: $("#defect-status").value,
        externalIssueUrl: $("#defect-external-url").value,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      $("#defect-message").textContent = payload.error;
      return;
    }
    const defect = state.defects.find((item) => item.id === state.selectedId);
    Object.assign(defect, payload);
    $("#defect-dialog").close();
    render();
  } catch {
    $("#defect-message").textContent = "Could not reach Manual TMS. Try again.";
  } finally {
    TmsUi.setSubmitting(form, false);
  }
};
load().catch((error) => {
  TmsUi.showError($("#defect-list"), "Defects are unavailable", error.message);
});
