/* Mind Clipper save destinations.
 * v5: only two destinations remain — the browser download folder and an
 * Obsidian vault reached through the obsidian:// URI. No native helper, no
 * absolute folders, no vault enumeration. Old stored values are migrated to
 * 'default' instead of failing validation. */
(function (root) {
  'use strict';
  const KEY = 'pagesaverDestinations';

  function defaults() {
    return {
      pdf: { mode: 'default', path: '' },
      html: { mode: 'default', path: '' },
      markdown: { mode: 'default', path: '', vault: '', vaultName: '', relativePath: '' },
      naming: { enabled: true, datePosition: 'before' }
    };
  }

  function normalize(input) {
    const out = defaults();
    for (const kind of ['pdf', 'html', 'markdown']) {
      const v = input && input[kind];
      if (!v) continue;
      const allowed = kind === 'markdown' ? ['default', 'obsidian'] : ['default'];
      out[kind].mode = allowed.includes(v.mode) ? v.mode : 'default';
      for (const field of Object.keys(out[kind])) {
        if (field !== 'mode') out[kind][field] = String(v[field] || '').trim();
      }
    }
    const naming = input && input.naming;
    out.naming.enabled = !naming || naming.enabled !== false;
    out.naming.datePosition = naming && naming.datePosition === 'after' ? 'after' : 'before';
    return out;
  }

  function relative(path) {
    const value = String(path || '');
    return !/^[\\/]|^[A-Za-z]:|[\x00-\x1f]/.test(value) &&
      !value.split(/[\\/]/).some(part => part === '..' || part === '.');
  }

  function markdownReady(settings) {
    const m = settings.markdown;
    return m.mode === 'obsidian' ? relative(m.relativePath) : false;
  }

  function target(settings, kind) {
    const value = settings[kind];
    if (!value) throw new Error('不支持这种文件。');
    if (value.mode === 'default') return null;
    if (value.mode === 'markdown') return target(settings, 'markdown'); // legacy follow mode
    if (value.mode === 'obsidian') {
      if (!relative(value.relativePath) || /[\x00-\x1f]/.test(value.vaultName)) {
        throw new Error('仓库内文件夹不合法：请填写仓库内的相对路径，不要用 .. 或绝对路径。');
      }
      return { mode: 'obsidian', vaultName: value.vaultName, relativePath: value.relativePath };
    }
    return null;
  }

  async function load() {
    const data = await browser.storage.local.get(KEY);
    return normalize(data[KEY]);
  }

  root.PageSaverDestinations = { KEY, defaults, normalize, relative, markdownReady, target, load };
})(globalThis);
