# Codex Prompt — Strict 1:1 Visual Parity Implementation

Use Antigravity Awesome Skills for structured implementation.

## Context

This repo contains 55 PNG screen designs for UIKIGAI AI Workforce OS. The implementation must match the PNGs as closely as possible. The PNG files in `public/stitch_ui/` are the visual source of truth. The route and file mapping is in `docs/05-ui-ux/screen-manifest.csv`.

## Read first

Read these files before coding:

1. `AGENTS.md`
2. `docs/00-project/PROJECT_BIBLE.md`
3. `docs/02-architecture/FRONTEND_ARCHITECTURE.md`
4. `docs/05-ui-ux/screen-manifest.csv`
5. `docs/05-ui-ux/stitch-to-code-mapping.md`
6. `docs/11-quality/VISUAL_PARITY_GUARDRAILS.md`
7. `docs/10-uat/frontend-uat-checklist.md`

## Mission

Implement the frontend screens with strict 1:1 visual parity to the PNG designs.

## Non-negotiable rules

- Do not redesign.
- Do not reinterpret the UI.
- Do not change the app shell after it is approved unless fixing shell parity globally.
- Do not leave scaffold content on implemented screens.
- Do not invent backend logic.
- Use mock data that visually matches the screenshots.
- Use reusable components.
- Keep Vietnamese UI copy.
- Keep routes exactly as in `screen-manifest.csv`.
- Screens 01–07 use auth/onboarding layout.
- Screens 08–55 use the shared AppShell.

## Before implementation

Run:

```bash
npm install
npm run normalize:stitch
npm run check:stitch
npm run build
```

If any PNG is missing, stop and report missing files.

## Implementation method per screen

For each screen:

1. Open the corresponding PNG.
2. Measure/replicate the macro layout first:
   - viewport size
   - sidebar width
   - topbar height
   - content max width
   - grid columns
   - right panel width
   - card spacing
3. Implement the shared component structure.
4. Fill mock data to match visual density.
5. Run build.
6. Run parity check for that screen:

```bash
STRICT_MAX_DIFF_PERCENT=1.0 npm run parity:check -- --ids=<screen_id>
```

7. Fix differences.
8. For final handoff, run:

```bash
STRICT_MAX_DIFF_PERCENT=0.5 npm run parity:check -- --ids=<screen_id>
```

## Evidence required in final response

For every completed screen, report:

- Screen ID and route
- Reference PNG filename
- Viewport size
- Pixel mismatch percent
- Files changed
- Remaining differences, if any
- Whether build passed

## First sprint to execute

Implement only these 8 demo-critical screens first:

1. `08_Executive_Command_Center.png` → `/command-center`
2. `20_AI_Workforce_Overview.png` → `/workforce`
3. `21_Org_Chart_View.png` → `/org-chart`
4. `23_Agent_Detail.png` → `/agents/demo-agent`
5. `30_Tickets_Board.png` → `/tickets`
6. `32_Ticket_Detail.png` → `/tickets/demo-ticket`
7. `34_Run_Console.png` → `/runs/demo-run`
8. `37_Approval_Center.png` → `/approvals`

Do not implement the remaining 47 screens until these 8 pass the visual parity gate.
