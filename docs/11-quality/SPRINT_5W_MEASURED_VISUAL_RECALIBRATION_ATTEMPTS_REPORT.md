# Sprint 5W — Measured Visual Recalibration Attempts Report

## Goal

Continue visual parity work on the lowest 1:1 screens without keeping any change that worsens measured pixel diff or breaks bbox gates.

## Baseline

| Screen | Route | Baseline diff | Baseline 1:1 |
|---|---|---:|---:|
| 25 | `/agents/templates` | 11.6725% | 88.3275% |
| 26 | `/agents/performance` | 10.7924% | 89.2076% |
| 34 | `/runs/demo-run` | 9.0080% | 90.9920% |

## Attempts

| Attempt | Screen | Change | BBox | Pixel diff | Decision |
|---|---|---|---|---:|---|
| Template card compact header | 25 | Reworked gallery card header into horizontal avatar/category/title layout | Pass 8/8 | 12.3082% | Reverted |
| Template card compact rows | 25 | Reduced header/row/button vertical spacing after horizontal header | Pass 8/8 | 11.9236% | Reverted |
| Performance dark sidebar logo line | 26 | Added `AI Workforce OS` line under dark sidebar logo | Pass 12/12 | 10.9780% | Reverted |
| Run inspector compact right rail | 34 | Compacted inspector/cost/risk/artifact/control cards | Fail 7/16 | 9.0384% | Reverted |
| Run header Vietnamese subtitle | 34 | Matched subtitle language closer to PNG | Pass 16/16 | 9.0251% | Reverted |
| Run topbar breadcrumb | 34 | Added route-specific `Runs > Run Console` breadcrumb | Pass 16/16 | 9.0239% | Reverted |
| Agent templates full AppShell profile | 25 | Matched company/search/cost/create/user/bottom profile to PNG | Pass 8/8 | 11.8634% | Reverted |
| Agent templates bottom panel only | 25 | Replaced bottom sidebar with Enterprise Plan card only | Pass 8/8 | 11.6759% | Reverted |

## Decision

PARTIAL / Strategy blocked for micro-tuning.

No source visual change was retained because every measured candidate worsened the target screen or broke structural gates. This confirms the Sprint 5V audit: the remaining mismatch requires section-level source-PNG measurement and targeted rebuilds, not isolated copy/icon/layout tweaks.

## Next Step

Sprint 5X should add screen-specific subregion measurement for Screen 25:

- first-row template cards
- second-row template cards
- category dropdown
- detail drawer header
- detail drawer permission table
- sidebar bottom panel
- topbar cost/search/create group

Then rebuild only the subregion with the highest measured contribution, with a hard rule to keep the change only if pixel diff improves.
