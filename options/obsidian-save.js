/* Adapted from Obsidian Web Clipper, MIT.
 * src/utils/obsidian-note-creator.ts @ 6d56d618b00bd970aa738d6a7a61edee27783e81
 * Retains new-note URI, relative folder, vault, and clipboard transfer only.
 *
 * The clipboard stage reuses the upstream Chrome extension's
 * src/utils/clipboard-utils.ts strategy verbatim (two stages):
 *   1) navigator.clipboard.writeText
 *   2) runtime message 'copy-to-clipboard' -> page-side fallback, which reuses
 *      the upstream src/content.ts "copy-text-to-clipboard" branch
 *      (content/00-boot.js). No project-specific clipboard writer here.
 * Upstream falls back to putting the article in a &content= URI; this product
 * deliberately does not (see the failure policy in save()).
 */
(function (root) {
  'use strict';
  function makeUrl(filename, target) {
    let path = target.relativePath.replace(/\\/g, '/');
    if (path && !path.endsWith('/')) path += '/';
    let url = 'obsidian://new?file=' + encodeURIComponent(path + filename.replace(/\.md$/i, ''));
    if (target.vaultName) url += '&vault=' + encodeURIComponent(target.vaultName);
    // No overwrite or append flag: keep Obsidian's normal new-note behavior.
    return url + '&clipboard';
  }

  // Upstream src/utils/clipboard-utils.ts, JavaScript equivalent.
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // Fall through to the content-script fallback, as upstream does.
    }
    try {
      const response = await browser.runtime.sendMessage({
        action: 'copy-to-clipboard',
        text: text
      });
      return !!(response && response.success);
    } catch (e) {
      return false;
    }
  }

  async function save(blob, filename, target) {
    const ok = await copyToClipboard(await blob.text());
    // Product boundary: a failed clipboard write must not create an empty note
    // and must not be reported as a completed save.
    if (!ok) throw new Error(PageSaverI18n.t('ui_cb511d888d6f'));
    await browser.tabs.create({ url: makeUrl(filename, target) });
    // External app dispatch is not a receipt that Obsidian wrote the file.
    return { filename, handedOff: true };
  }
  async function nativeTarget(target) {
    if (target.mode !== 'obsidian') return target;
    if (!target.vaultName) throw new Error(PageSaverI18n.t('ui_648e42318c16'));
    const { vaults } = await PageSaverNative.call({ action: 'vaults' });
    const matches = vaults.filter(v => v.name === target.vaultName);
    if (matches.length > 1) throw new Error(PageSaverI18n.t('ui_ecff1a1ff276'));
    if (!matches.length) throw new Error(PageSaverI18n.source('找不到这个仓库，请重新选择。'));
    return { mode: 'vault', vault: matches[0].id, relativePath: target.relativePath };
  }
  root.PageSaverObsidian = { makeUrl, save, nativeTarget };
})(globalThis);
