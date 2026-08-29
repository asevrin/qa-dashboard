const fs = require("fs");

function isFailure(report) {
  return (
    report.status === "failure" ||
    Number(report.failed) + Number(report.broken) > 0
  );
}

function reportTitle(report, failed) {
  return `${failed ? "Failed" : "Passed"}: ${report.type.toUpperCase()} run #${report.runId || "—"}`;
}

function resultBlocks(report, portalUrl) {
  const failed = isFailure(report);
  const failingTests = (report.tests || [])
    .filter((test) => test.status === "failed" || test.status === "broken")
    .map((test) => test.name);
  const shownTests = failingTests
    .slice(0, 10)
    .map((name) => `• ${name}`)
    .join("\n");
  const more =
    failingTests.length > 10 ? `\n• and ${failingTests.length - 10} more` : "";
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
        { type: "mrkdwn", text: `*Result*\n${failed ? "Failed" : "Passed"}` },
        {
          type: "mrkdwn",
          text: `*Pass rate*\n${report.total ? Math.round((report.passed / report.total) * 100) : 0}%`,
        },
        { type: "mrkdwn", text: `*Quality gate*\n${gate}` },
      ],
    },
  ];
  if (failed)
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Failing tests (${failingTests.length})*\n${shownTests || "Test details are unavailable in this report."}${more}`,
      },
    });
  if (portalUrl)
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Open test dashboard",
            emoji: true,
          },
          url: portalUrl,
        },
      ],
    });
  return { failed, blocks };
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
    const { failed, blocks } = resultBlocks(report, portalUrl);
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: reportTitle(report, failed), blocks }),
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
