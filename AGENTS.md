# AGENTS.md — Codex / Antigravity Operating Rules

Use Antigravity Awesome Skills for structured implementation.

## Mission
Build the frontend for UIKIGAI AI Workforce OS from the provided 55 PNG screens. This is a premium SaaS product for managing AI agents as a real business workforce.

## Non-negotiable rules

1. Do not redesign. Implement the provided screens as faithfully as possible.
2. Use `public/stitch_ui/*.png` as visual source of truth.
3. Use `docs/05-ui-ux/screen-manifest.csv` as routing and screen source of truth.
4. Keep AppShell consistent across all authenticated screens.
5. Keep onboarding/auth screens separate from AppShell.
6. Use Vietnamese UI copy unless the screen explicitly contains English product terms.
7. Use mock data first. Do not invent backend requirements unless necessary.
8. Do not introduce real secret handling, payment, file-system, or destructive operations.
9. Keep changes small, auditable, and organized by sprint/wave.
10. After each sprint, provide files changed, route list, and UAT notes.

## Design tokens

- Primary blue: `#0052CC`
- Accent cyan/teal: `#00BCD4`
- Background: `#F8FAFC` / white surfaces
- Card radius: 12–16px
- Soft shadow only, no heavy shadows
- Typography: Inter/Roboto/system sans
- UI density: premium SaaS, high whitespace, clear hierarchy


## Strict visual parity gate

The project is not complete when the route merely exists. A screen is complete only when it passes the visual parity workflow.

Required commands after copying the 55 PNG files into `public/stitch_ui/`:

```bash
npm run normalize:stitch
npm run check:stitch
npm run build
STRICT_MAX_DIFF_PERCENT=1.0 npm run parity:check -- --ids=<screen_id>
```

For final handoff, use the stricter gate:

```bash
STRICT_MAX_DIFF_PERCENT=0.5 npm run parity:check -- --ids=<screen_id>
```

Codex must generate and report the evidence files under `parity-reports/`. Do not mark a screen as done without screenshot evidence, diff image, mismatch percentage, and a short note about remaining differences.

Read `docs/11-quality/VISUAL_PARITY_GUARDRAILS.md` before implementing any screen.

## CodeGraph workflow

This repo has CodeGraph initialized in `.codegraph/` for faster local code exploration.

- Before broad repo scans, run `npm run codegraph:status` to confirm the index is current.
- Use `npm run codegraph:sync` after editing files, then query targeted symbols with `npx codegraph query <symbol-or-route>`.
- Keep `.codegraph/config.json` and `.codegraph/.gitignore` in the repo; do not commit `.codegraph/*.db`, cache, or logs.
- If Codex MCP is configured globally, use the CodeGraph MCP server for lightweight lookups before falling back to `rg`.

## Recommended implementation order

Sprint 0: App setup, routing, AppShell, tokens, mock data structure.
Sprint 1: 8 demo screens.
Sprint 2: Wave 1 + Wave 2.
Sprint 3: Wave 3.
Sprint 4: Wave 4.
Sprint 5: Wave 5.
Sprint 6: Wave 6.
Sprint 7: Wave 7 + Wave 8.

## Acceptance criteria per screen

- Route works.
- Layout matches PNG visually.
- Sidebar/topbar consistent where applicable.
- No blank dashboard.
- No broken buttons.
- Loading, empty, error state exists where reasonable.
- Responsive desktop first, tablet/mobile graceful.
- Accessibility: labels, focus states, semantic headings, badge states not color-only.
