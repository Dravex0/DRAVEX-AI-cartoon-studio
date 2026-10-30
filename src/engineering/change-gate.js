const SAFE_BRANCH = /^(feat|fix|chore|docs|test)\/[a-z0-9][a-z0-9._-]{1,62}$/;
const PROTECTED_PATHS = [
  /^\.github\//, /^package\.json$/, /^package-lock\.json$/,
  /^index\.html$/, /^vite\.config\./, /^src\/engineering\//
];
const SECRET_PATTERNS = [
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{30,}\b/,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/,
  /\bAIza[0-9A-Za-z_-]{30,}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/
];
function validatePath(value) {
  if (typeof value !== "string" || !value || value.length > 240) return false;
  if (value.startsWith("/") || value.includes("\\") || value.includes("\0")) return false;
  const parts = value.split("/");
  return parts.every((part) => part && part !== "." && part !== "..") &&
    !parts.some((part) => part.startsWith(".") && part !== ".github");
}
/**
 * Validates a proposed patch manifest. It never writes files, invokes shell commands,
 * pushes commits, or merges pull requests.
 */
export function prepareChangeSet(input, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("A change-set object is required.");
  const branch = String(input.branch ?? "");
  const changes = input.changes;
  if (!SAFE_BRANCH.test(branch)) throw new TypeError("Use an isolated branch name such as feat/short-description.");
  if (!Array.isArray(changes) || changes.length === 0) throw new TypeError("At least one proposed file change is required.");
  if (changes.length > 40) throw new RangeError("A change set may contain at most 40 files.");
  const seen = new Set();
  const findings = [];
  const normalized = changes.map((change, index) => {
    if (!change || typeof change !== "object" || Array.isArray(change)) throw new TypeError("Each change must be an object.");
    const filePath = change.path;
    if (!validatePath(filePath)) throw new TypeError("Unsafe or invalid file path at change " + (index + 1) + ".");
    if (seen.has(filePath)) throw new TypeError("Duplicate file path: " + filePath);
    seen.add(filePath);
    const operation = change.operation;
    if (!["create", "update", "delete"].includes(operation)) throw new TypeError("Unsupported operation for " + filePath + ".");
    if (operation === "delete" && change.content !== undefined) throw new TypeError("Delete operations cannot include file content.");
    if (operation !== "delete" && typeof change.content !== "string") throw new TypeError("Create/update operations require string content.");
    if (typeof change.content === "string" && change.content.length > 200_000) throw new RangeError("Proposed file exceeds 200 KB: " + filePath);
    const protectedPath = PROTECTED_PATHS.some((pattern) => pattern.test(filePath));
    if (protectedPath) findings.push({
      severity: "high", code: "protected-path", path: filePath,
      message: "This path affects project configuration, deployment, or the engineering safety core and requires explicit review."
    });
    if (typeof change.content === "string" && SECRET_PATTERNS.some((pattern) => pattern.test(change.content))) findings.push({
      severity: "high", code: "possible-secret", path: filePath,
      message: "A credential-like pattern was detected; proposed content must be reviewed and the value must not be committed."
    });
    if (operation === "update" && (typeof change.expectedSha !== "string" || !change.expectedSha)) findings.push({
      severity: "medium", code: "missing-expected-sha", path: filePath,
      message: "An update should include the current file SHA to prevent overwriting concurrent changes."
    });
    return {
      path: filePath, operation,
      ...(operation !== "delete" ? { content: change.content } : {}),
      ...(change.expectedSha ? { expectedSha: String(change.expectedSha) } : {}),
      protectedPath
    };
  });
  const approvalRequired = findings.some((finding) => finding.severity === "high") ||
    normalized.some((change) => change.operation === "delete") || options.externalService === true;
  const approved = options.approved === true;
  return {
    schemaVersion: 1, mode: "change-set-preflight", branch,
    changeCount: normalized.length, changes: normalized,
    findings, approvalRequired, approvalGranted: approved,
    status: approvalRequired && !approved ? "awaiting-explicit-approval" : "validated-for-human-review",
    execution: "not-executed",
    safeguards: [
      "This module validates proposals only; it does not write files or run commands.",
      "Changes must be applied on an isolated branch and reviewed in a pull request.",
      "Protected paths and destructive operations require explicit user approval.",
      "Tests, build, security audit and diff review are required before merge."
    ]
  };
}
