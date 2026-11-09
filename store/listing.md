# Chrome Web Store listing copy

Draft only — nothing has been submitted. Fill these into the Developer Dashboard's **Store listing** tab. Keep the name consistent with `manifest.json`.

## Name (≤75 characters)

`Mind Clipper`

> Do not use `Mindsaver for Chrome` as the store title: the metadata policy disallows "Chrome" as a standalone word (implies Google endorsement) and requires the name to match the extension. See [docs/CHROME-WEB-STORE.md](../docs/CHROME-WEB-STORE.md#naming).

## Category / language

- Category: **Productivity** (Tools is the fallback)
- Primary language: **Chinese (Simplified)**; localizations: English, Chinese (Traditional)

## Short description (≤132 characters)

**English**

```
Save any web page as a single-page PDF, a complete offline HTML file, or clean Markdown — locally, in one click.
```

**中文（简体）**

```
一键把网页保存为单页长 PDF、完整离线 HTML 或干净的 Markdown，全部在本机完成，不上传任何内容。
```

## Detailed description

**English**

```
Mind Clipper saves the page you are reading as a file on your computer. One purpose: capture web pages into three useful formats, entirely locally.

WHAT YOU CAN SAVE
• Single-page PDF — the whole page stitched into one long, searchable PDF (with a text layer where available). Pick a frame on the page, drag an area, or use the right-click menu for partial captures. Long pages are captured in several screens; Chrome limits screenshots to two per second, so a long page takes a few seconds.
• Complete HTML — one self-contained .html file with styles, images and fonts inlined, so it still opens when you are offline (resources must have been reachable while saving).
• Markdown — clean article text with navigation, ads and footers removed. Save it as a .md file, or hand it to your installed Obsidian app through the clipboard and an obsidian:// link. The extension reports "handed off", never "saved by Obsidian".

FILE NAMES AND SETTINGS
By default files are named with the publication date followed by a cleaned page title; duplicate names are numbered automatically. PDF, HTML and Markdown have separate save settings. You can turn automatic naming off, move the date to the end, and choose where each format goes (browser download or the Obsidian handoff).

PRIVACY
All processing happens on your device. There is no account, no developer server, no analytics, no advertising and no remote code. Saving complete HTML makes normal requests for that page's images, fonts and styles to their original hosts. The optional Obsidian handoff replaces your clipboard with the article, so other apps or clipboard history may read it. Settings stay in local extension storage. See the privacy policy for the full permission and data-use declaration.

PERMISSIONS
Site access is needed to capture the page you choose; downloads writes the file; storage keeps settings; contextMenus adds the right-click actions; scripting injects the bundled capture helper into frames; offscreen provides a hidden page for canvas/PDF work because a Manifest V3 service worker has no DOM; clipboardWrite and nativeMessaging serve the explicitly chosen Obsidian and optional-helper routes. Every permission has a specific justification in the Privacy tab.

NOT INCLUDED
No highlighter, reader mode, AI, templates, telemetry or cloud sync. The optional local save helper (Native Messaging) is not shipped in this release; use the browser download and Obsidian handoff routes.

Open source under AGPL-3.0-or-later. Source, build instructions and issue tracker: https://github.com/17lang/mindsaver-chrome
```

**中文（简体）**

```
Mind Clipper 把正在阅读的网页保存为本地文件。它只做一件事：把网页保存成三种实用格式，全部在本机完成。

可以保存什么
• 单页长 PDF：整页拼接成一个可搜索的长 PDF（可用时带文字层）。也可用「选取框架」「框选区域」或右键菜单截取局部。长页会分屏截图；Chrome 限制每秒最多 2 次截图，因此长页需要等待数秒。
• 完整 HTML：单个自包含 .html 文件，样式、图片与字体内联，断网后仍可打开（保存时资源需可访问）。
• Markdown：去除导航、广告与页脚后的干净正文。可保存为 .md 文件，也可通过剪贴板与 obsidian:// 链接交给本机已安装的 Obsidian。扩展只报告「已交接」，不会声称 Obsidian 已写入。

文件名与设置
默认使用「发布日期 + 规范标题」命名，重名自动编号；PDF、HTML、Markdown 各有独立保存设置。可关闭自动命名、把日期放到末尾，并为每种格式选择保存方式。

隐私
全部在本机处理，没有账号、开发者服务器、统计、广告或远程代码。保存完整 HTML 时会向资源原站发起正常的图片、字体、样式请求。选择交给 Obsidian 时，正文会替换剪贴板内容，其他应用与剪贴板历史可能读取。设置仅存于扩展本地存储。完整权限与数据使用声明见隐私政策。

权限说明
站点访问用于截取你选择的网页；downloads 写文件；storage 保存设置；contextMenus 提供右键保存；scripting 注入随包的框架截图辅助脚本；offscreen 提供隐藏页面处理 canvas/PDF（Manifest V3 service worker 没有 DOM）；clipboardWrite 与 nativeMessaging 仅服务于用户主动选择的 Obsidian 交接与可选本机工具。每项权限在「隐私权规范」中都有具体理由。

不包含
没有高亮、阅读器、AI、模板、统计或云同步。可选的本机保存工具（Native Messaging）本版本未编译未登记，请使用浏览器下载与 Obsidian 交接两条路线。

本项目以 AGPL-3.0-or-later 开源。源码、构建说明与问题反馈：https://github.com/17lang/mindsaver-chrome
```

## Single purpose statement

**EN**: `Save the web page the user is viewing as a single-page PDF, a self-contained HTML file, or clean Markdown, entirely on the user's device.`

**中文**: `把用户正在浏览的网页在本机保存为单页 PDF、自包含 HTML 或干净的 Markdown 文件。`

## Notes for reviewers

```
This extension does not require an account, login, API key, or network service.
Test on a normal http/https article page (Chrome 116+), then click the toolbar
icon and choose one of the three save buttons. After loading the unpacked
extension, refresh the page once and set Site access to "On all sites" in
chrome://extensions > Mind Clipper > Details; Chrome does not inject content
scripts into tabs that were open before the extension was loaded. Restricted
pages (chrome://, Web Store, PDF viewer, new tab) are not capturable by design
and show a localized hint. Long-page PDF capture is intentionally paced at
about 0.6 s per screen because Chrome allows only 2 captureVisibleTab calls
per second. The optional Native Messaging helper is not included in this
release; the default browser download and Obsidian handoff paths need no
extra installation. Source and build instructions:
https://github.com/17lang/mindsaver-chrome
```
