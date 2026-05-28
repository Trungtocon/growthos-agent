# Visual Polish Candidate Audit

This report ranks the current low-parity screens by fresh pixel diff and dominant region mismatch. Pixel diff remains a polish metric; this audit is used to choose section-level recalibration work instead of speculative micro-tuning.

| Rank | Screen | Route | 1:1 | Diff % | Top region | Region diff % | Next action |
|---:|---|---|---:|---:|---|---:|---|
| 1 | 25 Agent Template Gallery | `/agents/templates` | 88.3275% | 11.6725% | 06 main left | 14.8269 | Rebuild dominant content section, not icon-level polish |
| 2 | 17 Projects List | `/projects` | 88.3995% | 11.6005% | 06 main left | 17.2006 | Rebuild dominant content section, not icon-level polish |
| 3 | 26 Agent Performance | `/agents/performance` | 89.2076% | 10.7924% | 02 sidebar | 16.4055 | Recalibrate route-specific AppShell visual details |
| 4 | 21 Org Chart View | `/org-chart` | 89.4802% | 10.5198% | 06 main left | 13.3950 | Rebuild dominant content section, not icon-level polish |
| 5 | 08 Executive Command Center | `/command-center` | 89.5284% | 10.4716% | 06 main left | 16.0609 | Rebuild dominant content section, not icon-level polish |
| 6 | 30 Tickets Board | `/tickets` | 89.5416% | 10.4584% | 06 main left | 12.5960 | Rebuild dominant content section, not icon-level polish |

## Notes

- Fresh parity screenshots are generated under `parity-reports/` and should not be committed unless the repo explicitly tracks evidence for the run.
- If a candidate tweak worsens diff, revert it and move to section-level measurement or source-PNG contract recalibration.
- Prioritize the highest full-page diff only when the top failing region aligns with a visible missing or structurally different section.

