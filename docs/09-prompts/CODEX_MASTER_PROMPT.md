# CODEX MASTER PROMPT

Use Antigravity Awesome Skills for structured implementation.

You are implementing the frontend for UIKIGAI AI Workforce OS.

## Read first

1. `AGENTS.md`
2. `docs/00-project/PROJECT_BIBLE.md`
3. `docs/02-architecture/FRONTEND_ARCHITECTURE.md`
4. `docs/05-ui-ux/screen-manifest.csv`
5. `docs/05-ui-ux/stitch-to-code-mapping.md`
6. `docs/10-uat/frontend-uat-checklist.md`

## Goal

Create a polished React frontend for all 55 screens based on PNG files in `public/stitch_ui`.

## Critical rules

- Do not redesign. Match PNG visual layout as closely as possible.
- Keep shared AppShell consistent.
- Use reusable components.
- Use mock data first.
- No backend calls unless existing API contracts are present.
- No real payments, secrets, filesystem, approvals, or destructive operations.
- Keep Vietnamese UI copy.

## First task

Implement Sprint 0 and Sprint 1:

Sprint 0:
- Verify app setup.
- Verify 55 route scaffolds.
- Create shared UI tokens/components.
- Ensure `npm run build` passes.

Sprint 1, polish these 8 screens first:
1. `/command-center`
2. `/workforce`
3. `/org-chart`
4. `/agents/demo-agent`
5. `/tickets`
6. `/tickets/demo-ticket`
7. `/runs/demo-run`
8. `/approvals`

## Expected response after implementation

- Summary of what changed.
- Files changed.
- Routes completed.
- UAT status.
- Remaining gaps.
