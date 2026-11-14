/* Adapted from Obsidian Web Clipper src/managers/settings-section-ui.ts.
 * MIT, Copyright (c) 2024 Obsidian. Source revision in UPSTREAM.md.
 * v7: PDF/HTML have no configurable destination, so only the two sections
 * with real options remain. An old #pdf / #html hash falls back to Markdown. */
(function () {
  'use strict';
  const allowed = ['naming', 'markdown'];
  function showSettingsSection(section) {
    if (!allowed.includes(section)) section = 'markdown';
    document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('#sidebar li[data-section]').forEach(item => {
      const active = item.dataset.section === section;
      item.classList.toggle('active', active);
      item.querySelector('button').setAttribute('aria-current', active ? 'page' : 'false');
    });
    document.getElementById(`${section}-section`).classList.add('active');
    history.replaceState(null, '', '#' + section);
  }
  document.getElementById('sidebar').addEventListener('click', event => {
    const li = event.target.closest('li[data-section]');
    if (li) showSettingsSection(li.dataset.section);
  });
  window.addEventListener('hashchange', () => showSettingsSection(location.hash.slice(1)));
  showSettingsSection(location.hash.slice(1));
})();
