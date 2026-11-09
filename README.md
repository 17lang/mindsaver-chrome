# Mindsaver for Chrome / Mind Clipper

[中文说明](README.zh-CN.md)

Save any web page as a **single-page PDF**, a **complete offline HTML file**, or **clean Markdown** — in one click, entirely on your computer. This is the Chrome (Manifest V3) open-source edition derived from [Pagesaver 0.7.1](https://github.com/17lang/pagesaver).

The repository is named `mindsaver-chrome` as requested by the owner. The extension manifest and UI still display **Mind Clipper 0.8.0**, which is the name used by the tested build; see [Store listing notes](docs/CHROME-WEB-STORE.md#naming) if the store display name should be unified.

## What it does

| Save mode | Output | Notes |
| --- | --- | --- |
| Full page / selected frame / dragged area | One long, single-page PDF with a searchable text layer | Native screenshots stitched with a Chrome-compliant 2-calls-per-second throttle |
| Complete HTML | One self-contained `.html` file | SingleFile core resources inlined; works offline when resources were reachable |
| Markdown | `.md` file, or hand off directly to Obsidian | Defuddle extraction + reused Obsidian Web Clipper note-creation flow |

Three formats share the same filename rules (publication date + cleaned title, automatic numbering), per-format save settings and the local save protocol. No account, no developer server, no analytics, no advertising, no AI features.

## Current status — read this before filing an issue

This is an **open-source development release**, not a finished Chrome Web Store product.

- Verified in real Chrome 157 (Chrome for Testing, isolated profile, CDP): short-page PDF / HTML / Markdown downloads, the capture throttle in the real service worker, and the picker arrow-key geometry (18 assertions). The owner also confirmed that full-page PDF and both selection PDF modes work on a long 36kr article.
- **Not yet verified**: the full QA matrix, cross-origin iframes, Obsidian handoff, service-worker sleep/resume, real-site selection after arrow-key expansion, and the optional native save helper.
- The optional Go helper is **not compiled or registered** in this release. Only the default browser download and "Send to Obsidian" paths are usable. The helper download link in Settings is intentionally a placeholder.
- Chrome Web Store submission is **not done**. It needs a developer account, the one-time registration fee, store listing assets and OAuth credentials; everything that can be prepared is in [docs/CHROME-WEB-STORE.md](docs/CHROME-WEB-STORE.md).

## Try it locally (unpacked extension)

Chrome stable no longer allows dragging an unsigned `.crx` into the browser; the official developer path is "Load unpacked".

1. Download `mind-clipper-chrome.zip` from [Releases](https://github.com/17lang/mindsaver-chrome/releases) and unzip it into a **permanent directory** (Chrome remembers the path; deleting or moving it breaks the install).
2. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked** and select the directory that directly contains `manifest.json`.
3. Open a normal `http://` / `https://` article, **refresh it once**, and set the extension's **Site access → On all sites**. Click the toolbar button.

Chrome 116+ is required. Restricted pages (`chrome://`, the Web Store, PDF viewer, new tab) cannot be captured; the extension now shows an actionable localized hint there. Long-page PDFs take about 0.6 s per screen — that is the Chrome capture quota, not a hang.

## Build from source

Python 3.9+ and Node 18+; no npm install needed.

```sh
python3 tools/package-chrome.py --output dist/mind-clipper-chrome.zip
python3 tools/test_mv3_static.py                 # 7 static tests
node tools/check-chrome-mv3.mjs
node tools/test-picker-keys.cjs                  # picker geometry logic
node --test tools/test-destinations.cjs tools/test-filename-rules.cjs tools/test-i18n.cjs
```

With Chrome for Testing running on `--remote-debugging-port=9222`, the real-browser interaction harness is:

```sh
node tools/test-picker-chrome.cjs
```

`tools/package-extension.py` (the inherited Firefox XPI builder) and the bundled official kernels are kept byte-identical to the inherited baseline; `tools/check-chrome-mv3.mjs` enforces this.

## Architecture in one paragraph

`manifest.json` is MV3. `sw.js` is a thin service worker that registers events at top level, proxies a whitelist of browser APIs and keeps the offscreen document alive. `offscreen.html` / `offscreen.js` host the inherited `background.js` with its DOM, canvas, XHR, `FileReader` and blob-URL logic — a service worker has none of these. `lib/browser-shim.js` maps `browser.*` to `chrome.*` with an explicit alias table (no dynamic eval); `lib/sw-api-bridge.js` carries the `__mc` message envelope. Content scripts are static files injected by `chrome.scripting`, with on-demand re-injection when a tab predates the extension. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — note it documents the inherited Firefox design and is kept as reference.

## Upstream reuse

Markdown extraction and the Obsidian handoff are **pure reuse** of [Obsidian Web Clipper](https://github.com/obsidianmd/obsidian-clipper) (MIT, pinned commit `6d56d618b00bd970aa738d6a7a61edee27783e81`): Defuddle + `createMarkdownContent`, the two-stage clipboard writer (Clipboard API → page-side `copy-to-clipboard` fallback) and the `obsidian://new?…&clipboard` URI. Chrome-side changes are platform plumbing only. See [options/UPSTREAM.md](options/UPSTREAM.md). The extension does not include Clipper's highlighter, reader, templates, AI or telemetry.

## Privacy

All processing is local. See [PRIVACY.md](PRIVACY.md) for the full permission list, data-use disclosure and clipboard/Obsidian caveats.

## License

**AGPL-3.0-or-later**, inherited from Pagesaver. Third-party components keep their own licenses (MIT / Apache-2.0 / SIL OFL 1.1 / AGPL-3.0); full texts and pinned versions are in [LICENSE](LICENSE), [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), `licenses/` and `options/LICENSE-obsidian-clipper.txt`. Runtime vendor bytes are unmodified; provenance hashes are in [tools/vendor/provenance.json](tools/vendor/provenance.json).

## Contributing

Issues and pull requests are welcome. Please include Chrome version, OS, a reproducible public URL, the button you clicked, the exact error text and the service-worker/popup console output. Never post private page content, vault paths or credentials in a public issue. Keep the pinned third-party kernels untouched, do not add `unsafe-eval` or remote code, and run the static suite before opening a PR.

`AGENTS.md` and `PROJECT-MANAGEMENT.md` are the original project-management conventions (they reference a local Obsidian vault); `docs/FIREFOX-PUBLISHING.md` and `docs/VERIFICATION.md` are inherited Firefox reference material, not Chrome QA evidence.
