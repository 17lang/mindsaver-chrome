/* Mind Clipper platform shim.
 *
 * The inherited Pagesaver code is written against Firefox's promise-based
 * `browser.*` namespace. Chrome MV3 exposes `chrome.*`, which is also
 * promise-based for the APIs used here, so an explicit alias table is enough.
 * No Proxy and no dynamic evaluation: every alias is auditable in this file.
 *
 * Load first in the service worker, content scripts, popup and options page.
 * The offscreen document installs its own bridge (offscreen only exposes
 * chrome.runtime), see lib/sw-api-bridge.js.
 */
(function (root) {
  'use strict';
  if (root.browser && root.browser.__mcShim) return;
  var c = root.chrome;
  if (!c) throw new Error('Mind Clipper: chrome.* is unavailable in this context');

  root.browser = {
    __mcShim: true,
    runtime: c.runtime,
    i18n: c.i18n,
    storage: c.storage,
    tabs: c.tabs,
    downloads: c.downloads,
    scripting: c.scripting,
    action: c.action,
    contextMenus: c.contextMenus,
    // Legacy Firefox names still referenced by the inherited code.
    browserAction: c.action,
    menus: c.contextMenus
  };
})(globalThis);
