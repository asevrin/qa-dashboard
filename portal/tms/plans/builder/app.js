const state = {
  plan: null,
  suites: [],
  cases: [],
  selectedCaseIds: new Set(),
  scopes: new Set(),
  priorities: new Set(),
  suitesFilter: new Set(),
  query: "",
  page: 1,
  perPage: 25,
};
const $ = (selector) => document.querySelector(selector);
let savingPlan = false;
function escapeHtml(value) {
  const node = document.createElement("span");
  node.textContent = value || "";
  return node.innerHTML;
}
function pluralize(value, noun) {
  return `${value} ${noun}${value === 1 ? "" : "s"}`;
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
  let depth = 0;
  let current = suite;
  while (current.parentId) {
    current = state.suites.find((item) => item.id === current.parentId);
    if (!current) break;
    depth += 1;
  }
  return depth;
}
function suiteCaseIds(suiteId) {
  const suiteIds = new Set([suiteId]);
  let changed = true;
  while (changed) {
    changed = false;
    state.suites.forEach((suite) => {
      if (
        suite.parentId &&
        suiteIds.has(suite.parentId) &&
        !suiteIds.has(suite.id)
      ) {
        suiteIds.add(suite.id);
        changed = true;
      }
    });
  }
  return new Set(
    state.cases
      .filter((item) => suiteIds.has(item.suiteId))
      .map((item) => item.id),
  );
}
function filteredCases() {
  const suiteIds = new Set();
  state.suitesFilter.forEach((id) =>
    suiteCaseIds(id).forEach((caseId) => suiteIds.add(caseId)),
  );
  return state.cases.filter(
    (item) =>
      (!state.scopes.size || state.scopes.has(item.executionScope)) &&
      (!state.priorities.size || state.priorities.has(item.priority)) &&
      (!state.suitesFilter.size || suiteIds.has(item.id)) &&
      `${item.caseKey} ${item.title}`.toLowerCase().includes(state.query),
  );
}
function renderSuiteFilters() {
  $("#suite-filters").innerHTML = state.suites
    .map(
      (suite) =>
        `<label style="padding-left:${suiteDepth(suite) * 13}px"><input type="checkbox" value="${suite.id}" ${state.suitesFilter.has(suite.id) ? "checked" : ""} />${escapeHtml(suite.name)}</label>`,
    )
    .join("");
  $("#suite-filters")
    .querySelectorAll("input")
    .forEach((input) =>
      input.addEventListener("change", () => {
        input.checked
          ? state.suitesFilter.add(input.value)
          : state.suitesFilter.delete(input.value);
        state.page = 1;
        renderCases();
        renderSuiteFilters();
      }),
    );
}
function renderCases() {
  const filtered = filteredCases();
  const pageCount = Math.max(1, Math.ceil(filtered.length / state.perPage));
  state.page = Math.min(state.page, pageCount);
  const start = (state.page - 1) * state.perPage;
  const items = filtered.slice(start, start + state.perPage);
  $("#selected-total").textContent = pluralize(
    state.selectedCaseIds.size,
    "selected case",
  );
  $("#save-count").textContent = pluralize(
    state.selectedCaseIds.size,
    "case selected",
  );
  $("#case-range").textContent = filtered.length
    ? `${start + 1}–${start + items.length} of ${filtered.length}`
    : "No matching cases";
  $("#builder-case-list").innerHTML = items.length
    ? items
        .map(
          (item) =>
            `<label class="builder-case"><input type="checkbox" value="${item.id}" ${state.selectedCaseIds.has(item.id) ? "checked" : ""} /><span class="builder-case-key">${escapeHtml(item.caseKey)}</span><span class="builder-case-title">${escapeHtml(item.title)}</span><span class="pill ${item.priority}">${escapeHtml(item.priority)}</span><span class="pill ${item.executionScope}">${escapeHtml(item.executionScope)}</span></label>`,
        )
        .join("")
    : "<div class=empty-state><h2>No matching cases</h2><p>Change the filters or search phrase.</p></div>";
  $("#builder-case-list")
    .querySelectorAll("input")
    .forEach((input) =>
      input.addEventListener("change", () => {
        input.checked
          ? state.selectedCaseIds.add(input.value)
          : state.selectedCaseIds.delete(input.value);
        renderCases();
      }),
    );
  $("#select-filtered").textContent = `Select all ${filtered.length} filtered`;
  $("#select-filtered").disabled = !filtered.length;
  $("#pagination").innerHTML =
    pageCount > 1
      ? `<button class="secondary-button" data-page="${state.page - 1}" ${state.page === 1 ? "disabled" : ""}>Previous</button><span>Page ${state.page} of ${pageCount}</span><button class="secondary-button" data-page="${state.page + 1}" ${state.page === pageCount ? "disabled" : ""}>Next</button>`
      : "";
  $("#pagination")
    .querySelectorAll("[data-page]")
    .forEach((button) =>
      button.addEventListener("click", () => {
        state.page = Number(button.dataset.page);
        renderCases();
      }),
    );
}
function renderPlan() {
  $("#plan-name-heading").textContent = state.plan.name;
  $("#plan-description-heading").textContent =
    state.plan.description || "Select the cases this plan should cover.";
  $("#details-name").value = state.plan.name;
  $("#details-description").value = state.plan.description;
  $("#details-status").value = state.plan.status;
}
async function load() {
  const id = new URLSearchParams(location.search).get("id");
  if (!id) throw new Error("A test plan is required");
  const [plansResponse, repositoryResponse] = await Promise.all([
    fetch("/api/tms/plans", { cache: "no-store" }),
    fetch("/api/tms/repository", { cache: "no-store" }),
  ]);
  if (!plansResponse.ok || !repositoryResponse.ok)
    throw new Error("Could not load plan builder");
  const plans = await plansResponse.json();
  state.plan = plans.find((item) => item.id === id);
  if (!state.plan) throw new Error("Test plan was not found");
  const repository = await repositoryResponse.json();
  state.suites = repository.suites;
  state.cases = repository.cases.filter((item) => item.status !== "archived");
  state.selectedCaseIds = new Set(
    state.plan.caseIds.filter((caseId) =>
      state.cases.some((item) => item.id === caseId),
    ),
  );
  renderPlan();
  renderSuiteFilters();
  renderCases();
}
async function savePlan(message = "Saved") {
  if (savingPlan) return false;
  savingPlan = true;
  [$("#save-plan"), $("#save-plan-bottom")].forEach(
    (button) => (button.disabled = true),
  );
  $("#save-message").textContent = "Saving…";
  try {
    const response = await fetch(`/api/tms/plans/${state.plan.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: state.plan.name,
        description: state.plan.description,
        status: state.plan.status,
        caseIds: [...state.selectedCaseIds],
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      $("#save-message").textContent = payload.error || "Could not save plan";
      return false;
    }
    state.plan = payload;
    $("#save-message").textContent = message;
    renderPlan();
    renderCases();
    return true;
  } catch {
    $("#save-message").textContent = "Could not reach Manual TMS. Try again.";
    return false;
  } finally {
    savingPlan = false;
    [$("#save-plan"), $("#save-plan-bottom")].forEach(
      (button) => (button.disabled = false),
    );
  }
}
function clearFilters() {
  state.scopes.clear();
  state.priorities.clear();
  state.suitesFilter.clear();
  state.query = "";
  $("#case-search").value = "";
  document.querySelectorAll("[data-scope],[data-priority]").forEach((input) => {
    input.checked = false;
  });
  state.page = 1;
  renderSuiteFilters();
  renderCases();
}
function wire() {
  $("#case-search").addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    state.page = 1;
    renderCases();
  });
  document.querySelectorAll("[data-scope]").forEach((input) =>
    input.addEventListener("change", () => {
      input.checked
        ? state.scopes.add(input.dataset.scope)
        : state.scopes.delete(input.dataset.scope);
      state.page = 1;
      renderCases();
    }),
  );
  document.querySelectorAll("[data-priority]").forEach((input) =>
    input.addEventListener("change", () => {
      input.checked
        ? state.priorities.add(input.dataset.priority)
        : state.priorities.delete(input.dataset.priority);
      state.page = 1;
      renderCases();
    }),
  );
  $("#clear-filters").addEventListener("click", clearFilters);
  $("#select-filtered").addEventListener("click", () => {
    filteredCases().forEach((item) => state.selectedCaseIds.add(item.id));
    renderCases();
  });
  $("#clear-selection").addEventListener("click", () => {
    state.selectedCaseIds.clear();
    renderCases();
  });
  [$("#save-plan"), $("#save-plan-bottom")].forEach((button) =>
    button.addEventListener("click", () => savePlan()),
  );
  $("#edit-details").addEventListener("click", () => {
    $("#details-message").textContent = "";
    $("#details-dialog").showModal();
  });
  document
    .querySelectorAll("[data-close]")
    .forEach((button) =>
      button.addEventListener("click", () => $("#details-dialog").close()),
    );
  $("#details-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    state.plan.name = $("#details-name").value.trim();
    state.plan.description = $("#details-description").value.trim();
    state.plan.status = $("#details-status").value;
    const saved = await savePlan("Details saved");
    if (saved) $("#details-dialog").close();
  });
}
setTheme();
wire();
load().catch((error) => {
  $(".builder-case-panel").innerHTML =
    `<div class="empty-state"><h2>Plan builder is unavailable</h2><p>${escapeHtml(error.message)}</p></div>`;
});
