import { ENGINEERING_AGENTS, listEngineeringAgents } from "./agent-registry.js";
import { planEngineeringTask } from "./task-planner.js";
import { auditRepository } from "./audit-engine.js";
import { prepareChangeSet } from "./change-gate.js";
import { createCodeProviderRegistry, generateCodeProposal, validateCodeGenerationRequest } from "./code-provider-contract.js";
export const ENGINEERING_SYSTEM_VERSION = "1.2.0-code-provider-contract";
export function getEngineeringSystemStatus() {
  return {
    name: "DRAVEX AI Engineering System", version: ENGINEERING_SYSTEM_VERSION,
    status: "deterministic-core-available", agentCount: ENGINEERING_AGENTS.length,
    executionMode: "no-external-model",
    capabilities: ["agent-registry","task-planning","static-repository-audit","change-set-preflight","code-provider-contract"],
    limitations: [
      "No autonomous code-writing agent or model adapter is connected yet.",
      "No external AI model is called by this core.",
      "Code providers must be explicitly registered; generated changes remain proposals only.",
      "Change-set preflight does not write files or run commands.",
      "Repository auditing requires an explicitly supplied snapshot."
    ]
  };
}
export function createEngineeringPlan(request, options) { return planEngineeringTask(request, options); }
export function runEngineeringAudit(snapshot, options) { return auditRepository(snapshot, options); }
export function validateEngineeringChanges(changeSet, options) { return prepareChangeSet(changeSet, options); }
export function createEngineeringCodeProviderRegistry() { return createCodeProviderRegistry(); }
export function validateEngineeringCodeRequest(input) { return validateCodeGenerationRequest(input); }
export function proposeEngineeringCode(registry, providerId, input, context) {
  return generateCodeProposal(registry, providerId, input, context);
}
export function listAgents() { return listEngineeringAgents(); }
