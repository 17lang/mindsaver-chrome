/* Mind Clipper settings, v5.
 * - Two destinations only: browser downloads and an Obsidian vault.
 * - Auto-save: v4 showed "尚未保存" after every edit and users reasonably
 *   assumed their vault settings were active. Now every change is persisted.
 */
(async function () {
  'use strict';
  const D = PageSaverDestinations;
  const $ = id => document.getElementById(id);
  const form = $('save-settings-form');
  const status = $('settings-status');
  let persisted = await D.load();
  let saveTimer = null;
  let busy = false;

  function readForm() {
    return D.normalize({
      naming: { enabled: $('normalize-filenames').checked, datePosition: $('filename-date-position').value },
      pdf: { mode: 'default', path: '' },
      html: { mode: 'default', path: '' },
      markdown: {
        mode: $('markdown-mode').value,
        path: '',
        vault: '',
        vaultName: $('obsidian-vault-name').value,
        relativePath: $('template-path-name').value
      }
    });
  }

  function previewName(extension, naming) {
    return naming.enabled
      ? PageSaverNaming.buildFileName('文章标题', '', extension, naming)
      : '文章标题.' + extension;
  }

  function display() {
    const draft = readForm();
    const obsidian = draft.markdown.mode === 'obsidian';
    $('naming-date-options').hidden = !draft.naming.enabled;
    $('markdown-obsidian-fields').hidden = !obsidian;
    $('markdown-default-hint').hidden = obsidian;
    $('filename-preview').textContent = previewName('pdf', draft.naming);

    if (obsidian) {
      const folder = String(draft.markdown.relativePath || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
      const note = previewName('md', draft.naming);
      $('note-path-preview').textContent =
        (draft.markdown.vaultName || '当前打开的仓库') + ' / ' + (folder ? folder + '/' : '') + note;
    }
  }

  function populate(settings) {
    $('normalize-filenames').checked = settings.naming.enabled;
    $('filename-date-position').value = settings.naming.datePosition;
    $('markdown-mode').value = settings.markdown.mode;
    $('obsidian-vault-name').value = settings.markdown.vaultName;
    $('template-path-name').value = settings.markdown.relativePath;
    status.textContent = '修改后会自动保存';
    display();
  }

  async function save() {
    if (busy) return;
    busy = true;
    clearTimeout(saveTimer);
    try {
      const draft = readForm();
      D.target(draft, 'markdown'); // throws on an invalid vault-relative folder
      await browser.storage.local.set({ [D.KEY]: draft });
      persisted = draft;
      status.textContent = '已自动保存';
    } catch (e) {
      status.textContent = '保存失败：' + (e && e.message ? e.message : String(e));
    } finally {
      busy = false;
      display();
    }
  }

  function scheduleSave() {
    status.textContent = '正在保存…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 250);
  }

  populate(persisted);
  form.addEventListener('input', () => { display(); scheduleSave(); });
  form.addEventListener('change', () => { display(); scheduleSave(); });
  form.addEventListener('submit', event => { event.preventDefault(); save(); });

  $('check-vault').addEventListener('click', () => {
    const name = $('obsidian-vault-name').value.trim();
    if (!name) {
      status.textContent = '请先填写仓库名称；留空表示使用当前打开的仓库。';
      return;
    }
    // A plain open (no note creation) is a safe way to verify the exact vault
    // name. Chrome asks for permission to launch the external protocol once.
    window.location.href = 'obsidian://open?vault=' + encodeURIComponent(name);
  });

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[D.KEY] || busy) return;
    const next = D.normalize(changes[D.KEY].newValue);
    if (JSON.stringify(next) === JSON.stringify(persisted)) return;
    persisted = next;
    populate(next);
  });
})();
