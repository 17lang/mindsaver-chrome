#!/usr/bin/env node
/* Static self-check for the Chrome MV3 package.
 * Run: node tools/check-chrome-mv3.mjs
 * This is a build-time check only. It is NOT a Chrome runtime verification. */

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const notes = [];
const ok = (cond, msg) => { if (!cond) errors.push(msg); };
const read = (p) => readFileSync(join(root, p), 'utf8');
const has = (p) => existsSync(join(root, p));

const manifest = JSON.parse(read('manifest.json'));
ok(manifest.manifest_version === 3, 'manifest_version must be 3');
ok(manifest.background && manifest.background.service_worker === 'sw.js', 'background.service_worker must be sw.js');
ok(!manifest.background?.scripts, 'MV2 background.scripts must be gone');
ok(!manifest.browser_action, 'MV2 browser_action must be gone');
ok(!manifest.browser_specific_settings, 'Firefox-specific settings must be gone');
ok(!!manifest.action, 'action must be present');
ok(!!manifest.host_permissions?.includes('<all_urls>'), 'host_permissions needs <all_urls>');
for (const p of ['scripting', 'offscreen', 'contextMenus', 'nativeMessaging', 'downloads', 'storage', 'clipboardWrite', 'tabs', 'activeTab']) {
  ok(manifest.permissions?.includes(p), 'missing permission: ' + p);
}
ok(!manifest.permissions?.includes('menus'), 'MV2 menus permission must not be used');

const referenced = [
  manifest.background.service_worker,
  manifest.action.default_popup,
  ...Object.values(manifest.action.default_icon || {}),
  ...Object.values(manifest.icons || {}),
  ...(manifest.content_scripts || []).flatMap((cs) => cs.js || []),
  ...(manifest.content_scripts || []).flatMap((cs) => cs.css || []),
  manifest.options_ui?.page,
].filter(Boolean);
for (const p of referenced) ok(has(p), 'manifest references missing file: ' + p);

const cs = (manifest.content_scripts || [])[0];
ok(cs?.js?.[0] === 'lib/browser-shim.js', 'browser-shim.js must load first in content scripts');

for (const p of ['sw.js', 'offscreen.html', 'offscreen.js', 'lib/browser-shim.js', 'lib/sw-api-bridge.js']) {
  ok(has(p), 'missing Chrome runtime file: ' + p);
}

// Extension pages must not contain inline scripts (MV3 extension_pages CSP).
for (const p of ['popup/popup.html', 'options/settings.html', 'offscreen.html']) {
  const html = read(p);
  const inline = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter((m) => !/\bsrc=/.test(m[1]) && m[2].trim());
  ok(inline.length === 0, 'inline script in ' + p);
  for (const m of html.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)) {
    const rel = p.includes('/') ? join(dirname(p), m[1]) : m[1];
    ok(has(rel), 'script missing from ' + p + ': ' + m[1]);
  }
}
ok(read('popup/popup.html').includes('browser-shim.js'), 'popup must load the platform shim');
ok(read('options/settings.html').includes('browser-shim.js'), 'options must load the platform shim');

// MV3 forbids code-string injection and Firefox-style Promise-returning
// listeners. The service worker legitimately uses Promise.resolve() inside its
// API dispatcher, so only the inherited message-bearing files are scanned for
// the Promise-return antipattern.
const runtime = ['background.js', 'sw.js', 'offscreen.js', 'lib/browser-shim.js', 'lib/sw-api-bridge.js',
  ...['capture', 'htmlsave', 'page-metadata', 'picker', 'overlay', 'serialize', 'pdfclient', 'textlayer', '00-boot'].map((n) => 'content/' + n + '.js')];
const messageBearing = runtime.filter((p) => p !== 'sw.js' && p !== 'offscreen.js' && p !== 'lib/sw-api-bridge.js');
for (const p of runtime) {
  const s = read(p);
  ok(!/tabs\.executeScript\s*\([^)]*\{[^}]*\bcode\s*:/s.test(s), 'code-string executeScript in ' + p);
  if (messageBearing.includes(p)) {
    ok(!/return\s+Promise\.resolve\s*\(/.test(s),
      'onMessage listener must not return a Promise in ' + p);
  }
}
ok(read('sw.js').includes("importScripts("), 'service worker must importScripts its dependencies');
ok(read('sw.js').includes('chrome.runtime.onMessage.addListener'), 'service worker must register its listener');
ok(read('lib/sw-api-bridge.js').includes('__mc'), 'offscreen bridge must use the __mc envelope');

// Tabs opened before the unpacked extension was loaded have no content
// scripts; the SW must be able to inject them on demand.
const swSource = read('sw.js');
ok(swSource.includes('ensureContentScripts'), 'SW must recover from a missing content script');
ok(swSource.includes('CONTENT_SCRIPT_FILES'), 'SW must bundle the full content-script list for on-demand injection');
ok(swSource.includes('MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND') && swSource.includes('queuedCapture'),
  'SW must serialize/space captureVisibleTab to respect the Chrome 2-calls-per-second quota');
ok(/CAPTURE_INTERVAL_MS\s*=\s*Math\.ceil\(1000\s*\/\s*CAPTURE_RATE\)\s*\+\s*\d+/.test(swSource),
  'capture spacing must derive from the published Chrome rate limit');
ok(!/AMO 页|browser page or AMO/.test(read('_locales/zh_CN/messages.json') + read('_locales/en/messages.json')),
  'Firefox-only AMO wording must be replaced with Chrome guidance');

// Markdown handoff is inherited from Obsidian Web Clipper, itself a published
// Chrome extension. Reuse it; never re-implement its Markdown or clipboard path.
const boot = read('content/00-boot.js');
const obsidian = read('options/obsidian-save.js');
const offscreen = read('offscreen.js');
const htmlsave = read('content/htmlsave.js');
ok(boot.includes("copy-to-clipboard"), 'page-side clipboard fallback must mirror upstream content.ts');
ok(obsidian.includes('navigator.clipboard.writeText'), 'upstream stage 1 (Clipboard API) must be reused');
ok(obsidian.includes("action: 'copy-to-clipboard'"), 'upstream stage 2 message contract must be reused');
ok(!/execCommand|textarea/.test(obsidian), 'obsidian-save.js must not invent its own clipboard writer');
ok(offscreen.includes("'options/obsidian-save.js'"), 'offscreen must load the upstream Obsidian handoff');
ok(htmlsave.includes('createMarkdownContent') && htmlsave.includes('Defuddle'),
  'Markdown extraction must keep using the inherited Defuddle/createMarkdownContent');

// Picker arrow keys grow the selected rect in the pressed screen direction.
// They must never be aliases for Q/W ancestor-chain level changes.
const picker = read('content/picker.js');
ok(picker.includes('ArrowLeft') && picker.includes('ArrowRight'), 'picker must handle all four arrow keys');
ok(!/e\.key === 'q' \|\| e\.key === 'Q' \|\| e\.key === 'ArrowUp'/.test(picker),
  'ArrowUp must not change the ancestor-chain level');
ok(!/e\.key === 'w' \|\| e\.key === 'W' \|\| e\.key === 'ArrowDown'/.test(picker),
  'ArrowDown must not change the ancestor-chain level');
ok(picker.includes('nodeRect') && picker.includes('__mcAdjustRect'),
  'picker must keep an adjustable rect and expose it for self-check');
for (const loc of ['en', 'zh_CN', 'zh_TW']) {
  const messages = JSON.parse(read('_locales/' + loc + '/messages.json'));
  ok(messages.ui_87e7b5f5db19.message.includes('↑↓←→'),
    loc + ' node hint must document the four-direction keys');
}

// Bundled third-party kernels and licenses must stay byte-identical to the
// inherited baseline. The two new platform shim files under lib/ are ours.
const OUR_LIB_FILES = new Set(['lib/browser-shim.js', 'lib/sw-api-bridge.js']);
try {
  const changed = execFileSync('git', ['diff', '--name-only', 'HEAD', '--', 'lib/', 'licenses/'], { cwd: root, encoding: 'utf8' })
    .trim().split('\n').filter((p) => p && !OUR_LIB_FILES.has(p));
  ok(changed.length === 0, 'official kernels/licenses must not be modified: ' + changed.join(', '));
} catch (e) {
  notes.push('git diff unavailable, skipped kernel identity check');
}

// The Firefox package builder must remain untouched (inherited byte evidence).
try {
  const changed = execFileSync('git', ['diff', '--name-only', 'HEAD', '--', 'tools/package-extension.py'], { cwd: root, encoding: 'utf8' }).trim();
  ok(changed === '', 'tools/package-extension.py must stay byte-identical');
} catch (e) {
  notes.push('git diff unavailable, skipped Firefox builder check');
}

for (const n of notes) console.log('  note:', n);
if (errors.length) {
  console.error('Chrome MV3 static check FAILED (' + errors.length + '):');
  for (const e of errors) console.error('  -', e);
  process.exit(1);
}
console.log('Chrome MV3 static check OK: manifest, references, CSP, injection, listeners, kernel identity.');
