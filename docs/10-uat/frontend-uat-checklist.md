# Frontend UAT Checklist

## Global checks

- [ ] App starts with `npm run dev`.
- [ ] Build passes with `npm run build`.
- [ ] `npm run check:stitch` passes or only reports known missing images.
- [ ] No blank screen on any route.
- [ ] Sidebar active state is correct.
- [ ] Topbar appears consistently for screens 08–55.
- [ ] Onboarding screens 01–07 do not show the main sidebar.
- [ ] Vietnamese UI copy is used.
- [ ] Buttons have visible focus states.
- [ ] Tables/cards work on desktop and degrade on mobile.

## Per-screen checks

For each screen in `screen-manifest.csv`:

- [ ] Route opens.
- [ ] Major sections match the PNG.
- [ ] KPI cards / filters / tables / panels are present if shown in PNG.
- [ ] Empty/loading/error states exist where appropriate.
- [ ] Mock data is realistic and not sensitive.
- [ ] No real destructive operation is wired.

## 8 demo screens acceptance

- [ ] Executive Command Center
- [ ] AI Workforce Overview
- [ ] Org Chart View
- [ ] Agent Detail
- [ ] Tickets Board
- [ ] Ticket Detail
- [ ] Run Console
- [ ] Approval Center

These 8 screens should be polished before broad implementation.
