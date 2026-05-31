# Sprint 7J — Workspace Governance Report

## Goal

Add a workspace governance layer that summarizes workspace teams, members, roles, budgets, quotas, health, warnings, and governance artifacts without redesigning UI or bypassing the runtime architecture.

## Architecture

Runtime data flows through:

`runtime stores -> workspace governance store -> selectors -> UI`

Exports flow through:

`runtime orchestrator -> workspace governance artifacts -> artifact store -> Artifact Viewer`

## Files Added/Changed

| Area | Files |
|---|---|
| Governance domain | `src/runtime/workspace-governance.ts` |
| Governance store | `src/runtime/workspace-governance-store.ts` |
| Selectors | `src/domain/selectors.ts` |
| Runtime orchestrator | `src/integrations/growthos-runtime/runtime-orchestrator.ts` |
| UI route | `src/pages/Sprint2Screens.tsx`, `src/data/screens.ts` |
| Smoke test | `scripts/smoke-workspace-governance.mjs`, `package.json` |
| Docs | `docs/13-integrations/WORKSPACE_GOVERNANCE_ARCHITECTURE.md` |

## Governance Models

- Workspace
- WorkspaceTeam
- WorkspaceMember
- WorkspaceRole
- WorkspaceBudget
- WorkspaceQuota
- WorkspaceHealth

## Governance Rules

| Rule | Result |
|---|---|
| Budget usage greater than 90% | WARNING |
| Budget usage exceeds monthly limit | CRITICAL |
| Quota usage greater than 90% | WARNING |
| Quota usage exceeds limit | BLOCKED |

## UI Wiring

| Route | Wiring |
|---|---|
| `/workspace` | New read-only workspace governance dashboard |
| `/tickets/demo-ticket` | Selector exposes workspace health and warnings |
| `/runs/demo-run` | Selector exposes workspace governance summary and warnings |
| `/approvals` | Selector exposes workspace health and warnings |
| `/cost` | Selector exposes workspace governance summary and health |

## Artifact Export

`exportWorkspaceGovernanceArtifacts()` generates:

- `workspace-governance.json`
- `workspace-summary.md`
- `workspace-health-report.md`

## Verification

| Check | Result |
|---|---|
| `npm run build` | pass |
| `npm run validate:demo-data` | pass |
| `npm run audit:static-assets` | pass |
| Runtime smoke suite through `smoke:cost-reconciliation` | pass |
| `npm run smoke:workspace-governance` | pass 8/8 |
| Onboarding parity 01-07 | pass |
| Core bbox 08/20/21/23/30/32/34/37 | pass |
| Full verification suite | pass |

## Decision

PASS.
