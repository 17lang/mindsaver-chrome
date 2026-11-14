# Store screenshots — required before submission

Chrome Web Store requires **1–5 real UI screenshots**, PNG or JPEG without alpha, sized **1280×800** or **640×400**. They must show the extension actually working in Chrome; rendered marketing mockups, logos on gradients and features not described in the listing are rejection risks.

Suggested set (capture in a clean Chrome profile on a public article page):

1. Toolbar popup open on a long article, with the three save buttons visible (1280×800).
2. Selection frame mode: red dashed box around an article section with the arrow-key hint bar visible.
3. Generated single-page PDF opened in a PDF viewer, showing it is longer than one screen.
4. Settings page with per-format save locations and filename rules.
5. Markdown "Send to Obsidian" result hint (handed-off, not "saved").

Notes:

- Do not reuse the annotated screenshots from bug reports (they contain handwritten red notes).
- Do not show `chrome://extensions` internals as the only screenshot.
- Keep the browser language consistent with the listing language, or provide one set per language.
- Store the PNG/JPEG files in this directory; they are safe to commit (no private page content, credentials or local paths).

Status as of 2026-11-14: **four real screenshots captured** (1280×800, RGB, no alpha):
- `01-popup.png` — toolbar popup: 整页 PDF / 选取框架 / 框选区域 / 完整 HTML / Markdown 五个入口与四类按钮（Chrome for Testing 157 headless）。
- `02-settings.png` — 设置页：左侧「文件命名 / Markdown 设置 / PDF 设置 / HTML 设置」导航与 Markdown 保存位置表单（Chrome for Testing 157 headless）。
- `03-picker-selecting.png` — 选区框（Node 模式）正在选择文章区块：红虚线框套住目标卡片、左上角显示「宽 × 高 px」尺寸标签、底部居中显示操作提示条（Chrome for Testing 148 headless 在示例文章页上渲染真实 `content/picker.js` UI，无桌面/浏览器 chrome）。
- `04-picker-saved.png` — 选区框保存结果：暗色全屏结果浮层，中央为截取内容预览图，下方绿色「PDF 已下载：…pdf」成功提示与「下载图片 / 关闭」按钮（同前 headless 渲染）。

四张截图均为 1280×800、RGB、无 alpha，已满足商店 1–5 张要求，并补齐了建议中的「选区框」两张。上传时按 01→02→03→04 顺序。送审所需的四张截图与仓库其余材料已就绪，实际送审由 Owner 在 Chrome 开发者账号侧执行。
