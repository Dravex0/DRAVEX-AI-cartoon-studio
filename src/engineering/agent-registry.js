/**
 * DRAVEX AI Engineering System — agent registry.
 * Role metadata only; LLM executors are attached in later releases.
 */
const definitions = [
  ["core","AI Core","Coordinates bounded workflows and combines outputs.",["orchestration","policy"]],
  ["auditor","Code Auditor","Inspects repository snapshots and reports evidence-based findings.",["audit","architecture"]],
  ["planner","Task Planner","Turns requests into ordered engineering tasks.",["planning","prioritization"]],
  ["developer","Code Developer","Prepares changes on an isolated branch.",["implementation","refactoring"]],
  ["bug-hunter","Bug Hunter","Investigates reproducible defects and regression risks.",["debugging","regression"]],
  ["qa","QA Engineer","Defines and runs checks and records outcomes.",["testing","validation"]],
  ["security","Security Agent","Checks secrets, permissions and data-handling risks.",["security","privacy"]],
  ["performance","Performance Agent","Reviews runtime, memory, rendering and device constraints.",["performance","profiling"]],
  ["git","Git Manager","Coordinates branches, commits and pull requests.",["git","pull-requests"]],
  ["visual-qa","Visual QA","Reviews supplied screenshots and rendered outputs.",["visual-review","accessibility"]],
  ["research","Research Agent","Evaluates technologies, licenses, quotas and hardware.",["research","model-evaluation"]],
  ["quality","Quality Analyst","Scores evidence-backed quality gates.",["metrics","reporting"]],
  ["memory","Memory System","Stores versioned, evidence-linked project knowledge.",["knowledge","history"]]
];
export const ENGINEERING_AGENTS = Object.freeze(definitions.map(([id,name,description,capabilities]) =>
  Object.freeze({ id, name, description, capabilities: Object.freeze([...capabilities]) })
));
export function getEngineeringAgent(agentId) {
  return ENGINEERING_AGENTS.find((agent) => agent.id === agentId) ?? null;
}
export function listEngineeringAgents() {
  return ENGINEERING_AGENTS.map((agent) => ({ ...agent, capabilities: [...agent.capabilities] }));
}
