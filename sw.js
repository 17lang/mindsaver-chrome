/* Mind Clipper service worker (Manifest V3).
 *
 * This file owns every Chrome extension API call. The inherited background.js
 * lives in the offscreen document (it needs DOM/canvas/XHR/blob URLs), and all
 * of its browser.* calls are proxied here through lib/sw-api-bridge.js.
 *
 * All listeners are registered synchronously at top level, as MV3 requires.
 */
importScripts(
  'lib/browser-shim.js',
  'i18n.js',
  'options/native-save.js'
);

var OFFSCREEN_URL = 'offscreen.html';
var OFFSCREEN_REASONS = ['BLOBS', 'DOM_PARSER', 'IFRAME_SCRIPTING', 'CLIPBOARD', 'DOM_SCRAPING'];
var OFFSCREEN_JUSTIFICATION =
  'Render long-page screenshots, compose single-page PDFs, create blob URLs for downloads, ' +
  'and hold SingleFile lazy-load timers, none of which are available in a service worker.';

var creatingOffscreen = null;
var readyResolve = null;
var readyPromise = newPromise();
var nativeSessions = new Map();

function newPromise() {
  return new Promise(function (resolve) { readyResolve = resolve; });
}

/* ---------------------------------------------------------------- offscreen */

async function hasOffscreenDocument() {
  var url = chrome.runtime.getURL(OFFSCREEN_URL);
  if (chrome.runtime.getContexts) {
    var contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [url]
    });
    return contexts.length > 0;
  }
  // Chrome 109-115: no getContexts, fall back to the worker's client list.
  var matched = await clients.matchAll();
  return matched.some(function (client) { return client.url === url; });
}

async function pingOffscreen() {
  try {
    var reply = await chrome.runtime.sendMessage({ __mc: 'ping' });
    return !!reply && reply.__mc === 'pong';
  } catch (e) {
    return false;
  }
}

async function createOffscreen() {
  if (await hasOffscreenDocument()) {
    if (await pingOffscreen()) return;
    try { await chrome.offscreen.closeDocument(); } catch (e) { /* already gone */ }
    readyPromise = newPromise();
  }
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: OFFSCREEN_REASONS,
    justification: OFFSCREEN_JUSTIFICATION
  });
  await Promise.race([
    readyPromise,
    new Promise(function (_, reject) {
      setTimeout(function () { reject(new Error('Mind Clipper: offscreen document did not become ready')); }, 20000);
    })
  ]);
}

function ensureOffscreen() {
  if (creatingOffscreen) return creatingOffscreen;
  creatingOffscreen = createOffscreen().finally(function () { creatingOffscreen = null; });
  return creatingOffscreen;
}

/* ------------------------------------------------------------ context menus */

function setupMenus() {
  try {
    chrome.contextMenus.removeAll(function () {
      chrome.contextMenus.create({ id: 'mindclipper', title: 'Mind Clipper', contexts: ['page'] });
      chrome.contextMenus.create({
        id: 'mindclipper-pdf', parentId: 'mindclipper',
        title: PageSaverI18n.t('ui_1f993235b6a4'), contexts: ['page']
      });
      chrome.contextMenus.create({
        id: 'mindclipper-html', parentId: 'mindclipper',
        title: PageSaverI18n.t('ui_1736a487f2d5'), contexts: ['page']
      });
    });
  } catch (e) {
    console.warn('[Mind Clipper] context menu setup failed', e);
  }
}

chrome.runtime.onInstalled.addListener(setupMenus);
chrome.runtime.onStartup.addListener(setupMenus);
chrome.contextMenus.onClicked.addListener(function (info, tab) {
  if (!tab || tab.id == null) return;
  var type = info.menuItemId === 'mindclipper-pdf' ? 'PDF_RUN'
    : (info.menuItemId === 'mindclipper-html' ? 'HTML_RUN' : null);
  if (!type) return;
  chrome.tabs.sendMessage(tab.id, { type: type }).catch(function () {});
});

/* ------------------------------------------------------------- frame probes */
/* These functions are serialized by chrome.scripting.executeScript. They must
 * not close over any outer variable; arguments are passed explicitly. */

function frameCommand(url, method, value) {
  if (location.href !== url || !window.joppNativeCapture) return null;
  return window.joppNativeCapture[method](value === undefined ? null : value);
}

function frameProbe(url) {
  return location.href === url
    ? { height: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight), viewport: innerHeight }
    : null;
}

function injectionResults(results) {
  return (results || []).map(function (r) { return r && r.result; });
}

/* -------------------------------------------------------------- API surface */
/* Whitelist: the offscreen document can only reach these named operations. */

/* Content scripts declared in the manifest are not injected into tabs that were
 * already open when the unpacked extension was loaded, and Chrome can default
 * site access to "on click". Instead of failing with a raw
 * "Receiving end does not exist", inject the same bundled files on demand. */
var CONTENT_SCRIPT_FILES = [
  'lib/browser-shim.js', 'i18n.js', 'options/filename-rules.js',
  'content/page-metadata.js', 'content/00-boot.js', 'lib/html-to-image.iife.js',
  'content/overlay.js', 'content/serialize.js', 'content/pdfclient.js',
  'content/textlayer.js', 'content/capture.js', 'content/picker.js',
  'lib/single-file.js', 'lib/defuddle-full.js', 'content/htmlsave.js'
];
var injectedTabs = new Set();

async function ensureContentScripts(tabId) {
  if (injectedTabs.has(tabId)) return true;
  var tab;
  try { tab = await chrome.tabs.get(tabId); }
  catch (e) { return false; }
  // chrome://, edge://, about:, view-source:, the Web Store and other
  // restricted schemes can never host content scripts.
  if (!tab || !/^(https?|file):/i.test(tab.url || '')) return false;
  // Do not re-inject into a tab that already has the inherited scripts.
  var probe = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: function () { return !!window.joppNativeCapture; },
    world: 'ISOLATED'
  });
  if (probe && probe[0] && probe[0].result) {
    injectedTabs.add(tabId);
    return true;
  }
  await chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: CONTENT_SCRIPT_FILES,
    world: 'ISOLATED'
  });
  injectedTabs.add(tabId);
  return true;
}

/* Chrome 92+ limits captureVisibleTab to
 * MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND (2). Firefox allowed the inherited
 * PDF stitcher to capture every 70-120ms; on Chrome that fails a long page
 * with "This request exceeds the MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND
 * quota." Serialize every capture and space them just under the limit; retry
 * a quota rejection as a safety net (e.g. after a worker restart). */
var CAPTURE_RATE = (chrome.tabs && chrome.tabs.MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND) || 2;
var CAPTURE_INTERVAL_MS = Math.ceil(1000 / CAPTURE_RATE) + 80;
var lastCaptureAt = 0;
var captureQueue = Promise.resolve();

function sleepMs(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

async function captureOnce(args, attempt) {
  var wait = CAPTURE_INTERVAL_MS - (Date.now() - lastCaptureAt);
  if (wait > 0) await sleepMs(wait);
  try {
    var dataUrl = await chrome.tabs.captureVisibleTab.apply(chrome.tabs, args);
    lastCaptureAt = Date.now();
    return dataUrl;
  } catch (e) {
    lastCaptureAt = Date.now();
    var message = String(e && e.message || e);
    if (/MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND|quota/i.test(message) && attempt < 5) {
      await sleepMs(CAPTURE_INTERVAL_MS * (attempt + 1));
      return captureOnce(args, attempt + 1);
    }
    throw e;
  }
}

function queuedCapture(args) {
  var job = captureQueue.then(function () { return captureOnce(args, 0); });
  captureQueue = job.catch(function () {});
  return job;
}

function isMissingReceiver(error) {
  return /Receiving end does not exist|Could not establish connection/i.test(String(error && error.message || error));
}

var API = {
  'runtime.sendMessage': function (message) {
    if (message && message.action === 'copy-to-clipboard') {
      // Same message contract as the upstream Obsidian Web Clipper, but target
      // the tab being saved: a broadcast would let every open page overwrite
      // the clipboard. The page-side handler lives in content/00-boot.js.
      return (async function () {
        var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs || !tabs.length) return { success: false };
        try { return await chrome.tabs.sendMessage(tabs[0].id, message); }
        catch (e) { return { success: false }; }
      })();
    }
    // A broadcast with no receiver rejects in Chrome; the caller only needs a
    // best-effort notification, never a false failure.
    return chrome.runtime.sendMessage(message).catch(function () { return null; });
  },
  'tabs.query': function () { return chrome.tabs.query.apply(chrome.tabs, arguments); },
  'tabs.sendMessage': async function () {
    var args = Array.prototype.slice.call(arguments);
    try {
      return await chrome.tabs.sendMessage.apply(chrome.tabs, args);
    } catch (e) {
      if (!isMissingReceiver(e)) throw e;
      if (!(await ensureContentScripts(args[0]))) {
        throw new Error(PageSaverI18n.t('ui_fc062cfa696c'));
      }
      return chrome.tabs.sendMessage.apply(chrome.tabs, args);
    }
  },
  'tabs.captureVisibleTab': function () {
    return queuedCapture(Array.prototype.slice.call(arguments));
  },
  'tabs.create': function () { return chrome.tabs.create.apply(chrome.tabs, arguments); },
  'downloads.download': function () { return chrome.downloads.download.apply(chrome.downloads, arguments); },
  'action.setBadgeText': function () { return chrome.action.setBadgeText.apply(chrome.action, arguments); },
  'action.setBadgeBackgroundColor': function () { return chrome.action.setBadgeBackgroundColor.apply(chrome.action, arguments); },
  'storage.local.get': function () { return chrome.storage.local.get.apply(chrome.storage.local, arguments); },
  'storage.local.set': function () { return chrome.storage.local.set.apply(chrome.storage.local, arguments); },

  // A bundled file replaces Firefox's executeScript({ code: '...' }); MV3 forbids
  // arbitrary code strings. The inherited content/capture.js self-guards against
  // double injection via window.joppNativeCapture.
  'frame.injectCapture': function (tabId) {
    return chrome.scripting.executeScript({
      target: { tabId: tabId, allFrames: true },
      files: ['lib/browser-shim.js', 'i18n.js', 'content/capture.js'],
      world: 'ISOLATED'
    }).then(injectionResults);
  },
  'frame.command': function (tabId, url, method, value) {
    return chrome.scripting.executeScript({
      target: { tabId: tabId, allFrames: true },
      func: frameCommand,
      args: [url, method, value],
      world: 'ISOLATED'
    }).then(injectionResults);
  },
  'frame.probe': function (tabId, url) {
    return chrome.scripting.executeScript({
      target: { tabId: tabId, allFrames: true },
      func: frameProbe,
      args: [url],
      world: 'ISOLATED'
    }).then(injectionResults);
  },

  // Native messaging ports cannot cross a message boundary; bytes are streamed
  // in 192 KiB chunks and the real port is opened here in the service worker
  // (connectNative also keeps this worker alive for the duration of the save).
  'native.call': function (message) { return PageSaverNative.call(message); },
  'native.begin': function (id, filename, target, size) {
    nativeSessions.set(id, { chunks: [], filename: filename, target: target, size: size });
    return true;
  },
  'native.chunk': function (id, buffer) {
    var session = nativeSessions.get(id);
    if (!session) throw new Error('Mind Clipper: native save session expired');
    session.chunks.push(new Uint8Array(buffer));
    return true;
  },
  'native.commit': function (id) {
    var session = nativeSessions.get(id);
    if (!session) throw new Error('Mind Clipper: native save session expired');
    nativeSessions.delete(id);
    return PageSaverNative.save(new Blob(session.chunks), session.filename, session.target);
  },
  'native.abort': function (id) { nativeSessions.delete(id); return true; }
};

function handleApi(name, args) {
  var fn = Object.prototype.hasOwnProperty.call(API, name) ? API[name] : null;
  if (!fn) return Promise.reject(new Error('Mind Clipper: API not allowed: ' + name));
  return Promise.resolve().then(function () { return fn.apply(null, args || []); });
}

/* ------------------------------------------------------------- message pump */

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (!msg) return false;

  if (msg.__mc === 'ready') {
    if (readyResolve) readyResolve();
    sendResponse({ ok: true });
    return false;
  }
  if (msg.__mc === 'boot-error') {
    console.error('[Mind Clipper] offscreen boot error:', msg.error);
    return false;
  }
  if (msg.__mc === 'api') {
    handleApi(msg.api, msg.args).then(function (value) {
      sendResponse({ __mc: 'api-result', id: msg.id, value: value === undefined ? null : value });
    }).catch(function (e) {
      sendResponse({ __mc: 'api-result', id: msg.id, error: String(e && e.message || e) });
    });
    return true;
  }
  // ping / dispatch / pong / api-result belong to the offscreen document.
  if (msg.__mc) return false;

  // Business messages from popup / options / content scripts are forwarded to
  // the offscreen document. The payload is nested so other extension contexts
  // cannot accidentally match the original `type` or `method` fields.
  (function () {
    var safeSender = {
      id: sender.id,
      url: sender.url,
      origin: sender.origin,
      frameId: sender.frameId,
      tab: sender.tab ? { id: sender.tab.id, url: sender.tab.url } : null
    };
    ensureOffscreen()
      .then(function () {
        return chrome.runtime.sendMessage({ __mc: 'dispatch', payload: msg, sender: safeSender });
      })
      .then(function (value) { sendResponse(value === undefined ? null : value); })
      .catch(function (e) { sendResponse({ ok: false, error: String(e && e.message || e) }); });
  })();
  return true;
});
