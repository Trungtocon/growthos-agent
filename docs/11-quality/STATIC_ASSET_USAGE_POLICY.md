# Static Asset Usage Policy

## Allowed

- Small logos.
- Small icons.
- Demo avatars.
- Real illustration assets when they are not cropped screenshots of UI.
- PNG references in `public/stitch_ui` for parity checks.

## Not Allowed In Production/Real UI Routes

- Full-screen screenshots.
- `parity_xx/sidebar.png`.
- `parity_xx/topbar.png`.
- `parity_xx/content.png`.
- Cropped screenshots used as cards, tables, charts, dashboards, or main panels.
- Background images from parity folders used to fake UI.

## Current Rule

- `/command-center` must render real React components.
- `/command-center` must not render `parity_08` sliced layout assets.
- Real UI routes must not render `parity_xx/sidebar.png`, `parity_xx/topbar.png`, or `parity_xx/content.png`.
- Parity assets may remain in the repository as visual references and evidence, but they must not be mapped into active production routes.
