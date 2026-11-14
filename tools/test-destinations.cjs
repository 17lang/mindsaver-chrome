const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../options/destinations.js'), 'utf8'), context);
const D = context.PageSaverDestinations;

test('unconfigured formats keep browser download behavior', () => {
  const s = D.defaults();
  for (const kind of ['pdf', 'html', 'markdown']) assert.equal(D.target(s, kind), null);
  assert.equal(D.markdownReady(s), false);
});

test('pdf and html always save to the browser download folder', () => {
  // Any non-default mode for pdf/html is normalized back to the default download.
  const s = D.normalize({ pdf: { mode: 'obsidian' }, html: { mode: 'markdown' } });
  assert.equal(s.pdf.mode, 'default');
  assert.equal(s.html.mode, 'default');
  assert.equal(D.target(s, 'pdf'), null);
  assert.equal(D.target(s, 'html'), null);
});

test('markdown can target the browser download folder or an Obsidian vault', () => {
  // default download folder: target is null, not ready for Obsidian
  const dl = D.normalize({ markdown: { mode: 'default', relativePath: 'Inbox' } });
  assert.equal(D.target(dl, 'markdown'), null);
  assert.equal(D.markdownReady(dl), false);

  // Obsidian: target carries vault name + relative path, ready when path is relative
  const ob = D.normalize({ markdown: { mode: 'obsidian', vaultName: 'Notes', relativePath: 'Inbox/文章' } });
  const t = D.target(ob, 'markdown');
  assert.equal(t.mode, 'obsidian');
  assert.equal(t.vaultName, 'Notes');
  assert.equal(t.relativePath, 'Inbox/文章');
  assert.equal(D.markdownReady(ob), true);
});

test('Obsidian target requires a legal relative path; vault name is optional', () => {
  // a relative path alone is ready even without a named vault (uses the open vault)
  const noVault = D.normalize({ markdown: { mode: 'obsidian', relativePath: 'Inbox' } });
  assert.equal(D.markdownReady(noVault), true);
  assert.equal(D.target(noVault, 'markdown').vaultName, '');

  // illegal relative paths are rejected
  for (const bad of ['/abs', 'C:\\x', '../escape', 'a/../b', '.', '..', '/tmp/\x00bad']) {
    const s = D.normalize({ markdown: { mode: 'obsidian', relativePath: bad } });
    assert.throws(() => D.target(s, 'markdown'));
  }
  // a control character in the vault name is rejected
  const ctrl = D.normalize({ markdown: { mode: 'obsidian', vaultName: 'a\x01b', relativePath: 'Inbox' } });
  assert.throws(() => D.target(ctrl, 'markdown'));
});

test('cross-platform relative-path syntax and traversal rejected', () => {
  for (const p of ['relative', 'Inbox/文章', 'Clippings/中文']) assert.equal(D.relative(p), true);
  for (const p of ['../bad', 'a/../b', '/bad', 'C:\\bad', 'a\\..\\b', '/tmp/\x00bad']) assert.equal(D.relative(p), false);
});

test('unknown or legacy modes migrate to the browser download default', () => {
  const s = D.normalize({ markdown: { mode: 'absolute', path: '/tmp/x' }, pdf: { mode: 'vault' } });
  assert.equal(s.markdown.mode, 'default');
  assert.equal(s.pdf.mode, 'default');
  assert.equal(D.target(s, 'markdown'), null);
});
