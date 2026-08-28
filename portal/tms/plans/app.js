const state = {
  plans: [],
  cases: [],
  selectedPlanId: null,
  query: "",
  status: "all",
};
const $ = (selector) => document.querySelector(selector);
let creatingPlan = false;
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
function builderUrl(id) {
  return `./builder/?id=${encodeURIComponent(id)}`;
}
function visiblePlans() {
  return state.plans.filter(
    (plan) =>
      (state.status === "all" || plan.status === state.status) &&
      `${plan.name} ${plan.description}`.toLowerCase().includes(state.query),
  );
}
function planCases(plan) {
  const byId = new Map(state.cases.map((caseItem) => [caseItem.id, caseItem]));
  return plan.caseIds.map(
    (id) =>
      byId.get(id) || {
        caseKey: "Unavailable",
        title: "Test case no longer exists",
        priority: "",
        executionScope: "",
      },
  );
}
function render() {
  const plans = visiblePlans();
  if (!plans.some((plan) => plan.id === state.selectedPlanId))
    state.selectedPlanId = plans[0]?.id || null;
  $("#plan-list").innerHTML = plans.length
    ? plans
        .map(
          (plan) =>
            `<button class="plan-item ${plan.id === state.selectedPlanId ? "active" : ""}" type="button" data-plan="${plan.id}"><strong>${escapeHtml(plan.name)}</strong><small>${pluralize(plan.caseIds.length, "case")} · ${escapeHtml(plan.status)}</small></button>`,
        )
        .join("")
    : state.plans.length
      ? `<div class="empty-state"><h2>No matching plans</h2><p>Try another search or status.</p></div>`
      : $("#empty-plans").innerHTML;
  $("#plan-list")
    .querySelectorAll("[data-plan]")
    .forEach((button) => {
      button.onclick = () => {
        state.selectedPlanId = button.dataset.plan;
        render();
      };
    });
  const plan = state.plans.find((item) => item.id === state.selectedPlanId);
  const cases = plan ? planCases(plan) : [];
  $("#plan-detail").innerHTML = plan
    ? `<div class="detail-heading"><div><span class="detail-kicker">${escapeHtml(plan.status)}</span><h2>${escapeHtml(plan.name)}</h2><p>${escapeHtml(plan.description || "No description")}</p></div><a class="secondary-button plan-edit" href="${builderUrl(plan.id)}">Edit</a></div><div class="case-summary">${pluralize(cases.length, "selected case")}</div><div class="plan-case-summary">${cases.length ? cases.map((caseItem) => `<div><strong>${escapeHtml(caseItem.caseKey)}</strong><span>${escapeHtml(caseItem.title)}${caseItem.priority ? ` · ${escapeHtml(caseItem.priority)} · ${escapeHtml(caseItem.executionScope)}` : ""}</span></div>`).join("") : "<p>No cases selected yet.</p>"}</div>`
    : `<div class="empty-state"><h2>Select a plan</h2><p>Choose a plan to view its test cases.</p></div>`;
}
async function load() {
  const [plansResponse, repositoryResponse] = await Promise.all([
    fetch("/api/tms/plans", { cache: "no-store" }),
    fetch("/api/tms/repository", { cache: "no-store" }),
  ]);
  if (!plansResponse.ok || !repositoryResponse.ok)
    throw new Error("Could not load test plans");
  state.plans = await plansResponse.json();
  state.cases = (await repositoryResponse.json()).cases;
  render();
}
function closeDialog() {
  $("#plan-dialog").close();
  $("#plan-form").reset();
}
async function createPlan() {
  if (creatingPlan) return;
  creatingPlan = true;
  TmsUi.setSubmitting($("#plan-form"), true);
  try {
    const response = await fetch("/api/tms/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: $("#plan-name").value,
        description: $("#plan-description").value,
        status: $("#plan-status").value,
        caseIds: [],
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      $("#plan-message").textContent =
        payload.error || "Could not create test plan";
      return;
    }
    location.assign(builderUrl(payload.id));
  } catch {
    $("#plan-message").textContent = "Could not reach Manual TMS. Try again.";
  } finally {
    creatingPlan = false;
    TmsUi.setSubmitting($("#plan-form"), false);
  }
}
function wire() {
  $("#new-plan").addEventListener("click", () => {
    $("#plan-message").textContent = "";
    $("#plan-dialog").showModal();
  });
  document
    .querySelectorAll("[data-close]")
    .forEach((button) => button.addEventListener("click", closeDialog));
  $("#plan-form").addEventListener("submit", (event) => {
    event.preventDefault();
    createPlan();
  });
  $("#plan-search").addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    render();
  });
  $("#plan-status-filter").addEventListener("change", (event) => {
    state.status = event.target.value;
    render();
  });
}
setTheme();
wire();
load().catch((error) => {
  TmsUi.showError(
    $("#plan-detail"),
    "Test plans are unavailable",
    error.message,
  );
});
