import { prepareChangeSet } from "./change-gate.js";

const TASK_TYPES = Object.freeze(["feature", "bugfix", "refactor", "tests", "documentation"]);
const clean = (value, max = 12000) => String(value ?? "").trim().slice(0, max);

export function validateCodeGenerationRequest(input = {}) {
  const issues = [];
  const taskType = clean(input.taskType, 40);
  const instructions = clean(input.instructions, 12000);
  const branch = clean(input.branch, 80);
  if (!TASK_TYPES.includes(taskType)) issues.push({ code: "unsupported-task-type", field: "taskType" });
  if (!instructions) issues.push({ code: "missing-instructions", field: "instructions" });
  if (String(input.instructions ?? "").length > 12000) issues.push({ code: "instructions-too-long", field: "instructions" });
  if (!/^(feat|fix|chore|docs|test)\/[a-z0-9][a-z0-9._-]{1,62}$/.test(branch)) issues.push({ code: "invalid-isolated-branch", field: "branch" });
  const contextFiles = Array.isArray(input.contextFiles) ? input.contextFiles : [];
  if (!Array.isArray(input.contextFiles ?? [])) issues.push({ code: "invalid-context-files", field: "contextFiles" });
  if (contextFiles.length > 20) issues.push({ code: "too-many-context-files", field: "contextFiles" });
  let contextSize = 0;
  const normalizedContext = contextFiles.slice(0, 20).map((file, index) => {
    if (!file || typeof file !== "object" || typeof file.path !== "string" || typeof file.content !== "string") {
      issues.push({ code: "invalid-context-file", field: "contextFiles[" + index + "]" });
      return null;
    }
    if (!file.path || file.path.length > 240 || file.path.startsWith("/") || file.path.includes("\\") || file.path.split("/").some(part => !part || part === "." || part === "..")) {
      issues.push({ code: "unsafe-context-path", field: "contextFiles[" + index + "].path" });
    }
    if (file.content.length > 50000) issues.push({ code: "context-file-too-large", field: "contextFiles[" + index + "].content" });
    contextSize += file.content.length;
    return { path: file.path.slice(0, 240), content: file.content.slice(0, 50000) };
  }).filter(Boolean);
  if (contextSize > 300000) issues.push({ code: "context-too-large", field: "contextFiles" });
  return {
    valid: issues.length === 0, issues,
    value: issues.length === 0 ? { taskType, instructions, branch, contextFiles: normalizedContext } : null
  };
}

function normalizeProvider(provider) {
  if (!provider || typeof provider !== "object") throw new TypeError("A code provider object is required.");
  const id = clean(provider.id, 80);
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(id)) throw new TypeError("Provider id must be a short identifier.");
  if (typeof provider.generate !== "function") throw new TypeError("Provider must implement generate(request, context).");
  if (provider.local === true && provider.remote === true) throw new TypeError("A provider cannot be both local and remote.");
  return Object.freeze({
    id, name: clean(provider.name, 120) || id,
    local: provider.local === true, remote: provider.remote === true,
    requiresUserKey: provider.requiresUserKey === true,
    generate: provider.generate
  });
}

/** Providers are registered explicitly. Registration performs no network requests. */
export function createCodeProviderRegistry() {
  const providers = new Map();
  return Object.freeze({
    register(provider) {
      const normalized = normalizeProvider(provider);
      if (providers.has(normalized.id)) throw new Error("Code provider is already registered.");
      providers.set(normalized.id, normalized);
      return normalized;
    },
    get(id) { return providers.get(clean(id, 80)) ?? null; },
    list() {
      return [...providers.values()].map(({ id, name, local, remote, requiresUserKey }) =>
        ({ id, name, local, remote, requiresUserKey }));
    },
    remove(id) { return providers.delete(clean(id, 80)); }
  });
}

/**
 * Requests a proposed patch from an explicitly registered provider, then validates it.
 * This never writes repository files, executes commands, commits, pushes or merges.
 */
export async function generateCodeProposal(registry, providerId, input, context = {}) {
  const provider = registry?.get?.(providerId);
  if (!provider) throw new Error("Code provider is not registered.");
  const validation = validateCodeGenerationRequest(input);
  if (!validation.valid) {
    const error = new Error("Code generation request is invalid.");
    error.code = "INVALID_CODE_REQUEST";
    error.issues = validation.issues;
    throw error;
  }
  if (context.signal?.aborted) {
    const error = new Error("Code generation was cancelled before it started.");
    error.name = "AbortError";
    throw error;
  }
  const result = await provider.generate(validation.value, context);
  if (!result || typeof result !== "object" || typeof result.summary !== "string" || !Array.isArray(result.changes)) {
    throw new Error("Code provider returned an invalid proposal.");
  }
  const changeSet = prepareChangeSet({
    branch: validation.value.branch,
    changes: result.changes
  });
  return {
    providerId: provider.id,
    summary: clean(result.summary, 2000),
    changeSet,
    status: changeSet.status,
    execution: "not-executed"
  };
}
