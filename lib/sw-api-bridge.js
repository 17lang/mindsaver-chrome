/* Mind Clipper offscreen bridge.
 *
 * An offscreen document is a real DOM page, so the inherited background.js can
 * keep using document/canvas/Image/XMLHttpRequest/URL.createObjectURL and the
 * window.* third-party kernels. Chrome only exposes chrome.runtime to an
 * offscreen document, so every other extension API call is forwarded to the
 * service worker through a message-based, whitelisted proxy (sw.js).
 *
 * Message envelope: every internal message carries `__mc`. Business messages
 * from content scripts/popup are wrapped as `dispatch` with the original
 * message in `payload`, so other extension contexts ignore them by design.
 */
(function (root) {
  'use strict';

  var listeners = [];
  var queue = [];
  var booted = false;
  var seq = 0;

  function callApi(api, args) {
    return chrome.runtime.sendMessage({ __mc: 'api', id: ++seq, api: api, args: args || [] })
      .then(function (res) {
        if (!res || res.__mc !== 'api-result') throw new Error('Mind Clipper: empty API reply for ' + api);
        if (res.error) throw new Error(res.error);
        return res.value === undefined ? null : res.value;
      });
  }

  function apiFn(api) {
    return function () { return callApi(api, Array.prototype.slice.call(arguments)); };
  }

  // Native messaging ports cannot cross a message boundary. Stream the bytes to
  // the service worker in the same 192 KiB chunks the host protocol already uses.
  function nativeSave(blob, filename, target) {
    var CHUNK = 192 * 1024;
    var id = 'save-' + (++seq) + '-' + Date.now();
    return callApi('native.begin', [id, filename, target, blob.size]).then(function () {
      var offset = 0;
      function next() {
        if (offset >= blob.size) return callApi('native.commit', [id]);
        var end = Math.min(offset + CHUNK, blob.size);
        return blob.slice(offset, end).arrayBuffer().then(function (buf) {
          offset = end;
          return callApi('native.chunk', [id, buf]).then(next);
        });
      }
      return next();
    }).catch(function (e) {
      return callApi('native.abort', [id]).catch(function () {}).then(function () { throw e; });
    });
  }

  function dispatch(payload, sender) {
    return new Promise(function (resolve) {
      var settled = false;
      var asyncPending = false;
      function sendResponse(value) {
        if (settled) return;
        settled = true;
        resolve(value === undefined ? null : value);
      }
      for (var i = 0; i < listeners.length; i++) {
        var ret;
        try { ret = listeners[i](payload, sender, sendResponse); }
        catch (e) { console.error('[Mind Clipper] offscreen listener failed', e); }
        if (ret === true) asyncPending = true;
        if (settled) break;
      }
      if (settled) return;
      if (!asyncPending || !listeners.length) { resolve(null); return; }
      // Chrome keeps the response channel open for a listener that returned true.
      // Resolve anyway so a stalled handler never wedges the original sender.
      setTimeout(function () { if (!settled) { settled = true; resolve(null); } }, 300000);
    });
  }

  function run(job) {
    dispatch(job.payload, job.sender).then(function (value) {
      try { job.sendResponse(value); } catch (e) { /* sender went away */ }
    });
  }

  function markBooted() {
    booted = true;
    var jobs = queue.splice(0);
    for (var i = 0; i < jobs.length; i++) run(jobs[i]);
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = chrome.runtime.getURL(src);
      s.onload = resolve;
      s.onerror = function () { reject(new Error('Mind Clipper: cannot load ' + src)); };
      document.head.appendChild(s);
    });
  }

  function install(locale) {
    var dict = locale.dict || {};
    var uiLang = locale.uiLang || 'en';

    function getMessage(key, substitutions) {
      var entry = dict[key];
      if (!entry) return '';
      var text = String(entry.message || '');
      if (entry.placeholders) {
        Object.keys(entry.placeholders).forEach(function (name) {
          text = text.split('$' + name + '$').join(String(entry.placeholders[name].content || ''));
        });
      }
      if (substitutions != null) {
        var list = Array.isArray(substitutions) ? substitutions : [substitutions];
        list.forEach(function (value, i) { text = text.split('$' + (i + 1)).join(String(value)); });
      }
      return text;
    }

    var action = {
      setBadgeText: apiFn('action.setBadgeText'),
      setBadgeBackgroundColor: apiFn('action.setBadgeBackgroundColor')
    };

    root.browser = {
      __mcBridge: true,
      runtime: {
        onMessage: { addListener: function (fn) { listeners.push(fn); } },
        // Context menus and install hooks live in the service worker.
        onInstalled: { addListener: function () {} },
        sendMessage: apiFn('runtime.sendMessage'),
        getURL: function (p) { return chrome.runtime.getURL(p); },
        connectNative: function () { throw new Error(' Mind Clipper: native channel runs in the service worker'); }
      },
      i18n: {
        getMessage: getMessage,
        getUILanguage: function () { return uiLang; }
      },
      storage: {
        local: { get: apiFn('storage.local.get'), set: apiFn('storage.local.set') },
        onChanged: { addListener: function () {} }
      },
      tabs: {
        query: apiFn('tabs.query'),
        sendMessage: apiFn('tabs.sendMessage'),
        captureVisibleTab: apiFn('tabs.captureVisibleTab'),
        create: apiFn('tabs.create'),
        // Bundled-file / serialized-function replacements for the three
        // Firefox tabs.executeScript({ code }) call sites in background.js.
        injectCapture: apiFn('frame.injectCapture'),
        frameCommand: apiFn('frame.command'),
        frameProbe: apiFn('frame.probe')
      },
      downloads: { download: apiFn('downloads.download') },
      action: action,
      browserAction: action
      // `menus` is intentionally absent: background.js then skips its own menu
      // setup, and sw.js owns chrome.contextMenus instead.
    };

    root.PageSaverNative = {
      call: function (message) { return callApi('native.call', [message]); },
      save: nativeSave
    };
  }

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (!msg || !msg.__mc) return false;
    if (msg.__mc === 'ping') { sendResponse({ __mc: 'pong' }); return false; }
    if (msg.__mc === 'dispatch') {
      var job = { payload: msg.payload, sender: msg.sender, sendResponse: sendResponse };
      if (booted) run(job); else queue.push(job);
      return true;
    }
    return false;
  });

  root.MindClipperBridge = {
    install: install,
    markBooted: markBooted,
    loadScript: loadScript,
    loadLocale: async function () {
      var uiLang = (chrome.i18n && chrome.i18n.getUILanguage)
        ? chrome.i18n.getUILanguage()
        : (navigator.language || 'en');
      var normalized = String(uiLang).toLowerCase().replace('-', '_');
      var candidates = [normalized, normalized.split('_')[0], 'zh_cn', 'zh_tw', 'en'];
      var seen = {};
      for (var i = 0; i < candidates.length; i++) {
        var name = candidates[i];
        if (seen[name]) continue;
        seen[name] = true;
        var folder = name === 'zh_cn' ? 'zh_CN' : (name === 'zh_tw' ? 'zh_TW' : (name === 'en' ? 'en' : null));
        if (!folder) continue;
        try {
          var res = await fetch(chrome.runtime.getURL('_locales/' + folder + '/messages.json'));
          if (res.ok) return { dict: await res.json(), uiLang: uiLang, folder: folder };
        } catch (e) { /* try the next fallback */ }
      }
      return { dict: {}, uiLang: uiLang, folder: 'en' };
    }
  };
})(globalThis);
