const $ = (selector) => document.querySelector(selector);
const state = {
  run: null,
  activeId: null,
  filter: "all",
  problemCaseId: null,
  saving: false,
};

async function saveOnce(task) {
  if (state.saving) return;
  state.saving = true;
  try {
    return await task();
  } finally {
    state.saving = false;
  }
}

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

function visibleCases() {
  return state.run.cases.filter(
    (caseItem) => state.filter === "all" || caseItem.result === state.filter,
  );
}

function renderNav() {
  const completed = state.run.cases.filter(
    (caseItem) => caseItem.result !== "pending",
  ).length;
  $("#progress").textContent =
    `${completed}/${state.run.cases.length} complete`;
  $("#run-case-nav").innerHTML =
    visibleCases()
      .map(
        (caseItem) => `
    <button class="case-nav-item ${caseItem.id === state.activeId ? "active" : ""}" data-case="${caseItem.id}">
      <span>${caseItem.position + 1}</span><span>${escapeHtml(caseItem.caseKey)} · ${escapeHtml(caseItem.title)}</span><em class="${caseItem.result}">${caseItem.result}</em>
    </button>`,
      )
      .join("") || "<p class=case-summary>No cases.</p>";
  $("#run-case-nav")
    .querySelectorAll("[data-case]")
    .forEach((button) => {
      button.onclick = () => {
        state.activeId = button.dataset.case;
        renderNav();
        renderCase();
      };
    });
}

function renderCase() {
  const caseItem = state.run.cases.find((item) => item.id === state.activeId);
  if (!caseItem) {
    $("#execution-case").innerHTML =
      "<div class=empty-state><h2>Select a case</h2></div>";
    return;
  }
  const steps = caseItem.steps.length
    ? `<div class="run-steps">${caseItem.steps
        .map(
          (step, index) => `
    <div class="run-step"><strong>${index + 1}</strong><div class="run-step-action"><span>Action</span><b>${escapeHtml(step.action)}</b>${step.testData ? `<p class="run-step-data">${escapeHtml(step.testData)}</p>` : ""}</div>${step.expectedResult ? `<div class="run-step-expected"><span>Expected result</span><p>${escapeHtml(step.expectedResult)}</p></div>` : ""}</div>`,
        )
        .join("")}</div>`
    : "<p>No explicit steps.</p>";
  const evidence = caseItem.evidence.length
    ? `<ul class="artifact-list">${caseItem.evidence.map((item) => `<li><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.label)}</a></li>`).join("")}</ul>`
    : "<p class=artifact-empty>No evidence links yet.</p>";
  const defects = caseItem.defects.length
    ? `<ul class="artifact-list">${caseItem.defects.map((item) => `<li><span class="defect-severity ${escapeHtml(item.severity)}">${escapeHtml(item.severity)}</span><strong>#${item.defectNumber} · ${escapeHtml(item.title)}</strong></li>`).join("")}</ul>`
    : "<p class=artifact-empty>No defects yet.</p>";
  const problemArtifacts = ["failed", "blocked"].includes(caseItem.result)
    ? `<section class="execution-section case-artifacts"><div class="artifact-heading"><h3>Evidence <span>${caseItem.evidence.length}</span></h3></div>${evidence}</section><section class="execution-section case-artifacts"><div class="artifact-heading"><h3>Defects <span>${caseItem.defects.length}</span></h3></div>${defects}</section>`
    : "";
  const result =
    state.run.status === "in_progress"
      ? `<textarea class="result-comment" id="result-comment" rows="3" placeholder="Comment for failed or blocked case…">${escapeHtml(caseItem.resultComment)}</textarea><div class="result-actions"><button class="passed" data-result="passed">Passed</button><button class="failed" data-result="failed">Failed</button><button class="blocked" data-result="blocked">Blocked</button><button data-result="skipped">Skipped</button><button data-result="pending">Reset</button></div><p class="result-message" id="result-message"></p>`
      : `<p class="read-only-result ${escapeHtml(caseItem.result)}">${escapeHtml(caseItem.result)}${caseItem.resultComment ? ` · ${escapeHtml(caseItem.resultComment)}` : ""}</p>`;
  $("#execution-case").innerHTML =
    `<div class="case-kicker">${escapeHtml(caseItem.caseKey)} · ${escapeHtml(caseItem.priority)} · ${escapeHtml(caseItem.executionScope)}</div><h2>${escapeHtml(caseItem.title)}</h2><section class="execution-section"><h3>Preconditions</h3><p>${escapeHtml(caseItem.preconditions || "None")}</p></section><section class="execution-section"><h3>Steps</h3>${steps}</section><section class="execution-section"><h3>Expected result</h3><p>${escapeHtml(caseItem.expectedResult || "Not specified")}</p></section>${problemArtifacts}<section class="execution-section"><h3>Result</h3>${result}</section>`;
  $("#execution-case")
    .querySelectorAll("[data-result]")
    .forEach((button) => {
      button.onclick = () => saveResult(button.dataset.result);
    });
}

function openProblemDialog() {
  const caseItem = state.run.cases.find(
    (item) => item.id === state.problemCaseId,
  );
  if (!caseItem) return;
  $("#problem-dialog-title").textContent = `Case marked ${caseItem.result}`;
  $("#problem-dialog").showModal();
}

function nextPendingCase(afterCaseId) {
  const currentIndex = state.run.cases.findIndex(
    (caseItem) => caseItem.id === afterCaseId,
  );
  const casesAfterCurrent = state.run.cases.slice(currentIndex + 1);
  return (
    casesAfterCurrent.find((caseItem) => caseItem.result === "pending") ||
    state.run.cases
      .slice(0, currentIndex)
      .find((caseItem) => caseItem.result === "pending")
  );
}

function continueToNextCase() {
  $("#problem-dialog").close();
  const problemCaseId = state.problemCaseId;
  state.problemCaseId = null;
  const nextCase = nextPendingCase(problemCaseId);
  if (nextCase) state.activeId = nextCase.id;
  renderNav();
  renderCase();
}

function closeExtraDialog(dialog) {
  dialog.close();
  if (state.problemCaseId) openProblemDialog();
}

function openExtraDialog(kind) {
  const caseItem = state.run.cases.find(
    (item) => item.id === state.problemCaseId,
  );
  if (!caseItem) return;
  const dialog = `#${kind}-dialog`;
  $(dialog).querySelector("form").reset();
  $(dialog).querySelector(".form-message").textContent = "";
  if (kind === "defect") {
    $("#defect-expected").value = caseItem.expectedResult || "";
    $("#defect-steps").value = caseItem.steps
      .map(
        (step, index) =>
          `${index + 1}. ${step.action}${step.testData ? `\n   Test data: ${step.testData}` : ""}${step.expectedResult ? `\n   Expected: ${step.expectedResult}` : ""}`,
      )
      .join("\n\n");
  }
  $("#problem-dialog").close();
  $(dialog).showModal();
}

async function saveResult(result) {
  return saveOnce(async () => {
    const caseItem = state.run.cases.find((item) => item.id === state.activeId);
    const resultComment = $("#result-comment").value;
    const response = await fetch(
      `/api/tms/runs/${state.run.id}/cases/${caseItem.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result, resultComment, durationSeconds: null }),
      },
    );
    const payload = await response.json();
    if (!response.ok) {
      $("#result-message").textContent = payload.error;
      return;
    }
    caseItem.result = result;
    caseItem.resultComment = resultComment;
    renderNav();
    renderCase();
    if (["failed", "blocked"].includes(result)) {
      state.problemCaseId = caseItem.id;
      openProblemDialog();
      return;
    }
    if (result !== "pending") {
      const nextCase = nextPendingCase(caseItem.id);
      if (nextCase) {
        state.activeId = nextCase.id;
        renderNav();
        renderCase();
      }
    }
  });
}

async function submitEvidence(event) {
  event.preventDefault();
  return saveOnce(async () => {
    const response = await fetch(
      `/api/tms/runs/${state.run.id}/cases/${state.problemCaseId}/evidence`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: $("#evidence-label").value,
          url: $("#evidence-url").value,
        }),
      },
    );
    const payload = await response.json();
    if (!response.ok) {
      $("#evidence-message").textContent = payload.error;
      return;
    }
    state.run.cases
      .find((caseItem) => caseItem.id === state.problemCaseId)
      .evidence.push(payload);
    renderCase();
    closeExtraDialog($("#evidence-dialog"));
  });
}

async function submitDefect(event) {
  event.preventDefault();
  return saveOnce(async () => {
    const response = await fetch(
      `/api/tms/runs/${state.run.id}/cases/${state.problemCaseId}/defects`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: $("#defect-title").value,
          severity: $("#defect-severity").value,
          stepsToReproduce: $("#defect-steps").value,
          actualResult: $("#defect-actual").value,
          expectedResult: $("#defect-expected").value,
        }),
      },
    );
    const payload = await response.json();
    if (!response.ok) {
      $("#defect-message").textContent = payload.error;
      return;
    }
    state.run.cases
      .find((caseItem) => caseItem.id === state.problemCaseId)
      .defects.push(payload);
    renderCase();
    closeExtraDialog($("#defect-dialog"));
  });
}

async function load() {
  const id = new URLSearchParams(location.search).get("id");
  if (!id) throw new Error("This execution link has no test run ID.");
  const response = await fetch(`/api/tms/runs/${id}`);
  if (!response.ok) throw new Error("Could not load run");
  state.run = await response.json();
  state.activeId =
    state.run.cases.find((caseItem) => caseItem.result === "pending")?.id ||
    state.run.cases[0]?.id;
  $("#run-name").textContent = `#${state.run.runNumber} · ${state.run.name}`;
  $("#run-meta").textContent =
    `${state.run.environment}${state.run.buildLabel ? ` · ${state.run.buildLabel}` : ""}${state.run.executorName ? ` · ${state.run.executorName}` : ""}`;
  $("#complete-run").hidden = state.run.status !== "in_progress";
  $("#abort-run").hidden = state.run.status !== "in_progress";
  renderNav();
  renderCase();
}

applyTheme();
$("#result-filter").onchange = (event) => {
  state.filter = event.target.value;
  renderNav();
};
$("#problem-evidence").onclick = () => openExtraDialog("evidence");
$("#problem-defect").onclick = () => openExtraDialog("defect");
$("#problem-continue").onclick = continueToNextCase;
$("#problem-dialog").addEventListener("cancel", (event) =>
  event.preventDefault(),
);
document.querySelectorAll("[data-close]").forEach((button) => {
  button.onclick = () => {
    const dialog = button.closest("dialog");
    if (["evidence-dialog", "defect-dialog"].includes(dialog.id))
      closeExtraDialog(dialog);
    else dialog.close();
  };
});
$("#evidence-form").onsubmit = submitEvidence;
$("#defect-form").onsubmit = submitDefect;
$("#abort-run").onclick = () => $("#abort-dialog").showModal();
$("#confirm-abort").onclick = async () => {
  const response = await fetch(`/api/tms/runs/${state.run.id}/abort`, {
    method: "POST",
  });
  const payload = await response.json();
  if (!response.ok) {
    alert(payload.error);
    return;
  }
  location.assign(`../summary/?id=${encodeURIComponent(state.run.id)}`);
};
$("#complete-run").onclick = async () => {
  const response = await fetch(`/api/tms/runs/${state.run.id}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      force: confirm("Complete this run even if pending cases remain?"),
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    alert(`${payload.error} (${payload.pendingCount} pending)`);
    return;
  }
  location.assign("../");
};
load().catch((error) => {
  TmsUi.showError(
    $("#execution-case"),
    "Execution is unavailable",
    error.message,
    "../",
  );
});
