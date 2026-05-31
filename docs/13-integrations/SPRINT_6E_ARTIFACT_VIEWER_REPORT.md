# Sprint 6E — Artifact Viewer & Run Output Preview Report

## Goal

Build real artifact viewer and run output preview support for Paperclip/Hermes runtime artifacts without changing layout contracts or bypassing runtime-store.

## Artifact Types Supported

- `markdown`
- `code`
- `json`
- `patch`
- `report`
- `link`
- `image`
- `unknown`
- Legacy fixture types remain accepted: `document`, `log`, `screenshot`, `archive`

## Source / Store Boundaries

| Boundary | Status |
|---|---|
| UI direct Hermes/Paperclip calls | No |
| Runtime-store artifact reads | Yes |
| Selector-driven preview models | Yes |
| Mock/sandbox fallback preserved | Yes |
| AppShell/layout contracts changed | No |

## Components Added

- `ArtifactViewer`
- `ArtifactList`
- `ArtifactPreviewPanel`
- `MarkdownArtifactView`
- `CodeArtifactView`
- `JsonArtifactView`
- `PatchArtifactView`
- `LinkArtifactView`
- `UnknownArtifactView`

## Routes Wired

| Route | Result |
|---|---|
| `/runs/demo-run` | Artifact list, selected artifact, preview panel, source badge, creation time, and metadata render from selectors. |
| `/tickets/demo-ticket` | Linked run artifact summary and latest output preview render from selectors. |
| `/approvals` | Related artifact summary appears for the selected runtime-linked approval. |

## Runtime Lifecycle Integration

When a mock/sandbox run creates runtime output, it now persists:

- Paperclip markdown QA runtime packet.
- Hermes normalized JSON output.
- Paperclip patch-style follow-up artifact.

## Smoke Test

Added:

```bash
npm run smoke:artifact-viewer
```

The smoke verifies:

- Runtime run creates markdown/json/patch artifacts.
- Run Console artifact list renders.
- Artifact selection changes preview.
- Markdown, JSON, and patch previews render.
- Ticket detail shows artifact summary.
- Approval detail displays related artifact summary.

## Verification

| Check | Result |
|---|---|
| `npm run build` | pass |
| `npm run validate:demo-data` | pass |
| `npm run smoke:real-ui-flow` | pass |
| `npm run smoke:interactions` | pass |
| `npm run smoke:workflow-actions` | pass |
| `npm run smoke:runtime-integration` | pass |
| `npm run smoke:runtime-persistence` | pass |
| `npm run smoke:sandbox-connectors` | pass |
| `npm run smoke:real-run-lifecycle` | pass |
| `npm run smoke:artifact-viewer` | pass |
| `npm run audit:static-assets` | pass |
| onboarding 01–07 | pass |
| bbox 08/20/21/23/30/32/34/37 | pass |

## Decision

PASS.
