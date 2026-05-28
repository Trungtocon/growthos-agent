# Sprint 5V — Visual Polish Candidate Audit Report

## Goal

Stop speculative micro-tuning on the lowest 1:1 screens and add a repeatable audit that identifies the dominant mismatched regions before the next visual polish sprint.

## Why

Recent candidate tweaks on Screens 08, 17, 25, 26, and 30 worsened pixel diff even when bbox gates stayed green. The measured pattern shows that the remaining mismatch is mostly section-scale geometry and density, not icon-level polish.

## Tooling Added

- `scripts/audit-visual-polish-candidates.mjs`
- `npm run audit:visual-polish-candidates`

The tool runs fresh parity capture with a non-blocking threshold, runs region analysis, ranks screens by diff, and prints/writes a markdown table with the dominant mismatch region and recommended next action.

## Candidate Audit

Source report:

- `docs/11-quality/VISUAL_POLISH_CANDIDATE_AUDIT.md`

| Rank | Screen | Route | 1:1 | Diff | Dominant region | Decision |
|---:|---|---|---:|---:|---|---|
| 1 | 25 Agent Template Gallery | `/agents/templates` | 88.3275% | 11.6725% | 06 main left | Section-level gallery/content rebuild only |
| 2 | 17 Projects List | `/projects` | 88.3995% | 11.6005% | 06 main left | Section-level board/content rebuild only |
| 3 | 26 Agent Performance | `/agents/performance` | 89.2076% | 10.7924% | 02 sidebar | Route-specific AppShell recalibration first |
| 4 | 21 Org Chart View | `/org-chart` | 89.4802% | 10.5198% | 06 main left | Section-level canvas rebuild only |
| 5 | 08 Executive Command Center | `/command-center` | 89.5284% | 10.4716% | 06 main left | Section-level dashboard rebuild only |
| 6 | 30 Tickets Board | `/tickets` | 89.5416% | 10.4584% | 06 main left | Section-level board rebuild only |

## Reverted Candidate Attempts

The following measured attempts were not kept because they worsened diff:

- Screen 25 gallery height and detail drawer spacing.
- Screen 17 project card metadata, status dots, and project card density variants.
- Screen 30 KPI value matching.
- Screen 25 route-specific AppShell company/profile copy.
- Screen 25 Hermes avatar tone.
- Screen 08 command center KPI value matching.

## Verification

| Check | Result |
|---|---|
| `npm run audit:visual-polish-candidates -- --ids=25,17,26,8,21,30 --out=docs/11-quality/VISUAL_POLISH_CANDIDATE_AUDIT.md` | pass |

Additional gate verification is recorded after the source/docs checkpoint.

## Decision

PARTIAL.

No visual source changes were kept in this sprint because the tested micro-tuning variants regressed parity. The useful output is the repeatable audit tool and documented direction for the next implementation sprint.

## Next Step

Sprint 5W should take the top candidate, Screen 25 `/agents/templates`, and rebuild the dominant `06 main left` gallery/content section from the PNG reference with subregion measurements before changing component internals.
