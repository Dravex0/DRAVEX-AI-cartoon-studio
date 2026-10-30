# DRAVEX AI Engineering System — Core v1

## Purpose
A free-first, provider-neutral engineering orchestration foundation for DRAVEX AI Cartoon Studio. This first release is deterministic and read-only. It does not claim to run autonomous LLM agents.

## Implemented
- Registry describing 13 specialist roles.
- Deterministic task planner with keyword-based routing.
- Approval flags for destructive, main-branch and external-service work.
- Static repository snapshot auditor for required files, package scripts and same-name test-file gaps.
- Status API that distinguishes implemented capabilities from planned work.
- Node.js built-in tests; no new runtime dependency and no API key.

## Agent roles
AI Core, Code Auditor, Task Planner, Code Developer, Bug Hunter, QA Engineer, Security Agent, Performance Agent, Git Manager, Visual QA, Research Agent, Quality Analyst and Memory System.

The registry is role metadata only. An agent becomes operational only when a real executor is connected, permissioned and tested.

## Safety model
1. Core v1 never writes repository files.
2. Audit inspects only the snapshot explicitly supplied by the caller.
3. Findings include evidence and limitations.
4. Destructive actions, main-branch operations and external-service use require approval.
5. Future code changes must use an isolated branch and pull request.
6. Secrets must never be included in reports, prompts, logs or artifacts.
7. No paid provider or external model is configured by this core.

## API
- getEngineeringSystemStatus()
- listAgents()
- createEngineeringPlan(request, options)
- runEngineeringAudit(snapshot, options)

## Limitations
No LLM provider adapter, autonomous code editing, GitHub write integration, persistent memory, screenshot review or runtime browser testing is implemented yet. Keyword routing is a starter heuristic. Same-name test checks are prompts for review, not complete coverage analysis. Static snapshot checks cannot replace CI, security scanning or physical Android testing.

## Verification
Run npm test, npm run check and npm run build. Merge only after CI passes and the proposed diff is reviewed.
