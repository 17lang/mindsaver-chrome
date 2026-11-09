/* Boot sequence of the offscreen document.
 *
 * Scripts are injected one at a time, in the same order the inherited Firefox
 * manifest used for background.scripts. Waiting for the locale dictionary
 * first keeps PageSaverI18n.t() synchronous, as the inherited code expects.
 */
(function () {
  'use strict';

  var ORDER = [
    'i18n.js',
    'options/filename-rules.js',
    'lib/pdf-lib.min.js',
    'lib/fontkit.umd.min.js',
    'lib/html-to-image.iife.js',
    'options/destinations.js',
    'options/obsidian-save.js',
    'background.js'
  ];

  (async function boot() {
    var bridge = globalThis.MindClipperBridge;
    var locale = await bridge.loadLocale();
    bridge.install(locale);
    for (var i = 0; i < ORDER.length; i++) await bridge.loadScript(ORDER[i]);
    bridge.markBooted();
    try { await chrome.runtime.sendMessage({ __mc: 'ready' }); } catch (e) { /* SW may be dormant */ }
  })().catch(function (e) {
    console.error('[Mind Clipper] offscreen boot failed', e);
    try { chrome.runtime.sendMessage({ __mc: 'boot-error', error: String(e && e.message || e) }); } catch (_) {}
  });
})();
