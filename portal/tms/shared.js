(() => {
  const section = location.pathname.includes("/defects")
    ? "defects"
    : location.pathname.includes("/runs")
      ? "runs"
      : location.pathname.includes("/plans")
        ? "plans"
        : "repository";
  const labels = {
    repository: "Test repository",
    plans: "Test plans",
    runs: "Test runs",
    defects: "Defects",
  };
  const topbar = document.querySelector(".topbar");
  const navigation = document.querySelector(".section-nav");

  if (topbar)
    topbar.innerHTML = `<a class="brand" href="/" aria-label="QA Dashboard home"><img class="brand-mark" src="/tms/brand.svg" alt="" width="30" height="30"><span>Test management</span></a><nav class="header-actions" aria-label="TMS actions"><button class="theme-toggle" id="theme-toggle" type="button"><span aria-hidden="true">◐</span><span id="theme-label">Dark</span></button><a class="header-link" href="/">Automation reports</a><a class="header-link" href="/logout">Log out</a></nav>`;
  if (navigation)
    navigation.innerHTML = `<span class="nav-label">Manual TMS</span>${Object.entries(
      labels,
    )
      .map(
        ([key, label]) =>
          `<a class="${key === section ? "active" : ""}" href="/tms/${key === "repository" ? "" : `${key}/`}">${label}</a>`,
      )
      .join("")}`;

  window.TmsUi = {
    setSubmitting(form, submitting) {
      form.dataset.submitting = submitting ? "true" : "";
      form
        .querySelectorAll(
          'button[type="submit"], .primary-button:not([type="button"])',
        )
        .forEach((button) => {
          button.disabled = submitting;
        });
    },
    showError(target, title, message, backHref = "/tms/") {
      target.innerHTML = `<div class="empty-state"><h2>${title}</h2><p>${message}</p><a class="secondary-button" href="${backHref}">Back to Manual TMS</a></div>`;
    },
  };
})();
