# UIKIGAI AI Workforce OS — Frontend Repo Starter

Repo này được chuẩn bị để Codex / Antigravity quét một lượt và triển khai frontend cho **55 màn hình** dựa trên ảnh thiết kế PNG của bạn.

## Cách dùng nhanh

```bash
npm install
npm run check:stitch
npm run dev
```

Sau đó mở: `http://localhost:5173`

## Việc cần làm trước khi giao Codex

Copy toàn bộ 55 ảnh PNG vào thư mục:

```text
public/stitch_ui/
```

Tên ảnh nên khớp với `docs/05-ui-ux/screen-manifest.csv`. Nếu file hiện tại có tên hơi khác, chạy check để biết file nào thiếu:

```bash
npm run check:stitch
```

## Source of truth

Codex cần đọc theo thứ tự:

1. `AGENTS.md`
2. `docs/00-project/PROJECT_BIBLE.md`
3. `docs/05-ui-ux/screen-manifest.csv`
4. `docs/05-ui-ux/stitch-to-code-mapping.md`
5. `docs/09-prompts/CODEX_MASTER_PROMPT.md`
6. `docs/10-uat/frontend-uat-checklist.md`

## Nguyên tắc triển khai

- Không redesign. Bám ảnh PNG trong `public/stitch_ui`.
- Dùng AppShell thống nhất cho các màn sau onboarding.
- Onboarding dùng layout riêng, không dùng sidebar chính.
- UI tiếng Việt.
- Brand: UIKIGAI, xanh dương + cyan/teal, nền trắng, hiện đại, cao cấp, đơn giản.
- Frontend trước, mock data trước, chưa cần backend.
- Mỗi màn phải có route, responsive, loading/empty/error states, accessibility cơ bản.

## 8 màn nên ưu tiên prototype trước

1. Executive Command Center
2. AI Workforce Overview
3. Org Chart View
4. Agent Detail
5. Tickets Board
6. Ticket Detail
7. Run Console
8. Approval Center


## Strict 1:1 visual parity workflow

After copying all 55 PNG screen files into `public/stitch_ui/`, run:

```bash
npm install
npm run normalize:stitch
npm run check:stitch
npm run build
```

Start the dev server in one terminal:

```bash
npm run dev
```

Then run visual parity checks in another terminal:

```bash
# Check the 8 demo-critical screens
STRICT_MAX_DIFF_PERCENT=1.0 npm run parity:core

# Check one screen only
STRICT_MAX_DIFF_PERCENT=1.0 npm run parity:check -- --ids=8

# Final strict handoff gate
STRICT_MAX_DIFF_PERCENT=0.5 npm run parity:check -- --ids=8
```

The script creates an evidence pack in `parity-reports/`:

```text
parity-reports/
├── summary.json
└── 08_executive-command-center/
    ├── actual.png
    ├── diff.png
    └── report.json
```

A screen should not be considered complete until its generated screenshot, diff report, route, shell, spacing, typography, badges, tables, charts and visible content match the reference PNG.

Read these before asking Codex to implement screens:

- `docs/11-quality/VISUAL_PARITY_GUARDRAILS.md`
- `docs/09-prompts/CODEX_VISUAL_PARITY_PROMPT.md`
