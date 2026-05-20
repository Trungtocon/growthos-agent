# Frontend Architecture

## Stack

- React + TypeScript + Vite
- TailwindCSS
- lucide-react for icons
- recharts for charts
- Mock data first

## Folder structure

```text
src/
  components/
    layout/
    ui/
  data/
  pages/
  styles/
docs/
public/stitch_ui/
```

## Layouts

- Auth/Onboarding screens 01–07: centered onboarding layout.
- Main app screens 08–55: AppShell with sidebar and topbar.

## State strategy

For initial frontend implementation, use local component state and mock data files. Do not add a global state manager until real backend contracts exist.

## Component strategy

Codex should extract reusable UI patterns:

- KPI cards
- Filter tabs
- Data tables
- Insight panels
- Detail drawers
- Wizard steppers
- Status badges
- Risk badges
- Timeline items
- Tool call cards
- Artifact cards
- Permission matrix

## Route strategy

Routes are defined in `src/data/screens.ts` and listed in `docs/05-ui-ux/screen-manifest.csv`.
