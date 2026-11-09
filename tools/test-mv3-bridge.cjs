#!/usr/bin/env node
/* In-process development self-check for the Chrome MV3 message protocol.
 *
 * Loads the real sw.js and lib/sw-api-bridge.js into separate VM contexts,
 * wires a mock chrome.runtime message bus between them, and verifies:
 *   - business messages reach the offscreen listener and the reply returns
 *   - the whitelisted API proxy works and rejects unknown APIs
 *   - internal __mc envelopes are ignored by content-script listeners
 *
 * This is NOT a Chrome runtime verification: no real browser, DOM, canvas,
 * downloads, native messaging or store behaviour is exercised here.
 *
 * Run: node tools/test-mv3-bridge.cjs
 */

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* A minimal model of chrome.runtime.sendMessage: delivers to every other
 * extension context; the first sendResponse wins; returning true keeps the
 * channel open for an async reply. */
function makeBus() {
  const contexts = [];
  return {
    contexts,
    send(from, msg) {
      return new Promise((resolve) => {
        let settled = false;
        let asyncCount = 0;
        const sendResponse = (value) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };
        for (const ctx of contexts) {
          if (ctx === from) continue;
          for (const fn of ctx.listeners) {
            let ret;
            try { ret = fn(msg, { id: 'mock-sender', tab: { id: 7, url: 'https://example.test/' } }, sendResponse); }
            catch (e) { /* a listener throwing must not break delivery */ }
            if (ret === true) asyncCount++;
            if (settled) break;
          }
          if (settled) break;
        }
        if (!settled && !asyncCount) resolve(undefined);
        const timer = setTimeout(() => { if (!settled) { settled = true; resolve(undefined); } }, 15000);
        if (timer.unref) timer.unref();
      });
    }
  };
}

const bus = makeBus();

function makeContext(name, extraChrome) {
  const ctx = { name, listeners: [] };
  const runtime = {
    onMessage: { addListener: (fn) => ctx.listeners.push(fn) },
    onInstalled: { addListener: () => {} },
    onStartup: { addListener: () => {} },
    sendMessage: (msg) => bus.send(ctx, msg),
    getURL: (p) => 'chrome-extension://mock/' + String(p).replace(/^\//, ''),
    getContexts: async () => [{ contextType: 'OFFSCREEN_DOCUMENT' }]
  };
  ctx.chrome = Object.assign({ runtime }, extraChrome);
  bus.contexts.push(ctx);
  return ctx;
}

const swCtx = makeContext('service-worker', {
  i18n: { getMessage: (k) => k, getUILanguage: () => 'en' },
  offscreen: { createDocument: async () => {}, closeDocument: async () => {} },
  contextMenus: { onAddRule: null, removeAll: () => {}, create: () => {}, onClicked: { addListener: () => {} } },
  action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
  tabs: {
    query: async () => [{ id: 7, windowId: 1 }],
    sendMessage: async () => ({ success: true }),
    captureVisibleTab: async () => 'data:image/png;base64,AA',
    create: async () => ({ id: 8 }),
    get: async (id) => ({ id: id, url: 'https://example.test/' })
  },
  downloads: { download: async () => 42 },
  storage: { local: { get: async () => ({}), set: async () => {} } },
  scripting: {
    // The presence probe has neither `args` nor `files`; real frame
    // injections / on-demand file injections have one of them.
    executeScript: async (injection) => injection && (injection.args || injection.files)
      ? [{ result: { ok: true } }]
      : [{ result: false }]
  }
});

const offCtx = makeContext('offscreen', {
  i18n: { getUILanguage: () => 'en' }
});

const contentCtx = makeContext('content-script', {});

/* Service worker context: importScripts is a no-op because the three imported
 * modules are not part of this protocol test. */
const swSandbox = {
  chrome: swCtx.chrome,
  importScripts: () => {},
  PageSaverI18n: { t: (k) => k },
  PageSaverNative: {
    call: async () => ({ ok: true }),
    save: async (blob, filename) => ({ filename, ok: true })
  },
  clients: { matchAll: async () => [] },
  console: { log: () => {}, warn: () => {}, error: () => {} },
  setTimeout, clearTimeout, Map, Promise, Object, Array, JSON, String, Error
};
vm.createContext(swSandbox);
vm.runInContext(read('sw.js'), swSandbox, { filename: 'sw.js' });

/* Offscreen context: only the bridge is loaded; DOM-dependent boot is skipped. */
const offSandbox = {
  chrome: offCtx.chrome,
  document: { head: { appendChild: () => {} }, createElement: () => ({}) },
  navigator: { language: 'en' },
  fetch: async () => ({ ok: false }),
  console: { log: () => {}, warn: () => {}, error: () => {} },
  setTimeout, clearTimeout, Map, Promise, Object, Array, JSON, String, Error
};
offSandbox.globalThis = offSandbox;
vm.createContext(offSandbox);
vm.runInContext(read('lib/sw-api-bridge.js'), offSandbox, { filename: 'lib/sw-api-bridge.js' });

const bridge = offSandbox.MindClipperBridge;
bridge.install({ dict: { hello: { message: 'Hello' } }, uiLang: 'en' });

// Stand-in for the inherited background.js message listener.
var received = null;
offSandbox.browser.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  received = { msg: msg, tab: sender && sender.tab };
  if (msg.type === 'CAPTURE_PAGE_PDF') { sendResponse({ ok: true, filename: 'page.pdf' }); return false; }
  if (msg.type === 'ASYNC_JOB') { setTimeout(() => sendResponse({ ok: true, done: 1 }), 5); return true; }
  return false;
});
bridge.markBooted();

// Stand-in for a content script listener: must ignore internal envelopes.
var contentSawBusiness = 0;
contentCtx.listeners.push(function (msg, sender, sendResponse) {
  if (msg && msg.__mc) return false;
  if (msg && msg.type === 'CAP_OVERLAY') { contentSawBusiness++; sendResponse({ ok: true }); return false; }
  return false;
});

(async function run() {
  // 1. A business message from a content script reaches offscreen and returns.
  const reply = await bus.send(contentCtx, { type: 'CAPTURE_PAGE_PDF' });
  assert.equal(reply && reply.ok, true, 'business reply must round-trip');
  assert.equal(reply && reply.filename, 'page.pdf', 'business filename must survive');
  assert.equal(received.msg.type, 'CAPTURE_PAGE_PDF', 'offscreen must see the original payload');
  assert.equal(received.tab.id, 7, 'sender tab id must survive forwarding');

  // 2. An async offscreen listener (return true + late sendResponse) works.
  const asyncReply = await bus.send(contentCtx, { type: 'ASYNC_JOB' });
  assert.equal(asyncReply && asyncReply.ok, true, 'async response must round-trip');
  assert.equal(asyncReply && asyncReply.done, 1, 'async payload must survive');

  // 3. Whitelisted API calls from offscreen execute in the service worker.
  const tabs = await offSandbox.browser.tabs.query({ active: true, currentWindow: true });
  assert.equal(tabs[0].id, 7, 'tabs.query must be proxied to the service worker');
  const dl = await offSandbox.browser.downloads.download({ url: 'blob:mock/x', filename: 'a.pdf' });
  assert.equal(dl, 42, 'downloads.download must be proxied');
  const frame = await offSandbox.browser.tabs.frameCommand(7, 'https://example.test/', 'prepare', null);
  assert.equal(frame[0].ok, true, 'frame.command must return injection results');

  // 4. Unknown APIs are rejected by the whitelist, never executed.
  assert.equal(offSandbox.browser.scripting, undefined, 'generic scripting.executeScript must not be exposed');
  const bad = await offCtx.chrome.runtime.sendMessage({ __mc: 'api', id: 999, api: 'tabs.executeScript', args: [] });
  assert.ok(bad && bad.error && /API not allowed/.test(bad.error), 'unknown API must be refused');

  // 5. The offscreen document answers the lifecycle ping.
  const ping = await swCtx.chrome.runtime.sendMessage({ __mc: 'ping' });
  assert.equal(ping && ping.__mc, 'pong', 'offscreen must answer the SW ping');

  // 6. Internal envelopes never trigger content-script business handlers.
  await swCtx.chrome.runtime.sendMessage({ __mc: 'dispatch', payload: { type: 'CAP_OVERLAY' } });
  assert.equal(contentSawBusiness, 0, 'content scripts must ignore __mc dispatch envelopes');

  // 8. Reused Obsidian Web Clipper clipboard handoff: stage 2 is directed to
  //    the active tab by the SW and its result returns to the offscreen caller.
  const clipboard = await offSandbox.browser.runtime.sendMessage({ action: 'copy-to-clipboard', text: '# note' });
  assert.equal(clipboard && clipboard.success, true, 'upstream clipboard fallback must round-trip');

  // 9. A tab opened before the extension was loaded has no content script.
  //    The SW injects it on demand and retries the failed message.
  const originalSend = swCtx.chrome.tabs.sendMessage;
  let sendCalls = 0;
  swCtx.chrome.tabs.sendMessage = async function () {
    sendCalls++;
    if (sendCalls === 1) throw new Error('Could not establish connection. Receiving end does not exist.');
    return { ok: true, retried: true };
  };
  const recovered = await offSandbox.browser.tabs.sendMessage(7, { type: 'CAP_PREPARE' }, { frameId: 0 });
  assert.equal(sendCalls, 2, 'missing content script must trigger one retry');
  assert.equal(recovered && recovered.retried, true, 'retried tabs.sendMessage must return its response');
  swCtx.chrome.tabs.sendMessage = originalSend;

  // 10. Chrome allows only 2 captureVisibleTab calls per second. The SW must
  //     serialize and space them instead of firing the inherited 70-120ms loop.
  const captureTimes = [];
  swCtx.chrome.tabs.captureVisibleTab = async function () {
    captureTimes.push(Date.now());
    return 'data:image/png;base64,AA';
  };
  const captureStart = Date.now();
  const shots = await Promise.all([
    offSandbox.browser.tabs.captureVisibleTab(1, { format: 'png' }),
    offSandbox.browser.tabs.captureVisibleTab(1, { format: 'png' }),
    offSandbox.browser.tabs.captureVisibleTab(1, { format: 'png' })
  ]);
  assert.equal(shots.length, 3, 'all three captures must resolve');
  assert.ok(Date.now() - captureStart >= 1000, 'three captures must take at least one second');
  for (let i = 1; i < captureTimes.length; i++) {
    assert.ok(captureTimes[i] - captureTimes[i - 1] >= 500,
      'consecutive captures must respect the 2-per-second quota');
  }

  // 11. A quota rejection is retried instead of being surfaced as a failed save.
  let captureAttempts = 0;
  swCtx.chrome.tabs.captureVisibleTab = async function () {
    captureAttempts++;
    if (captureAttempts === 1) {
      throw new Error('This request exceeds the MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND quota.');
    }
    return 'data:image/png;base64,BB';
  };
  const retried = await swSandbox.captureOnce([1, { format: 'png' }], 0);
  assert.equal(retried, 'data:image/png;base64,BB', 'quota rejection must be retried');
  assert.equal(captureAttempts, 2, 'quota rejection must trigger one retry');

  // 7. Synchronous i18n stays synchronous in the offscreen document.
  assert.equal(offSandbox.browser.i18n.getMessage('hello'), 'Hello', 'offscreen i18n must be synchronous');
  assert.equal(offSandbox.browser.i18n.getUILanguage(), 'en');

  console.log('MV3 bridge self-check OK: 13 protocol assertions passed.');
  process.exit(0);
})().catch((e) => {
  console.error('MV3 bridge self-check FAILED:', e);
  process.exit(1);
});
