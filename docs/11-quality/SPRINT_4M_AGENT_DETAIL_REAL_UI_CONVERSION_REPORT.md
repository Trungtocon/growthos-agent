# Sprint 4M — Agent Detail Real UI Conversion Report

## Goal
Convert `/agents/demo-agent` from static parity slices to real UI components using structural gate.

## Baseline
- Real UI Demo Flow Exit Gate PASS.
- Screen 21 `/org-chart` real UI structural PASS.
- Existing structural gates 08/20/21/30/32/34/37 remained passing during baseline verification.

## Static Asset Guardrail
- `parity_23/sidebar.png` rendered: No
- `parity_23/topbar.png` rendered: No
- `parity_23/content.png` rendered: No
- `backgroundImage` rendered: No

## Components Added/Changed
- `AgentDetailRealPage`
- `AgentDetailHeader` region via `agent.header`
- `AgentKpiBand` region via `agent.kpi-band`
- `AgentDetailTabs` region via `agent.tabs`
- `AgentProfilePanel` regions via `agent.left-panel`, `agent.profile-card`, `agent.skills-card`
- `AgentWorkPanel` regions via `agent.center-panel`, `agent.assignment-card`, `agent.memory-card`, `agent.performance-card`
- `AgentControlPanel` regions via `agent.right-panel`, `agent.control-card`, `agent.cost-card`, `agent.risk-card`

## Structural Gate
| Region | Expected | Actual | dx | dy | dw | dh | Status |
|---|---|---|---:|---:|---:|---:|---|
| app-shell.sidebar | 0/0/185/941 | 0/0/185/941 | 0 | 0 | 0 | 0 | passed |
| app-shell.topbar | 185/0/1487/60 | 185/0/1487/60 | 0 | 0 | 0 | 0 | passed |
| app-shell.main | 215/72/1427/1087.5 | 215/72/1427/1087.5 | 0 | 0 | 0 | 0 | passed |
| agent.header | 215/72/1427/201.5 | 215/72/1427/201.5 | 0 | 0 | 0 | 0 | passed |
| agent.kpi-band | 215/285.5/1427/62 | 215/285.5/1427/62 | 0 | 0 | 0 | 0 | passed |
| agent.tabs | 215/363.5/1427/46 | 215/363.5/1427/46 | 0 | 0 | 0 | 0 | passed |
| agent.main-grid | 215/425.5/1427/734 | 215/425.5/1427/734 | 0 | 0 | 0 | 0 | passed |
| agent.left-panel | 215/425.5/330/734 | 215/425.5/330/734 | 0 | 0 | 0 | 0 | passed |
| agent.center-panel | 561/425.5/675/734 | 561/425.5/675/734 | 0 | 0 | 0 | 0 | passed |
| agent.right-panel | 1252/425.5/390/734 | 1252/425.5/390/734 | 0 | 0 | 0 | 0 | passed |
| agent.profile-card | 215/425.5/330/284 | 215/425.5/330/284 | 0 | 0 | 0 | 0 | passed |
| agent.skills-card | 215/725.5/330/428 | 215/725.5/330/428 | 0 | 0 | 0 | 0 | passed |
| agent.assignment-card | 561/425.5/675/228 | 561/425.5/675/228 | 0 | 0 | 0 | 0 | passed |
| agent.memory-card | 561/669.5/675/224 | 561/669.5/675/224 | 0 | 0 | 0 | 0 | passed |
| agent.performance-card | 561/909.5/675/250 | 561/909.5/675/250 | 0 | 0 | 0 | 0 | passed |
| agent.control-card | 1252/425.5/390/216 | 1252/425.5/390/216 | 0 | 0 | 0 | 0 | passed |
| agent.cost-card | 1252/657.5/390/152 | 1252/657.5/390/152 | 0 | 0 | 0 | 0 | passed |
| agent.risk-card | 1252/825.5/390/172 | 1252/825.5/390/172 | 0 | 0 | 0 | 0 | passed |

## Pixel Diff Reference
| Screen | Route | Pixel diff | Notes |
|---|---|---:|---|
| 23 | `/agents/demo-agent` | 8.0451% | Visual polish deferred |

## Smoke Flow
| Route | Status |
|---|---|
| `/command-center` | pass |
| `/workforce` | pass |
| `/org-chart` | pass |
| `/agents/demo-agent` | pass |
| `/tickets` | pass |
| `/tickets/demo-ticket` | pass |
| `/runs/demo-run` | pass |
| `/approvals` | pass |

## Decision
PASS

## Next Step
Run Sprint 4N Real UI Demo v1 Exit Gate across 08, 20, 21, 23, 30, 32, 34, and 37.
