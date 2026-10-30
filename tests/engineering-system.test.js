import test from "node:test";
import assert from "node:assert/strict";
import { ENGINEERING_SYSTEM_VERSION, getEngineeringSystemStatus, listAgents, createEngineeringPlan, runEngineeringAudit } from "../src/engineering/index.js";
test("engineering core reports honest deterministic capabilities", () => {
  const status = getEngineeringSystemStatus();
  assert.equal(status.version, ENGINEERING_SYSTEM_VERSION);
  assert.equal(status.status, "deterministic-core-available");
  assert.equal(status.executionMode, "no-external-model");
  assert.equal(status.agentCount, 13);
  assert.ok(status.limitations.some((item) => item.includes("No autonomous code-writing")));
});
test("agent registry returns defensive copies", () => {
  const agents = listAgents();
  assert.equal(agents.length, 13);
  agents[0].capabilities.push("tampered");
  assert.ok(!listAgents()[0].capabilities.includes("tampered"));
});
test("planner routes Android 4K performance task to relevant agents", () => {
  const plan = createEngineeringPlan("Improve Android 4K performance and investigate memory usage");
  const ids = plan.tasks.map((task) => task.agentId);
  assert.ok(ids.includes("performance"));
  assert.ok(ids.includes("qa"));
  assert.equal(plan.approvalRequired, false);
});
test("planner flags destructive and main-branch requests for approval", () => {
  const plan = createEngineeringPlan("Delete old files and merge changes into main");
  assert.equal(plan.approvalRequired, true);
  assert.ok(plan.safeguards.some((item) => item.includes("Explicit user approval")));
});
test("planner rejects an empty task", () => { assert.throws(() => createEngineeringPlan("  "), /non-empty/); });
test("audit detects missing required files, invalid package metadata and test gaps", () => {
  const report = runEngineeringAudit({ files: [{path:"package.json",content:"{invalid"}, "src/example.js"] });
  assert.ok(report.findings.some((finding) => finding.id === "missing-README-md"));
  assert.ok(report.findings.some((finding) => finding.id === "invalid-package-json"));
  assert.ok(report.findings.some((finding) => finding.id === "test-gap-example"));
  assert.equal(report.mode, "static-snapshot-audit");
});
test("audit recognizes a minimal healthy supplied snapshot", () => {
  const report = runEngineeringAudit({ files: [
    {path:"package.json",content:JSON.stringify({scripts:{test:"node --test",check:"node --check x.js",build:"vite build"}})},
    "README.md","index.html",".github/workflows/quality.yml","src/sample.js","tests/sample.test.js"
  ]});
  assert.equal(report.findingCount, 0);
  assert.match(report.summary, /No findings/);
});
test("audit does not expose file contents in findings", () => {
  const report = runEngineeringAudit({files:[{path:"src/leaky.js",content:"const API_KEY = 'sensitive-example-value';"}]});
  assert.ok(!JSON.stringify(report).includes("sensitive-example-value"));
});
