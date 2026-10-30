import { ENGINEERING_AGENTS, listEngineeringAgents } from "./agent-registry.js";
import { planEngineeringTask } from "./task-planner.js";
import { auditRepository } from "./audit-engine.js";
import { prepareChangeSet } from "./change-gate.js";
export const ENGINEERING_SYSTEM_VERSION = "1.1.0-change-gate";
export function getEngineeringSystemStatus() {
  return {
    name: "DRAVEX AI Engineering System", version: ENGINEERING_SYSTEM_VERSION,
    status: "deterministic-core-available", agentCount: ENGINEERING_AGENTS.length,
    executionMode: "no-external-model",
    capabilities: ["agent-registry","task-planning","static-repository-audit","change-set-preflight"],
    limitations: [
      "No autonomous code-writing agent is connected yet.",
      "No external AI model is called by this core.",
      "Change-set preflight validates proposals but does not write files or run commands.",
      "Repository auditing requires an explicitly supplied snapshot."
    ]
  };
}
export function createEngineeringPlan(request, options) { return planEngineeringTask(request, options); }
export function runEngineeringAudit(snapshot, options) { return auditRepository(snapshot, options); }
export function validateEngineeringChanges(changeSet, options) { return prepareChangeSet(changeSet, options); }
export function listAgents() { return listEngineeringAgents(); }
