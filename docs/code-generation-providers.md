# DRAVEX code-generation provider contract

## Purpose
A provider-neutral boundary for optional code-generation models. It defines how a provider receives an explicit task and returns a proposed patch manifest.

## Safety and privacy
- No provider is installed or called by default.
- Registration is local metadata only and performs no network request.
- The caller explicitly supplies bounded task instructions and optional context files; the contract does not crawl the repository.
- Context is capped at 20 files, 50 KB per file and 300 KB total.
- A provider must declare whether it is local or remote and whether it requires a user-supplied key.
- Remote adapters must disclose that supplied context leaves the device/repository environment before making a request.
- Provider output is untrusted and is passed through the engineering change gate.
- Protected paths, secrets, unsafe paths, destructive changes and stale file SHAs remain subject to change-gate checks.
- The result is a proposal only. No file writes, shell commands, commits, pushes or merges occur.

## API
- validateCodeGenerationRequest(input)
- createCodeProviderRegistry()
- generateCodeProposal(registry, providerId, input, context)

## Not included
This contract does not connect to external models, does not supply free inference, and does not make code changes. A real adapter must be separately implemented and tested for its model license, quota, key handling, privacy, response format and cost.
