# Sprint 5X - Screen 25 Subregion Recalibration Report

## Goal

Add source-PNG-aligned subregion measurement for Screen 25 `/agents/templates` and use it to make a measured visual improvement without changing structural geometry or using parity images.

## Tooling Added

- `scripts/audit-screen-25-subregions.mjs`
- `npm run audit:subregions:25`
- `docs/11-quality/SCREEN_25_SUBREGION_AUDIT.md`

The audit splits Screen 25 into topbar, sidebar, header, filters, dropdown, gallery cards, drawer sections, and primary CTA subregions. It runs against `public/stitch_ui/25_Agent_Template_Gallery.png` and the live React screenshot.

## Change Kept

The subregion audit showed the drawer primary CTA was the highest mismatch:

| Subregion | Before diff | After diff | Decision |
|---|---:|---:|---|
| drawer primary cta | 89.7685% | 22.3280% | Kept |

The change anchors the drawer CTA to the bottom of the fixed detail panel so it appears in the same source-PNG region instead of being pushed below the visible viewport.

## Pixel Result

| Screen | Route | Before diff | After diff | Delta |
|---|---|---:|---:|---:|
| 25 | `/agents/templates` | 11.6725% | 11.1175% | -0.5550% |

## Structural Gate

| Check | Result |
|---|---|
| `npm run audit:bbox:25` | pass 8/8 |

## Remaining High Subregions

| Rank | Subregion | Diff |
|---:|---|---:|
| 1 | drawer primary cta | 22.3280% |
| 2 | page header title/actions | 20.6721% |
| 3 | card hermes | 20.0226% |
| 4 | gallery row one | 16.2817% |
| 5 | card seo | 15.5607% |

## Decision

PASS for this targeted visual polish sprint.

Screen 25 improved materially while preserving the Real UI structural gate and static asset guardrails.

## Next Step

Continue Screen 25 with the next measured subregion: page header title/actions or the Hermes template card. Do not change gallery card internals without first inspecting the subregion crops produced by `npm run audit:subregions:25`.
