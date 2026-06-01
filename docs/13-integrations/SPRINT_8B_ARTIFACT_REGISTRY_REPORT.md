# Sprint 8B - Runtime Artifact Registry Report

## Goal

Build a Runtime Artifact Registry layer on top of Hermes Sandbox Runtime so generated artifacts, reports, exports, approval artifacts, and governance artifacts have one canonical runtime index.

## Files Added

- `src/runtime/artifact-registry.ts`
- `src/runtime/artifact-registry-store.ts`
- `scripts/smoke-artifact-registry.mjs`
- `docs/13-integrations/ARTIFACT_REGISTRY_ARCHITECTURE.md`
- `docs/13-integrations/SPRINT_8B_ARTIFACT_REGISTRY_REPORT.md`

## Files Changed

- `src/runtime-store/artifact-store.ts`
- `src/domain/selectors.ts`
- `src/pages/Sprint2Screens.tsx`
- `package.json`

## Registry Capabilities

| Capability | Status |
|---|---|
| Register artifacts | pass |
| Archive artifacts | pass |
| Soft delete artifacts | pass |
| Update metadata | pass |
| Create versions | pass |
| Search/filter/sort | pass |
| Workspace filter | pass |
| Run filter | pass |
| Hermes/Paperclip artifact registration | pass |
| Export registry JSON | pass |
| Export summary Markdown | pass |
| Export health Markdown | pass |

## Integration

`upsertArtifact()` remains the compatibility point for runtime artifacts and now calls `registerArtifact()` after writing runtime state. This means existing artifact producers automatically populate the registry:

- Hermes sandbox output
- Paperclip artifact creation
- Runtime streaming artifacts
- Governance exports
- Approval execution exports
- Cost/reporting exports

Duplicate prevention uses artifact ID as the registry key.

## UI

`/artifacts` renders registry-backed rows and exposes:

- search
- type filter
- lifecycle filter
- sort selector
- registry health summary
- run-linked artifact counts

## Verification

| Check | Result |
|---|---|
| npm run build | pass |
| npm run validate:demo-data | pass |
| npm run audit:static-assets | pass |
| npm run smoke:artifact-registry | pass 10/10 |
| runtime smoke suite | pass |
| onboarding parity 01-07 | pass 7/7 |
| bbox core suite | pass 08/20/21/23/30/32/34/37 |
| bbox screen 35 /artifacts | pass 8/8 |

## Decision

PASS.
