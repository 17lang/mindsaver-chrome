# Privacy tab copy — permission justifications & data-use disclosure

Copy these into the Chrome Web Store Developer Dashboard → **Privacy** tab. They must match `manifest.json` and `PRIVACY.md`. Draft only; no submission has been made.

## Single purpose

Save the web page the user is viewing as a single-page PDF, a self-contained HTML file, or clean Markdown, entirely on the user's device.

## Permission justifications (one specific sentence each)

| Permission / host access | Justification (EN) |
| --- | --- |
| `<all_urls>` (host_permissions) | Required to read and capture the DOM, images, fonts and cross-origin frames of the specific page the user chooses to save; the extension does not act on pages the user has not selected for saving. |
| `tabs` / `activeTab` | Used to identify the active tab, target content-script messages and open the local `obsidian://` handoff URI; no browsing history is collected or transmitted. |
| `downloads` | Writes the PDF / HTML / Markdown file the user asked for to the browser's download location. |
| `storage` | Stores the user's per-format save settings, filename rules and vault name in local extension storage (not sync storage). |
| `contextMenus` | Adds "Mind Clipper" right-click entries that trigger the same PDF / HTML save actions. |
| `clipboardWrite` | Used only in the long-article fallback of the Obsidian handoff: the article Markdown is placed on the clipboard so the local Obsidian app can create the note via an `obsidian://new` link. Normal articles hand off through the URL directly without touching the clipboard. |
| `scripting` | Injects the bundled, static frame-capture helper into the selected tab (and cross-origin frames) via `chrome.scripting.executeScript`; all code ships inside the package. |
| `offscreen` | Creates a hidden extension page for canvas rendering, PDF assembly and blob-URL creation, because a Manifest V3 service worker has no DOM or `URL.createObjectURL`. |
| `notifications` / `alarms` / `debugger` / `proxy` / `webRequest` | **Not requested.** |

## Remote code declaration

**No.** All JavaScript is bundled in the extension package. The extension uses the default Manifest V3 content security policy, has no `unsafe-eval`, no `eval`/`new Function` for remote code, no CDN scripts and no remotely hosted code. Third-party kernels (pdf-lib, fontkit, html-to-image, Defuddle, SingleFile) are pinned, unmodified local files.

## Data-use disclosure

| Data category | Collected? | Purpose | Transmitted off device? |
| --- | --- | --- | --- |
| Web page content (text, images, source URL) of pages the user saves | Yes, only for the save action | Producing the PDF / HTML / Markdown file requested by the user | **No.** Written locally. The Obsidian handoff passes Markdown through a local `obsidian://new` link; only the long-article fallback places it on the system clipboard. |
| Browsing activity / history | Only the URL and title of the page the user actively saves | Naming the output file and including the source URL in saved content | **No.** No history is read, stored or uploaded. |
| Personally identifiable information, health, financial, authentication, personal communications, location | **No** | — | — |
| User activity (button clicks inside the extension) | Processed locally to run the requested save | Executing the chosen action | **No.** No analytics or telemetry. |
| Settings (save locations, vault name, filename preferences) | Yes, locally | Applying the user's own configuration on the next save | **No.** Local extension storage only, not sync. |

Certifications to tick in the Dashboard:

- Data is **not sold** to third parties.
- Data is **not used or transferred** for purposes unrelated to the extension's single purpose.
- Data is **not used or transferred** to determine creditworthiness or for lending purposes.
- The extension complies with the Chrome Web Store Developer Program Policies and the Limited Use requirements.

## Privacy policy URL

`https://github.com/17lang/mindsaver-chrome/blob/main/PRIVACY.md`

This URL becomes publicly reachable once the repository is published. If the store submission happens before that, host the same `PRIVACY.md` on GitHub Pages or another HTTPS URL first — the Dashboard rejects unreachable policy links.

## Reviewer-visible caveats

- Complete HTML saving issues normal requests to the original resource hosts (images, fonts, styles). Those hosts see the requests required to load their resources; no developer server is involved.
- The Obsidian handoff replaces the system clipboard; other applications and clipboard-history/sync services may read it. The extension never claims Obsidian completed a write and never creates an empty note silently on clipboard failure.
- This build does not install, register or communicate with any native application; it cannot write to arbitrary absolute folders. PDF/HTML always go to the browser download folder; only Markdown can hand off to an Obsidian vault.
