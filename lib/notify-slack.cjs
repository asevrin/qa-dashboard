const fs = require("fs");

function isFailure(report) {
  return (
    report.status === "failure" ||
    Number(report.failed) + Number(report.broken) > 0
  );
}

function reportTitle(report, failed) {
  return `${failed ? "🔴" : "🟢"} ${report.type.toUpperCase()} run #${report.runId || "—"} ${failed ? "failed" : "passed"}`;
}

function reportUrl(portalUrl, report) {
  if (!portalUrl) return "";
  try {
    return new URL(
      String(report.href || "").replace(/^\.\//, ""),
      `${portalUrl.replace(/\/$/, "")}/`,
    ).toString();
  } catch {
    return portalUrl;
  }
}

function resultBlocks(report, portalUrl) {
  const failed = isFailure(report);
  const failingTests = (report.tests || [])
    .filter((test) => test.status === "failed" || test.status === "broken")
    .map((test) => test.name);
  const failureCount = Number(report.failed) + Number(report.broken);
  const gate =
    report.gate === "at-risk"
      ? "At risk"
      : report.gate === "blocked"
        ? "Blocked"
        : "Ready";
  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: reportTitle(report, failed),
        emoji: true,
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Suite*\n${report.type.toUpperCase()}` },
        { type: "mrkdwn", text: `*Environment*\n${report.environment}` },
        {
          type: "mrkdwn",
          text: `*Pass rate*\n${report.total ? Math.round((report.passed / report.total) * 100) : 0}%`,
        },
        {
          type: "mrkdwn",
          text: failed
            ? `*Failing tests*\n${failureCount || failingTests.length}`
            : "*Result*\nAll tests passed",
        },
      ],
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Quality gate: *${gate}*`,
        },
      ],
    },
  ];
  const actions = [];
  const url = reportUrl(portalUrl, report);
  if (url)
    actions.push({
      type: "button",
      text: {
        type: "plain_text",
        text: "Open report",
        emoji: true,
      },
      style: failed ? "danger" : "primary",
      url,
      action_id: "open_report",
    });
  if (report.workflowUrl)
    actions.push({
      type: "button",
      text: {
        type: "plain_text",
        text: "Open GitHub run",
        emoji: true,
      },
      url: report.workflowUrl,
      action_id: "open_github_run",
    });
  if (actions.length)
    blocks.push({
      type: "actions",
      elements: actions,
    });
  return { failed, blocks, color: failed ? "#e01e5a" : "#2eb67d" };
}

async function notifySlack(
  reportIndexPath,
  environment = process.env,
  runId = "",
) {
  const webhookUrl = environment.SLACK_WEBHOOK_URL;
  const portalUrl = environment.REPORTS_PORTAL_URL;
  if (!webhookUrl)
    return console.log(
      "Slack notification skipped: SLACK_WEBHOOK_URL is not configured",
    );
  if (!reportIndexPath || !fs.existsSync(reportIndexPath))
    throw new Error("Report index file is required for Slack notification");

  const { reports = [] } = JSON.parse(fs.readFileSync(reportIndexPath, "utf8"));
  const selected = runId
    ? reports.filter((report) => String(report.runId) === String(runId))
    : reports.slice(0, 1);
  if (!selected.length)
    return console.log(
      `Slack notification skipped: no reports found for run ${runId || "latest"}`,
    );

  for (const report of selected) {
    const { failed, blocks, color } = resultBlocks(report, portalUrl);
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: reportTitle(report, failed),
        attachments: [{ color, blocks }],
      }),
    });
    if (!response.ok)
      throw new Error(
        `Slack webhook failed: ${response.status} ${await response.text()}`,
      );
    console.log(
      `Slack notification sent: ${report.type} run #${report.runId || "—"}`,
    );
  }
}

module.exports = { notifySlack };
