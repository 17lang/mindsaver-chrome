/* Real-Chrome verification for the picker arrow-key fix.
 *
 * Requires a running Chrome with --remote-debugging-port=9222 (e.g. Chrome for
 * Testing loaded with an isolated profile). Run: node tools/test-picker-chrome.cjs
 * This is a real-browser interaction check, not part of the offline static suite.
 *
 * Loads the actual content/picker.js into a clean about:blank target via CDP,
 * starts node/area modes through the registered runtime listener, dispatches
 * real DOM keyboard/mouse events and reads the rendered selection boxes.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'content/picker.js'), 'utf8');

function getJson(p) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: 9222, path: p }, (res) => {
      let s = ''; res.on('data', (c) => s += c);
      res.on('end', () => { try { resolve(JSON.parse(s)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}
class CDP {
  constructor(url) {
    this.ws = new WebSocket(url); this.id = 0; this.pending = new Map();
    this.ready = new Promise((r, j) => { this.ws.onopen = r; this.ws.onerror = j; });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const p = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
      }
    };
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error('timeout ' + method)); } }, 30000);
    });
  }
  async evaluate(expression) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || ''));
    return r.result && r.result.value;
  }
  close() { try { this.ws.close(); } catch (e) {} }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const version = await getJson('/json/version');
  const browser = new CDP(version.webSocketDebuggerUrl); await browser.ready;
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
  let target;
  for (let i = 0; i < 30; i++) {
    target = (await getJson('/json/list')).find((t) => t.id === targetId);
    if (target && target.webSocketDebuggerUrl) break;
    await sleep(200);
  }
  assert.ok(target, 'clean about:blank target must exist');
  const page = new CDP(target.webSocketDebuggerUrl); await page.ready;
  await page.send('Runtime.enable');

  const setup = `(async () => {
    window.browser = { runtime: { onMessage: { addListener(fn) { window.__mcListener = fn; } }, sendMessage() { return Promise.resolve({}); } } };
    window.PageSaverI18n = { t: (k) => k };
    window.htmlToImage = { toCanvas() {} };
    window.joppOverlay = { set() {} };
    const spacer = document.createElement('div');
    spacer.style.cssText = 'position:absolute;left:0;top:0;width:1px;height:3000px;';
    document.body.appendChild(spacer);
    const SRC = ${JSON.stringify(source)};
    (0, eval)(SRC);
    const t = document.createElement('div');
    t.id = 'mc-key-target';
    t.style.cssText = 'position:absolute;left:100px;top:100px;width:200px;height:100px;background:#eee;';
    document.body.appendChild(t);
    window.__mcTarget = t;
    return { pickerReady: !!window.__joppPickerReady, adjust: typeof window.__mcAdjustRect, listener: typeof window.__mcListener };
  })()`;
  const boot = await page.evaluate(setup);
  console.log('boot:', JSON.stringify(boot));
  assert.equal(boot.pickerReady, true);
  assert.equal(boot.adjust, 'function');
  assert.equal(boot.listener, 'function');

  const run = `(async () => {
    function box(sel) {
      const n = document.querySelector(sel);
      if (!n) return null;
      const s = n.style;
      return { x: parseFloat(s.left), y: parseFloat(s.top), w: parseFloat(s.width), h: parseFloat(s.height) };
    }
    function key(k, opts) {
      document.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true, cancelable: true }, opts || {})));
    }
    function hover(el) {
      el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: 150, clientY: 150 }));
    }
    function mouse(el, type, x, y) {
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y }));
    }
    function start(mode) { window.__mcListener({ type: 'PICKER_START', mode: mode }, {}, () => {}); }

    const out = {};
    // ---- node mode ----
    start('node');
    hover(window.__mcTarget);
    out.node0 = box('.jopp-node-box');
    key('ArrowDown'); out.nodeDown = box('.jopp-node-box');
    key('ArrowUp'); out.nodeUp = box('.jopp-node-box');
    key('ArrowRight'); out.nodeRight = box('.jopp-node-box');
    key('ArrowLeft'); out.nodeLeft = box('.jopp-node-box');
    key('ArrowDown', { shiftKey: true }); out.nodeShrink = box('.jopp-node-box');
    key('ArrowRight', { altKey: true }); out.nodeFast = box('.jopp-node-box');
    key('q'); out.nodeLevelQ = box('.jopp-node-box');
    // ---- scroll correctness: the fixed UI root needs viewport coordinates ----
    start('node');
    hover(window.__mcTarget);
    out.scroll0 = { boxTop: box('.jopp-node-box').y, elTop: window.__mcTarget.getBoundingClientRect().top };
    window.scrollTo(0, 300);
    window.dispatchEvent(new Event('scroll'));
    document.dispatchEvent(new Event('scroll'));
    await new Promise((r) => requestAnimationFrame(() => r()));
    out.scroll1 = {
      boxTop: box('.jopp-node-box').y,
      elTop: window.__mcTarget.getBoundingClientRect().top,
      scrollY: window.scrollY
    };
    key('ArrowDown'); out.scrollDown = box('.jopp-node-box');
    window.scrollTo(0, 0);
    // ---- area mode ----
    start('area');
    const shield = document.querySelector('.jopp-shield');
    mouse(shield, 'mousedown', 200, 200);
    mouse(shield, 'mousemove', 400, 300);
    mouse(shield, 'mouseup', 400, 300);
    out.area0 = box('.jopp-area-box');
    key('ArrowDown'); out.areaDown = box('.jopp-area-box');
    key('ArrowLeft'); out.areaLeft = box('.jopp-area-box');
    key('Escape');
    return out;
  })()`;
  const r = await page.evaluate(run);
  console.log(JSON.stringify(r, null, 2));

  const S = 24;
  // Owner's report: ArrowDown must extend the bottom edge, not shrink the box.
  assert.equal(r.nodeDown.y, r.node0.y, 'ArrowDown keeps the top edge');
  assert.equal(r.nodeDown.h, r.node0.h + S, 'ArrowDown grows the height');
  assert.equal(r.nodeDown.y + r.nodeDown.h, r.node0.y + r.node0.h + S, 'bottom edge moves down');
  assert.equal(r.nodeUp.y, r.nodeDown.y - S, 'ArrowUp moves the top edge upward');
  assert.equal(r.nodeUp.y + r.nodeUp.h, r.nodeDown.y + r.nodeDown.h, 'ArrowUp keeps the bottom edge');
  assert.equal(r.nodeRight.w, r.nodeUp.w + S, 'ArrowRight grows the width');
  assert.equal(r.nodeRight.x, r.nodeUp.x, 'ArrowRight keeps the left edge');
  assert.equal(r.nodeLeft.x, r.nodeRight.x - S, 'ArrowLeft moves the left edge leftward');
  assert.equal(r.nodeLeft.x + r.nodeLeft.w, r.nodeRight.x + r.nodeRight.w, 'ArrowLeft keeps the right edge');
  assert.equal(r.nodeShrink.h, r.nodeLeft.h - S, 'Shift+ArrowDown shrinks the height');
  assert.equal(r.nodeFast.w, r.nodeShrink.w + 4 * S, 'Alt+ArrowRight uses a 4x step');
  assert.ok(r.nodeLevelQ.w !== r.nodeFast.w || r.nodeLevelQ.h !== r.nodeFast.h,
    'Q still changes the ancestor-chain level');

  assert.ok(r.scroll1.scrollY > 0, 'test page must actually scroll');
  assert.ok(Math.abs(r.scroll1.boxTop - r.scroll1.elTop) < 1,
    'after scrolling, the red box must stay aligned with the element (viewport coords)');
  assert.equal(r.scrollDown.h, r.node0.h + S, 'ArrowDown after scrolling still grows by one step');
  assert.equal(r.scrollDown.y, r.scroll1.boxTop, 'ArrowDown after scrolling keeps the box top');

  assert.ok(r.area0 && r.area0.w >= 8, 'area rect must be draggable');
  assert.equal(r.areaDown.h, r.area0.h + S, 'area ArrowDown grows the height');
  assert.equal(r.areaLeft.x, r.areaDown.x - S, 'area ArrowLeft moves the left edge');

  await page.send('Runtime.evaluate', { expression: 'window.__mcTarget.remove()' });
  browser.send('Target.closeTarget', { targetId }).catch(() => {});
  page.close(); browser.close();
  console.log('Real Chrome picker key verification OK: node + area, 18 geometry assertions passed.');
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
