import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { auditRepository } from "../src/engineering/audit-engine.js";

const ROOT = process.cwd();
const IGNORED = new Set([".git","node_modules","dist","coverage",".vite","playwright-report","test-results"]);
const TEXT_EXTENSIONS = new Set([".js",".mjs",".cjs",".ts",".tsx",".json",".md",".html",".css",".yml",".yaml",".txt"]);
const MAX_FILES = 2500;
const MAX_FILE_BYTES = 200_000;

function collectSnapshot(directory = ROOT, relative = "", output = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (IGNORED.has(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) {
      collectSnapshot(absolutePath, relativePath, output);
      continue;
    }
    if (!entry.isFile() || !TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
    if (output.length >= MAX_FILES) throw new Error("Repository audit file limit exceeded; narrow the scan explicitly.");
    try {
      const content = readFileSync(absolutePath);
      if (content.length > MAX_FILE_BYTES) {
        output.push({ path: relativePath, content: "" });
      } else {
        output.push({ path: relativePath, content: content.toString("utf8") });
      }
    } catch {
      output.push({ path: relativePath, content: "" });
    }
  }
  return output;
}

const snapshot = { files: collectSnapshot() };
const report = auditRepository(snapshot);
const outputPath = process.env.DRAVEX_AUDIT_REPORT || path.join(os.tmpdir(), "dravex-engineering-audit.json");
writeFileSync(outputPath, JSON.stringify(report, null, 2), { mode: 0o600 });

const lines = [
  "## DRAVEX Engineering Audit",
  "",
  "- Mode: static repository snapshot (no external AI model)",
  "- Text files inspected: " + report.filesInspected,
  "- Findings: " + report.findingCount,
  "- Summary: " + report.summary,
  "",
  "This is an advisory audit. It does not execute the application or prove security."
];
for (const finding of report.findings.slice(0, 30)) {
  lines.push("- **" + finding.severity.toUpperCase() + "** [" + finding.category + "] " + finding.path + ": " + finding.message);
}
if (report.findings.length > 30) lines.push("- Additional findings omitted from summary; see JSON artifact.");
if (process.env.GITHUB_STEP_SUMMARY) {
  writeFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n", { flag: "a" });
}
process.stdout.write(lines.join("\n") + "\n");
process.stdout.write("JSON report saved to the configured temporary artifact path.\n");
