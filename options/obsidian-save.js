/* Hand a Markdown note to Obsidian through its obsidian:// URI.
 *
 * v5 changes vs v4:
 *  - Content is passed inline with &content= (the same mechanism the original
 *    Obsidian Clipper uses), so ordinary articles need no clipboard write at
 *    all. Very long articles fall back to &clipboard; the visible hand-off page
 *    writes the clipboard in a real extension document before opening Obsidian.
 *  - Instead of silently calling tabs.create('obsidian://...') from the service
 *    worker, a visible extension page performs the external-protocol jump and
 *    shows the vault / note path, so a failed handoff is diagnosable.
 * No native helper, no local REST API, no vault enumeration is needed.
 */
(function (root) {
  'use strict';

  const HANDOFF_KEY = 'mcObsidianHandoff';
  const MAX_URI_LENGTH = 60000;

  function notePath(filename, relativePath) {
    const folder = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const stem = String(filename).replace(/\.md$/i, '');
    return folder ? folder + '/' + stem : stem;
  }

  function makeUrl(path, vaultName, text, useClipboard) {
    let url = 'obsidian://new?file=' + encodeURIComponent(path);
    if (vaultName) url += '&vault=' + encodeURIComponent(vaultName);
    // Plain flag (no value) is how Obsidian reads the note body from clipboard.
    return url + (useClipboard ? '&clipboard' : '&content=' + encodeURIComponent(text || ''));
  }

  async function save(blob, filename, target) {
    const text = await blob.text();
    const path = notePath(filename, target.relativePath);
    const inline = makeUrl(path, target.vaultName, text, false);
    const needsClipboard = inline.length > MAX_URI_LENGTH;
    const uri = needsClipboard ? makeUrl(path, target.vaultName, text, true) : inline;

    // The clipboard is written by obsidian-bridge.js, in a visible extension
    // page with clipboardWrite permission. If that write fails, the page stops
    // and reports it instead of creating an empty note.
    await browser.storage.local.set({
      [HANDOFF_KEY]: {
        uri: uri,
        notePath: path,
        vault: target.vaultName || '当前打开的仓库',
        mode: needsClipboard ? 'clipboard' : 'content',
        clipboardText: needsClipboard ? text : '',
        at: Date.now()
      }
    });
    await browser.tabs.create({ url: browser.runtime.getURL('options/obsidian-bridge.html') });

    // External app dispatch is not a receipt that Obsidian wrote the file.
    return {
      filename: filename,
      handedOff: true,
      notePath: path,
      vault: target.vaultName,
      detail: '已交给 Obsidian：' + path + '。请到 Obsidian 中确认笔记。'
    };
  }

  root.PageSaverObsidian = { HANDOFF_KEY, notePath, makeUrl, save };
})(globalThis);
