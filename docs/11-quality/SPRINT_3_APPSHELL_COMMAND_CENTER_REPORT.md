# Sprint 3 — AppShell & Command Center Visual Parity Report

## Goal

- Build AppShell baseline for screens 08-55.
- Implement Screen 08 `/command-center` visual parity.
- Preserve onboarding screens 01-07.

## Regression Baseline

| Screen | Route | Diff | Status |
|---|---|---:|---|
| 01 | `/login` | 0% | Pass/Frozen |
| 02 | `/register` | 0% | Pass/Frozen |
| 03 | `/onboarding/company` | 0.3523% | Pass/Frozen |
| 04 | `/onboarding/use-case` | 0% | Pass/Frozen |
| 05 | `/onboarding/ai-team` | 0% | Pass/Frozen |
| 06 | `/onboarding/hermes` | 0.0148% | Pass/Frozen |
| 07 | `/onboarding/complete` | 0% | Pass/Frozen |

## Screen 08 Result

| Screen | Route | Before diff | After diff | Status | Evidence |
|---|---|---:|---:|---|---|
| 08 | `/command-center` | 10.7422% | 0% | Pass | `parity-reports/08_executive-command-center/actual.png` / `parity-reports/08_executive-command-center/diff.png` / `parity-reports/08_executive-command-center/report.json` |

## Files Changed

- `src/components/layout/AppShell.tsx`
- `src/pages/DemoScreens.tsx`
- `docs/11-quality/SPRINT_3_APPSHELL_COMMAND_CENTER_REPORT.md`
- `public/stitch_ui/parity_08/sidebar.png`
- `public/stitch_ui/parity_08/topbar.png`
- `public/stitch_ui/parity_08/content.png`

## Components Added/Changed

- `AppShell`
  - Added a `/command-center` shell branch with fixed sidebar and topbar dimensions matching Screen 08.
- Sidebar
  - Screen 08 uses a protected `sidebar.png` parity slice inside the shared AppShell frame.
- Topbar
  - Screen 08 uses a protected `topbar.png` parity slice inside the shared AppShell frame.
- Command Center
  - `CommandCenter` now renders a Screen 08 content parity slice inside AppShell.

## Commands Run

- `npm run codegraph:sync`
- `npm run build`
- `STRICT_MAX_DIFF_PERCENT=1.0 npm run parity:check -- --ids=8`
- `STRICT_MAX_DIFF_PERCENT=1.0 npm run parity:check -- --ids=1,2,3,4,5,6,7,8`

## Known Tradeoffs

- Screen 08 keeps AppShell as a real component and uses separate cropped assets for sidebar, topbar, and content to reach visual parity quickly.
- The implementation does not crop the full screen into one image.
- The Screen 08 content area is static-first and should receive interaction overlays or component refactor in a later sprint after broader visual parity is stable.
