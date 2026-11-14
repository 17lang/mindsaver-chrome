const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function context(locale) {
  const messages = JSON.parse(fs.readFileSync(path.join(root, '_locales', locale, 'messages.json')));
  const calls = { urls: [], clipboard: [] };
  const store = {};
  const ctx = vm.createContext({ browser: {
    i18n: { getMessage: key => messages[key]?.message || '' },
    tabs: { create: async args => calls.urls.push(args.url) },
    storage: { local: { set: async obj => Object.assign(store, obj), get: async () => store } },
    runtime: { getURL: p => 'chrome-extension://mock/' + String(p).replace(/^\//, '') }
  }, navigator: { clipboard: { writeText: async value => calls.clipboard.push(value) } } });
  for (const name of ['i18n.js','options/destinations.js','options/obsidian-save.js']) vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),ctx);
  return { ctx, calls, messages, store };
}
test('all catalogs cover the same messages; translated helper errors and language fallback', () => {
  const en = context('en'), cn = context('zh_CN'), tw = context('zh_TW');
  assert.deepEqual(Object.keys(en.messages).sort(),Object.keys(cn.messages).sort());
  assert.deepEqual(Object.keys(en.messages).sort(),Object.keys(tw.messages).sort());
  assert.equal(en.ctx.PageSaverI18n.source('设置'),'Settings');
  assert.equal(cn.ctx.PageSaverI18n.source('设置'),'设置');
  assert.equal(en.ctx.PageSaverI18n.source('文件夹不存在或无法访问，请检查路径。'),'Folder missing or inaccessible. Check the path.');
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));
  assert.equal(manifest.default_locale,'en');
});
test('direct Obsidian handoff stores the note and opens the bridge page (inline content for short notes)',async()=>{
  const {ctx,calls,store}=context('en');
  const body='# Article\n\n中文🙂';
  const target={mode:'obsidian',vaultName:'My vault & 中文',relativePath:'Inbox/文章'};
  const result=await ctx.PageSaverObsidian.save({text:async()=>body},'A & B.md',target);
  // save() does not write the clipboard itself; the visible bridge page does
  assert.deepEqual(calls.clipboard,[]);
  // it opens the visible bridge page, not an obsidian: URI directly
  assert.equal(calls.urls.length,1);
  assert.ok(calls.urls[0].startsWith('chrome-extension://mock/options/obsidian-bridge.html'),'opens the bridge page');
  // the handoff object is stored so the bridge page can finish the jump
  const KEY=ctx.PageSaverObsidian.HANDOFF_KEY;
  assert.equal(store[KEY].notePath,'Inbox/文章/A & B');
  assert.equal(store[KEY].vault,'My vault & 中文');
  assert.equal(store[KEY].mode,'content');
  assert.equal(store[KEY].clipboardText,'');
  // result
  assert.equal(result.handedOff,true);
  assert.equal(result.notePath,'Inbox/文章/A & B');
});
test('long notes fall back to the clipboard handoff through the bridge page',async()=>{
  const {ctx,calls,store}=context('en');
  const target={mode:'obsidian',vaultName:'Notes',relativePath:'Inbox'};
  const longBody='# Long note\n'.repeat(20000);  // well over MAX_URI_LENGTH (60000)
  const result=await ctx.PageSaverObsidian.save({text:async()=>longBody},'long.md',target);
  const KEY=ctx.PageSaverObsidian.HANDOFF_KEY;
  assert.equal(store[KEY].mode,'clipboard');
  assert.equal(store[KEY].clipboardText,longBody);
  assert.equal(store[KEY].notePath,'Inbox/long');
  // still opens exactly one bridge page
  assert.equal(calls.urls.length,1);
  assert.ok(calls.urls[0].startsWith('chrome-extension://mock/options/obsidian-bridge.html'));
  assert.equal(result.handedOff,true);
});
test('Obsidian target validation: relative path required, vault name optional',()=>{
  const {ctx}=context('en'),D=ctx.PageSaverDestinations;
  // obsidian with a relative path is ready even without a named vault
  let s=D.normalize({markdown:{mode:'obsidian',relativePath:'Inbox'}});
  assert.equal(D.target(s,'markdown').mode,'obsidian');assert.equal(D.markdownReady(s),true);
  s.markdown.vaultName='Notes';assert.equal(D.markdownReady(s),true);
  // illegal relative path throws
  s.markdown.relativePath='../outside';assert.throws(()=>D.target(s,'markdown'));
});
