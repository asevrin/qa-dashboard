const state = {
  suites: [],
  cases: [],
  selectedSuite: "all",
  selectedCaseId: null,
  query: "",
  scope: "all",
  priority: "all",
  status: "all",
  automation: "all",
  tag: "all",
  steps: [],
  importPreview: null,
  syncPreview: null,
};
const $ = (selector) => document.querySelector(selector);
function escapeHtml(value) {
  const node = document.createElement("span");
  node.textContent = value || "";
  return node.innerHTML;
}
function setTheme() {
  const theme =
    localStorage.getItem("qa-theme") ||
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
function suiteDepth(suite) {
  let depth = 0,
    current = suite;
  while (current.parentId) {
    current = state.suites.find((item) => item.id === current.parentId);
    if (!current) break;
    depth += 1;
  }
  return depth;
}
function visibleCases() {
  return state.cases.filter(
    (item) =>
      (state.selectedSuite === "all" || item.suiteId === state.selectedSuite) &&
      (state.scope === "all" || item.executionScope === state.scope) &&
      (state.priority === "all" || item.priority === state.priority) &&
      (state.status === "all" || item.status === state.status) &&
      (state.automation === "all" ||
        item.automationStatus === state.automation) &&
      (state.tag === "all" || item.tags.includes(state.tag)) &&
      `${item.caseKey} ${item.title} ${item.tags.join(" ")}`
        .toLowerCase()
        .includes(state.query),
  );
}
function pluralize(value, noun) {
  return `${value} ${noun}${value === 1 ? "" : "s"}`;
}
function render() {
  const cases = visibleCases();
  $("#suite-count").textContent = `${state.suites.length}`;
  $("#suite-tree").innerHTML = [
    `<button class="suite-node ${state.selectedSuite === "all" ? "active" : ""}" data-suite="all">All cases<small>${pluralize(state.cases.length, "case")}</small></button>`,
    ...state.suites.map(
      (suite) =>
        `<button class="suite-node ${state.selectedSuite === suite.id ? "active" : ""}" data-suite="${suite.id}" style="padding-left:${8 + suiteDepth(suite) * 16}px">${escapeHtml(suite.name)}<small>${pluralize(state.cases.filter((item) => item.suiteId === suite.id).length, "case")}</small></button>`,
    ),
  ].join("");
  $("#suite-tree")
    .querySelectorAll("[data-suite]")
    .forEach((button) =>
      button.addEventListener("click", () => {
        state.selectedSuite = button.dataset.suite;
        render();
      }),
    );
  $("#case-summary").textContent =
    `${cases.length} of ${pluralize(state.cases.length, "test case")}`;
  $("#case-list").innerHTML = cases.length
    ? cases
        .map(
          (item) =>
            `<button class="case-card" type="button" data-case="${item.id}"><div class="case-key">${escapeHtml(item.caseKey)}</div><div><h2>${escapeHtml(item.title)}</h2><div class="case-meta"><span class="pill ${item.priority}">${item.priority}</span><span class="pill ${item.executionScope}">${item.executionScope}</span><span class="pill">${item.status}</span>${item.steps.length ? `<span class="case-tag">${pluralize(item.steps.length, "step")}</span>` : ""}${item.tags.map((tag) => `<span class="case-tag">${escapeHtml(tag)}</span>`).join("")}</div></div></button>`,
        )
        .join("")
    : $("#empty-state").innerHTML;
  $("#case-list")
    .querySelectorAll("[data-case]")
    .forEach((button) =>
      button.addEventListener("click", () => openCase(button.dataset.case)),
    );
}
async function loadRepository() {
  const response = await fetch("/api/tms/repository", { cache: "no-store" });
  if (!response.ok)
    throw new Error(
      (await response.json().catch(() => ({}))).error ||
        "Could not load the repository",
    );
  Object.assign(state, await response.json());
  populateTagFilter();
  render();
  populateSuites();
}
function populateSuites() {
  const options = state.suites
    .map(
      (suite) =>
        `<option value="${suite.id}">${"  ".repeat(suiteDepth(suite))}${escapeHtml(suite.name)}</option>`,
    )
    .join("");
  $("#suite-parent").innerHTML =
    `<option value="">No parent (top level)</option>${options}`;
  $("#case-suite").innerHTML = options;
}
function renderSteps() {
  $("#steps-list").innerHTML =
    state.steps
      .map(
        (step, index) =>
          `<article class="step-editor"><div class="step-editor-heading"><strong>Step ${index + 1}</strong><button class="step-remove-button" type="button" data-remove-step="${index}" aria-label="Remove step ${index + 1}" title="Remove step"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M9 7l1-2h4l1 2m-9 0 1 13h10l1-13" /></svg></button></div><label>Action<textarea data-step="action" data-index="${index}" rows="1" maxlength="20000" required>${escapeHtml(step.action)}</textarea></label><label>Expected result<textarea data-step="expectedResult" data-index="${index}" rows="1" maxlength="20000">${escapeHtml(step.expectedResult)}</textarea></label><details class="step-editor-optional"${step.testData ? " open" : ""}><summary>Test data <span>Optional</span></summary><label><textarea data-step="testData" data-index="${index}" rows="1" maxlength="20000" placeholder="Add values, credentials, or setup data…">${escapeHtml(step.testData)}</textarea></label></details></article>`,
      )
      .join("") ||
    `<p class="case-steps-empty">No steps yet. Add a step if the case needs an explicit flow.</p>`;
  $("#steps-list")
    .querySelectorAll("[data-remove-step]")
    .forEach((button) =>
      button.addEventListener("click", () => {
        state.steps.splice(Number(button.dataset.removeStep), 1);
        renderSteps();
      }),
    );
  $("#steps-list")
    .querySelectorAll("[data-step]")
    .forEach((field) =>
      field.addEventListener("input", () => {
        state.steps[Number(field.dataset.index)][field.dataset.step] =
          field.value;
      }),
    );
}
function openDialog(id) {
  $(id).querySelector(".form-message").textContent = "";
  $(id).showModal();
}
function closeDialog(dialog) {
  dialog.close();
  dialog.querySelector("form").reset();
  state.selectedCaseId = null;
  state.steps = [];
}
function casePayload() {
  return {
    caseKey: $("#case-key").value,
    suiteId: $("#case-suite").value,
    title: $("#case-title").value,
    expectedResult: $("#case-expected").value,
    preconditions: $("#case-preconditions").value,
    notes: $("#case-notes").value,
    priority: $("#case-priority").value,
    executionScope: $("#case-scope").value,
    status: $("#case-status").value,
    automationStatus: $("#case-automation").value,
    tags: $("#case-tags")
      .value.split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    steps: state.steps.map((step) => ({
      action: step.action.trim(),
      testData: step.testData.trim(),
      expectedResult: step.expectedResult.trim(),
    })),
  };
}
function openNewCase() {
  state.selectedCaseId = null;
  state.steps = [];
  $("#case-delete").hidden = true;
  $("#case-form").reset();
  $("#case-key").disabled = false;
  $("#case-dialog-title").textContent = "New test case";
  $("#case-submit").textContent = "Create case";
  renderSteps();
  openDialog("#case-dialog");
}
function openCase(id) {
  const item = state.cases.find((caseItem) => caseItem.id === id);
  if (!item) return;
  state.selectedCaseId = id;
  state.steps = item.steps.map((step) => ({ ...step }));
  $("#case-delete").hidden = false;
  $("#case-key").value = item.caseKey;
  $("#case-key").disabled = true;
  $("#case-suite").value = item.suiteId;
  $("#case-title").value = item.title;
  $("#case-expected").value = item.expectedResult || "";
  $("#case-preconditions").value = item.preconditions || "";
  $("#case-notes").value = item.notes || "";
  $("#case-priority").value = item.priority;
  $("#case-scope").value = item.executionScope;
  $("#case-status").value = item.status;
  $("#case-automation").value = item.automationStatus;
  $("#case-tags").value = item.tags.join(", ");
  $("#case-dialog-title").textContent = `Edit ${item.caseKey}`;
  $("#case-submit").textContent = "Save";
  renderSteps();
  openDialog("#case-dialog");
}
async function submit(url, method, body, message, dialog) {
  const form = dialog.querySelector("form");
  if (form.dataset.submitting) return;
  TmsUi.setSubmitting(form, true);
  message.textContent = "Saving…";
  message.className = "form-message";
  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      message.textContent = payload.error || "Could not save";
      return;
    }
    message.textContent = "Saved";
    message.className = "form-message success";
    await loadRepository();
    setTimeout(() => closeDialog(dialog), 250);
  } catch {
    message.textContent = "Could not reach Manual TMS. Try again.";
  } finally {
    TmsUi.setSubmitting(form, false);
  }
}
async function deleteSelectedCase() {
  const item = state.cases.find((caseItem) => caseItem.id === state.selectedCaseId);
  if (!item || !confirm(`Delete ${item.caseKey}? This cannot be undone.`)) return;
  const button = $("#case-delete");
  const message = $("#case-message");
  button.disabled = true;
  message.textContent = "Deleting…";
  message.className = "form-message";
  try {
    const response = await fetch(`/api/tms/cases/${item.id}`, {
      method: "DELETE",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      message.textContent = payload.error || "Could not delete test case.";
      return;
    }
    await loadRepository();
    closeDialog($("#case-dialog"));
  } catch {
    message.textContent = "Could not reach Manual TMS. Try again.";
  } finally {
    button.disabled = false;
  }
}
function populateTagFilter() {
  const filter = $("#tag-filter");
  const tags = [...new Set(state.cases.flatMap((item) => item.tags))].sort(
    (left, right) => left.localeCompare(right),
  );
  if (state.tag !== "all" && !tags.includes(state.tag)) state.tag = "all";
  filter.innerHTML = `<option value="all">All tags</option>${tags.map((tag) => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`).join("")}`;
  filter.value = state.tag;
}
function setupRepositoryFilters() {
  $("#priority-filter").insertAdjacentHTML(
    "afterend",
    '<select id="status-filter" aria-label="Filter by case status"><option value="all">All statuses</option><option value="draft">Draft</option><option value="ready">Ready</option><option value="archived">Archived</option></select><select id="automation-filter" aria-label="Filter by automation"><option value="all">All automation</option><option value="manual">Manual</option><option value="to_be_automated">To be automated</option><option value="automated">Automated</option></select><select id="tag-filter" aria-label="Filter by tag"><option value="all">All tags</option></select>',
  );
  const style = document.createElement("style");
  style.textContent = `.repository-toolbar{grid-template-columns:minmax(180px,1fr) repeat(5,minmax(120px,150px))}@media(max-width:900px){.repository-toolbar{grid-template-columns:repeat(2,minmax(0,1fr))}.repository-toolbar .search{grid-column:1/-1}}@media(max-width:520px){.repository-toolbar{grid-template-columns:1fr}}`;
  document.head.append(style);
}
function wireForms() {
  document
    .querySelectorAll("[data-close]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        closeDialog(button.closest("dialog")),
      ),
    );
  $("#new-suite").addEventListener("click", () => openDialog("#suite-dialog"));
  $("#new-case").addEventListener("click", () =>
    state.suites.length ? openNewCase() : openDialog("#suite-dialog"),
  );
  $("#add-step").addEventListener("click", () => {
    state.steps.push({ action: "", testData: "", expectedResult: "" });
    renderSteps();
    requestAnimationFrame(() => {
      const actions = $("#steps-list").querySelectorAll('[data-step="action"]');
      actions[actions.length - 1]?.focus();
    });
  });
  $("#suite-form").addEventListener("submit", (event) => {
    event.preventDefault();
    submit(
      "/api/tms/suites",
      "POST",
      {
        name: $("#suite-name").value,
        parentId: $("#suite-parent").value || null,
        description: $("#suite-description").value,
      },
      $("#suite-message"),
      $("#suite-dialog"),
    );
  });
  $("#case-delete").addEventListener("click", deleteSelectedCase);
  $("#case-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const isEdit = Boolean(state.selectedCaseId);
    submit(
      isEdit ? `/api/tms/cases/${state.selectedCaseId}` : "/api/tms/cases",
      isEdit ? "PATCH" : "POST",
      casePayload(),
      $("#case-message"),
      $("#case-dialog"),
    );
  });
  $("#search").addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    render();
  });
  $("#scope-filter").addEventListener("change", (event) => {
    state.scope = event.target.value;
    render();
  });
  $("#priority-filter").addEventListener("change", (event) => {
    state.priority = event.target.value;
    render();
  });
  $("#status-filter").addEventListener("change", (event) => {
    state.status = event.target.value;
    render();
  });
  $("#automation-filter").addEventListener("change", (event) => {
    state.automation = event.target.value;
    render();
  });
  $("#tag-filter").addEventListener("change", (event) => {
    state.tag = event.target.value;
    render();
  });
}
function setupCaseTabs() {
  const dialog = $("#case-dialog");
  if (!dialog) return;
  const general = ["#case-title", "#case-preconditions", "#case-expected"].map(
    $,
  );
  const properties = [
    "#case-key",
    "#case-suite",
    "#case-priority",
    "#case-scope",
    "#case-status",
    "#case-automation",
    "#case-tags",
    "#case-notes",
  ].map($);
  const tabs = document.createElement("nav");
  tabs.className = "case-tabs";
  tabs.innerHTML = `<button class="active" data-case-tab="general" type="button">General</button><button data-case-tab="properties" type="button">Properties</button>`;
  dialog.querySelector(".form-grid").before(tabs);
  const setTab = (tab) => {
    dialog
      .querySelectorAll(".case-tab-general,.case-tab-properties")
      .forEach((node) => {
        node.hidden = !node.classList.contains(`case-tab-${tab}`);
      });
    tabs
      .querySelectorAll("button")
      .forEach((button) =>
        button.classList.toggle("active", button.dataset.caseTab === tab),
      );
  };
  general.forEach((field) =>
    field.closest("label").classList.add("case-tab-general"),
  );
  properties.forEach((field) =>
    field.closest("label").classList.add("case-tab-properties"),
  );
  dialog.querySelector(".case-steps").classList.add("case-tab-general");
  tabs
    .querySelectorAll("button")
    .forEach((button) =>
      button.addEventListener("click", () => setTab(button.dataset.caseTab)),
    );
  setTab("general");
  const style = document.createElement("style");
  style.textContent = `.case-tabs{display:flex;gap:18px;border-bottom:1px solid var(--line)}.case-tabs button{padding:0 0 8px;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--muted);cursor:pointer;font:800 13px inherit}.case-tabs button.active{border-color:var(--blue);color:var(--text)}.case-tab-properties[hidden],.case-tab-general[hidden]{display:none!important}`;
  document.head.append(style);
}
function refineGeneralTab() {
  const style = document.createElement("style");
  style.textContent = `.form-grid .case-tab-general{grid-column:1/-1}.form-grid > label.case-tab-general textarea{min-height:82px}.case-steps{padding-top:4px}`;
  document.head.append(style);
}
function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted && character === '"' && text[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') quoted = !quoted;
    else if (!quoted && character === ",") {
      row.push(cell);
      cell = "";
    } else if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += character;
  }
  if (quoted) throw new Error("CSV has an unclosed quoted value.");
  row.push(cell);
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
function suitePath(suite) {
  const names = [];
  let current = suite;
  while (current) {
    names.unshift(current.name);
    current = state.suites.find((item) => item.id === current.parentId);
  }
  return names;
}
function exportCsv() {
  const header = [
    "case_id",
    "suite_path",
    "title",
    "priority",
    "scope",
    "status",
    "automation",
    "preconditions",
    "expected_result",
    "notes",
    "tags",
    "steps",
  ];
  const lines = [
    header,
    ...state.cases.map((item) => [
      item.caseKey,
      JSON.stringify(
        suitePath(state.suites.find((suite) => suite.id === item.suiteId)),
      ),
      item.title,
      item.priority,
      item.executionScope,
      item.status,
      item.automationStatus,
      item.preconditions,
      item.expectedResult,
      item.notes,
      JSON.stringify(item.tags),
      JSON.stringify(item.steps),
    ]),
  ].map((row) => row.map(csvCell).join(","));
  const url = URL.createObjectURL(
    new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" }),
  );
  const link = Object.assign(document.createElement("a"), {
    href: url,
    download: "manual-tms-cases.csv",
  });
  link.click();
  URL.revokeObjectURL(url);
}
function csvCases(text) {
  const [header, ...rows] = parseCsv(text);
  if (header?.[0]) header[0] = header[0].replace(/^\uFEFF/, "");
  const required = [
    "case_id",
    "suite_path",
    "title",
    "priority",
    "scope",
    "status",
    "automation",
    "preconditions",
    "expected_result",
    "notes",
    "tags",
    "steps",
  ];
  if (!header || required.some((name, index) => header[index] !== name))
    throw new Error("CSV columns do not match the Manual TMS export format.");
  return rows.map((row, index) => {
    const value = Object.fromEntries(
      header.map((name, column) => [name, row[column] ?? ""]),
    );
    try {
      const suitePath = JSON.parse(value.suite_path);
      const tags = JSON.parse(value.tags);
      const steps = JSON.parse(value.steps);
      if (
        !Array.isArray(suitePath) ||
        !suitePath.length ||
        suitePath.some(
          (name) => typeof name !== "string" || !name.trim(),
        ) ||
        !Array.isArray(tags) ||
        !Array.isArray(steps)
      )
        throw new Error();
      return {
        caseKey: value.case_id,
        suitePath,
        title: value.title,
        priority: value.priority,
        executionScope: value.scope,
        status: value.status,
        automationStatus: value.automation,
        preconditions: value.preconditions,
        expectedResult: value.expected_result,
        notes: value.notes,
        tags,
        steps,
      };
    } catch {
      throw new Error(
        `Row ${index + 2} has invalid suite_path, tags, or steps JSON.`,
      );
    }
  });
}
function resetImportPreview() {
  state.importPreview = null;
  const preview = $("#import-preview");
  preview.hidden = true;
  preview.innerHTML = "";
  $("#import-confirm-submit").disabled = true;
}
function renderImportPreview({ fileName, cases, newCases, existingKeys, suites }) {
  const preview = $("#import-preview");
  const caseExamples = newCases
    .slice(0, 5)
    .map(
      (item) =>
        `<li><code>${escapeHtml(item.caseKey)}</code> ${escapeHtml(item.title)}</li>`,
    )
    .join("");
  const suiteExamples = suites
    .slice(0, 5)
    .map((path) => `<li>${escapeHtml(path.join(" / "))}</li>`)
    .join("");
  preview.hidden = false;
  preview.innerHTML = `<strong>Ready to import ${escapeHtml(fileName)}</strong><dl><div><dt>Rows in file</dt><dd>${cases.length}</dd></div><div><dt>New test cases</dt><dd>${newCases.length}</dd></div><div><dt>Existing Case IDs to skip</dt><dd>${existingKeys.length}</dd></div><div><dt>Suites to create</dt><dd>${suites.length}</dd></div></dl>${caseExamples ? `<div><span class="import-preview-label">First new cases</span><ul>${caseExamples}</ul></div>` : ""}${suiteExamples ? `<div><span class="import-preview-label">First suites to create</span><ul>${suiteExamples}</ul></div>` : ""}<p>Nothing has been added yet. Confirm to create the listed test cases and suites.</p>`;
}
async function previewCsv(file) {
  const message = $("#import-message");
  if (!file) {
    message.textContent = "Choose a CSV file first.";
    return;
  }
  let cases;
  try {
    cases = csvCases(await file.text());
  } catch (error) {
    message.textContent = error.message;
    return;
  }
  const fileKeys = new Set();
  const duplicateKeys = new Set();
  cases.forEach((item) => {
    if (fileKeys.has(item.caseKey)) duplicateKeys.add(item.caseKey);
    fileKeys.add(item.caseKey);
  });
  if (duplicateKeys.size) {
    resetImportPreview();
    message.textContent = `CSV contains duplicate Case IDs: ${[...duplicateKeys].slice(0, 5).join(", ")}${duplicateKeys.size > 5 ? "…" : ""}.`;
    return;
  }
  const currentKeys = new Set(state.cases.map((item) => item.caseKey));
  const newCases = cases.filter((item) => !currentKeys.has(item.caseKey));
  const currentSuitePaths = new Set(
    state.suites.map((suite) => JSON.stringify(suitePath(suite))),
  );
  const missingSuitePaths = new Map();
  newCases.forEach((item) => {
    item.suitePath.forEach((_, index) => {
      const path = item.suitePath.slice(0, index + 1);
      const key = JSON.stringify(path);
      if (!currentSuitePaths.has(key)) missingSuitePaths.set(key, path);
    });
  });
  state.importPreview = {
    cases,
    newCases,
    fileName: file.name,
    existingKeys: cases
      .filter((item) => currentKeys.has(item.caseKey))
      .map((item) => item.caseKey),
    missingSuitePaths: [...missingSuitePaths.values()],
  };
  renderImportPreview({
    fileName: file.name,
    cases,
    newCases,
    existingKeys: state.importPreview.existingKeys,
    suites: state.importPreview.missingSuitePaths,
  });
  $("#import-confirm-submit").disabled = !newCases.length;
  message.textContent = newCases.length
    ? "Review the preview, then confirm the import."
    : "All Case IDs already exist; there is nothing to import.";
  message.className = "form-message";
}
async function confirmCsvImport() {
  const message = $("#import-message");
  const button = $("#import-confirm-submit");
  const preview = state.importPreview;
  if (!preview) {
    message.textContent = "Preview the CSV before importing.";
    return;
  }
  button.disabled = true;
  message.textContent = `Importing ${preview.newCases.length} test cases…`;
  try {
    const existingKeys = new Set(state.cases.map((item) => item.caseKey));
    let created = 0;
    let skipped = 0;
    let createdSuites = 0;
    const suiteIds = new Map(
      state.suites.map((suite) => [JSON.stringify(suitePath(suite)), suite.id]),
    );
    for (const item of preview.newCases) {
      if (existingKeys.has(item.caseKey)) {
        skipped += 1;
        continue;
      }
      let parentId = null;
      for (let depth = 0; depth < item.suitePath.length; depth += 1) {
        const path = item.suitePath.slice(0, depth + 1);
        const key = JSON.stringify(path);
        if (!suiteIds.has(key)) {
          const response = await fetch("/api/tms/suites", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: path.at(-1),
              parentId,
              description: "",
            }),
          });
          const suite = await response.json();
          if (!response.ok)
            throw new Error(suite.error || "Could not create suite.");
          state.suites.push(suite);
          suiteIds.set(key, suite.id);
          createdSuites += 1;
        }
        parentId = suiteIds.get(key);
      }
      const response = await fetch("/api/tms/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...item, suiteId: parentId }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(
          `${item.caseKey}: ${payload.error || "could not import"}`,
        );
      existingKeys.add(item.caseKey);
      created += 1;
    }
    await loadRepository();
    state.importPreview = null;
    message.textContent = `Imported ${created} test cases and ${createdSuites} suites; skipped ${preview.existingKeys.length + skipped} existing Case IDs.`;
    message.className = "form-message success";
  } catch (error) {
    message.textContent = error.message || "Import stopped.";
    message.className = "form-message";
  } finally {
    if (state.importPreview) button.disabled = false;
  }
}
function resetSyncPreview() {
  state.syncPreview = null;
  const preview = $("#sync-preview");
  preview.hidden = true;
  preview.innerHTML = "";
  $("#sync-apply").disabled = true;
}
function syncExamples(items) {
  return items.slice(0, 5).map((item) => `<li><code>${escapeHtml(item.caseKey)}</code> ${escapeHtml(item.title)}</li>`).join("");
}
function renderSyncPreview(preview) {
  const target = $("#sync-preview");
  const sections = [["New test cases", preview.created], ["Test cases to update", preview.updated], ["Archive candidates", preview.archiveCandidates]]
    .filter(([, items]) => items.length)
    .map(([label, items]) => `<div><span class="import-preview-label">${label}</span><ul>${syncExamples(items)}</ul></div>`).join("");
  target.hidden = false;
  const archiveChoice = preview.archiveCandidates.length
    ? `<label class="sync-archive-choice"><input id="sync-archive-missing" type="checkbox">Archive ${preview.archiveCandidates.length} case${preview.archiveCandidates.length === 1 ? "" : "s"} missing from this CSV</label>`
    : "";
  target.innerHTML = `<strong>Synchronization preview for ${escapeHtml(preview.fileName)}</strong><dl><div><dt>Rows in file</dt><dd>${preview.total}</dd></div><div><dt>New</dt><dd>${preview.created.length}</dd></div><div><dt>Updated</dt><dd>${preview.updated.length}</dd></div><div><dt>Unchanged</dt><dd>${preview.unchanged.length}</dd></div><div><dt>Archive candidates</dt><dd>${preview.archiveCandidates.length}</dd></div></dl>${sections}${archiveChoice}<p>Applying updates creates new IDs and updates matching IDs. Archive candidates are unchanged unless selected above.</p>`;
}
async function previewChecklistSync(file) {
  const message = $("#sync-message");
  if (!file) return void (message.textContent = "Choose a CSV file first.");
  let cases;
  try { cases = csvCases(await file.text()); } catch (error) { message.textContent = error.message; return; }
  const response = await fetch("/api/tms/checklist-sync/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: file.name, cases }) });
  const preview = await response.json();
  if (!response.ok) return void (message.textContent = preview.error || "Could not preview synchronization.");
  state.syncPreview = { fileName: file.name, cases, preview };
  renderSyncPreview(preview);
  $("#sync-apply").disabled = !preview.created.length && !preview.updated.length;
  message.textContent = preview.created.length || preview.updated.length ? "Review the changes, then apply synchronization." : "This checklist is already up to date.";
  message.className = "form-message";
}
async function applyChecklistSync() {
  const message = $("#sync-message");
  if (!state.syncPreview) return;
  const button = $("#sync-apply");
  button.disabled = true;
  message.textContent = "Synchronizing checklist…";
  try {
    const response = await fetch("/api/tms/checklist-sync/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: state.syncPreview.fileName, cases: state.syncPreview.cases, archiveMissing: $("#sync-archive-missing")?.checked }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not synchronize checklist.");
    await loadRepository();
    message.textContent = `Synchronized ${result.fileName}: ${result.created} new, ${result.updated} updated, ${result.unchanged} unchanged.${result.archived ? ` ${result.archived} archived.` : result.archiveCandidates.length ? ` ${result.archiveCandidates.length} archive candidates were not changed.` : ""}`;
    message.className = "form-message success";
    state.syncPreview = null;
  } catch (error) {
    message.textContent = error.message || "Synchronization failed.";
    message.className = "form-message";
    button.disabled = false;
  }
}
async function loadSyncHistory() {
  const target = $("#sync-history");
  const response = await fetch("/api/tms/checklist-sync/history");
  if (!response.ok) return;
  const history = await response.json();
  target.innerHTML = history.length
    ? `<h3>Recent syncs</h3><ul>${history.map((item) => `<li><strong>${escapeHtml(item.sourceFile)}</strong> · ${item.created} new, ${item.updated} updated${item.archived ? `, ${item.archived} archived` : ""}<span>${escapeHtml(item.appliedAt)}</span></li>`).join("")}</ul>`
    : "";
}
function setupTransfer() {
  document
    .querySelector(".primary-actions")
    .insertAdjacentHTML(
      "afterbegin",
      '<button class="secondary-button" id="export-csv" type="button">Export CSV</button><button class="secondary-button" id="import-csv" type="button">Import CSV</button><button class="secondary-button" id="sync-csv" type="button">Synchronize CSV</button>',
    );
  document.body.insertAdjacentHTML(
    "beforeend",
    '<dialog id="import-dialog"><form method="dialog"><div class="dialog-heading"><h2>Import test cases</h2><button class="icon-button" data-import-close type="button">×</button></div><p>Preview a CSV exported from Manual TMS before creating anything. Missing suites are created; existing Case IDs are skipped.</p><label>CSV file<input id="import-file" type="file" accept=".csv,text/csv" required></label><section class="import-preview" id="import-preview" hidden></section><p class="form-message" id="import-message" aria-live="polite"></p><div class="dialog-actions"><button class="secondary-button" data-import-close type="button">Cancel</button><button class="secondary-button" id="import-preview-submit" type="button">Preview import</button><button class="primary-button" id="import-confirm-submit" type="button" disabled>Confirm import</button></div></form></dialog>',
  );
  document.body.insertAdjacentHTML(
    "beforeend",
    '<dialog id="sync-dialog"><form method="dialog"><div class="dialog-heading"><h2>Synchronize checklist</h2><button class="icon-button" data-sync-close type="button">×</button></div><p>Matching Case IDs are updated in place. New IDs are created. Cases absent from this CSV are archive candidates until you explicitly choose to archive them.</p><label>Checklist CSV<input id="sync-file" type="file" accept=".csv,text/csv" required></label><section class="import-preview" id="sync-preview" hidden></section><section class="sync-history" id="sync-history"></section><p class="form-message" id="sync-message" aria-live="polite"></p><div class="dialog-actions"><button class="secondary-button" data-sync-close type="button">Cancel</button><button class="secondary-button" id="sync-preview-submit" type="button">Preview changes</button><button class="primary-button" id="sync-apply" type="button" disabled>Apply sync</button></div></form></dialog>',
  );
  $("#export-csv").onclick = exportCsv;
  $("#import-csv").onclick = () => {
    $("#import-dialog form").reset();
    resetImportPreview();
    $("#import-message").textContent = "";
    $("#import-dialog").showModal();
  };
  $("#sync-csv").onclick = () => {
    $("#sync-dialog form").reset();
    resetSyncPreview();
    $("#sync-message").textContent = "";
    loadSyncHistory();
    $("#sync-dialog").showModal();
  };
  $("#import-file").onchange = () => {
    resetImportPreview();
    $("#import-message").textContent = "";
  };
  $("#import-preview-submit").onclick = () =>
    previewCsv($("#import-file").files[0]);
  $("#import-confirm-submit").onclick = confirmCsvImport;
  $("#sync-file").onchange = () => {
    resetSyncPreview();
    $("#sync-message").textContent = "";
  };
  $("#sync-preview-submit").onclick = () => previewChecklistSync($("#sync-file").files[0]);
  $("#sync-apply").onclick = applyChecklistSync;
  document.querySelectorAll("[data-import-close]").forEach((button) => {
    button.onclick = () => $("#import-dialog").close();
  });
  document.querySelectorAll("[data-sync-close]").forEach((button) => {
    button.onclick = () => $("#sync-dialog").close();
  });
}
setTheme();
setupTransfer();
setupRepositoryFilters();
setupCaseTabs();
refineGeneralTab();
wireForms();
loadRepository().catch((error) => {
  TmsUi.showError($("#case-list"), "Manual TMS is unavailable", error.message);
});
