const DEFAULT_REQUIRED_FILES = ["package.json","README.md","index.html",".github/workflows/quality.yml"];
function normalizeFiles(input) {
  if (!Array.isArray(input)) throw new TypeError("files must be an array.");
  return input.map((entry) => typeof entry === "string"
    ? { path: entry, content: "" }
    : { path: String(entry?.path ?? ""), content: String(entry?.content ?? "") }
  ).filter((entry) => entry.path);
}
/** Audits only the supplied snapshot. Missing content is not proof of an empty file. */
export function auditRepository(snapshot, options = {}) {
  const files = normalizeFiles(snapshot?.files ?? []);
  const byPath = new Map(files.map((file) => [file.path, file]));
  const requiredFiles = options.requiredFiles ?? DEFAULT_REQUIRED_FILES;
  const findings = [];
  for (const path of requiredFiles) {
    if (!byPath.has(path)) findings.push({
      id: "missing-" + path.replace(/[^a-z0-9]+/gi, "-"),
      severity: "high", category: "repository-integrity", path,
      message: "Required project file is missing: " + path,
      evidence: "Path was not present in the supplied repository snapshot.",
      recommendation: "Confirm the repository tree and restore the file only if genuinely required."
    });
  }
  const packageFile = byPath.get("package.json");
  if (packageFile?.content) {
    try {
      const pkg = JSON.parse(packageFile.content);
      for (const script of ["test","check","build"]) if (!pkg.scripts?.[script]) findings.push({
        id: "missing-script-" + script, severity: "medium", category: "quality-gate", path: "package.json",
        message: "No npm script is configured for " + script + ".",
        evidence: 'package.json scripts does not define "' + script + '".',
        recommendation: 'Add a reliable "' + script + '" script or document the equivalent command.'
      });
    } catch {
      findings.push({
        id: "invalid-package-json", severity: "high", category: "repository-integrity", path: "package.json",
        message: "package.json is not valid JSON.",
        evidence: "The supplied package.json content could not be parsed.",
        recommendation: "Validate and repair package.json before running project checks."
      });
    }
  }
  const sourceFiles = files.filter(({path}) => /^src\/.*\.js$/.test(path));
  for (const source of sourceFiles) {
    const name = source.path.split("/").pop().replace(/\.js$/, "");
    const expectedTest = "tests/" + name + ".test.js";
    if (!byPath.has(expectedTest)) findings.push({
      id: "test-gap-" + name, severity: "low", category: "test-coverage", path: source.path,
      message: "No same-name test file was found for " + source.path + ".",
      evidence: "The supplied snapshot does not contain " + expectedTest + "; indirect coverage may still exist.",
      recommendation: "Review coverage and add a focused test if this module contains behavior that can regress."
    });
  }
  const severityRank = { high: 0, medium: 1, low: 2 };
  findings.sort((a,b) => severityRank[a.severity] - severityRank[b.severity] || a.id.localeCompare(b.id));
  return {
    schemaVersion: 1, mode: "static-snapshot-audit", filesInspected: files.length,
    findingCount: findings.length,
    summary: findings.length ? "Review findings before changing code." : "No findings in the checks performed.",
    limitations: [
      "Only supplied file paths and contents were inspected.",
      "This audit does not execute code, run tests, inspect runtime behavior, or prove security.",
      "A missing same-name test is a coverage prompt, not proof of missing test coverage."
    ],
    findings
  };
}
