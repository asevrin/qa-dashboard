const fs = require("fs");

async function notifySlack(reportIndexPath, environment = process.env) {
  const webhookUrl = environment.SLACK_WEBHOOK_URL;
  const portalUrl = environment.REPORTS_PORTAL_URL;
  if (!webhookUrl) return console.log("Slack notification skipped: SLACK_WEBHOOK_URL is not configured");
  if (!reportIndexPath || !fs.existsSync(reportIndexPath)) throw new Error("Report index file is required for Slack notification");

  const { reports = [] } = JSON.parse(fs.readFileSync(reportIndexPath, "utf8"));
  const latest = reports[0];
  const newFailures = latest?.delta?.newFailures || [];
  if (!latest?.delta?.comparable || newFailures.length === 0)
    return console.log("Slack notification skipped: no new test failures");

  const failures = newFailures.slice(0, 10).map((name) => `• ${name}`).join("\n");
  const more = newFailures.length > 10 ? `\n• and ${newFailures.length - 10} more` : "";
  const gate = latest.gate === "at-risk" ? "At risk" : latest.gate === "blocked" ? "Blocked" : "Ready";
  const blocks = [
    { type: "header", text: { type: "plain_text", text: `New test failures: ${newFailures.length}`, emoji: true } },
    { type: "section", fields: [
      { type: "mrkdwn", text: `*Suite*\n${latest.type.toUpperCase()}` },
      { type: "mrkdwn", text: `*Environment*\n${latest.environment}` },
      { type: "mrkdwn", text: `*Run*\n#${latest.runId || "—"}` },
      { type: "mrkdwn", text: `*Pass rate*\n${latest.total ? Math.round((latest.passed / latest.total) * 100) : 0}%` },
      { type: "mrkdwn", text: `*Quality gate*\n${gate}` },
    ] },
    { type: "section", text: { type: "mrkdwn", text: `*Newly failing tests*\n${failures}${more}` } },
  ];
  if (portalUrl) blocks.push({ type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "Open test dashboard", emoji: true }, url: portalUrl }] });

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: `New test failures in ${latest.type.toUpperCase()} run #${latest.runId}`, blocks }),
  });
  if (!response.ok) throw new Error(`Slack webhook failed: ${response.status} ${await response.text()}`);
  console.log("Slack notification sent");
}

module.exports = { notifySlack };
