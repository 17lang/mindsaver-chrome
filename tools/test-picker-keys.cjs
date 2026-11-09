// 方向键选区语义自检：在隔离 vm 里加载真实 content/picker.js，
// 只取它挂到 window 上的纯函数 __mcAdjustRect，验证四方向扩/缩、加速与边界。
// 这是结构/逻辑自检，不替代真实 Chrome 交互验证。
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'content/picker.js'), 'utf8');
const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  getComputedStyle: () => ({ display: 'block' }),
  document: {
    documentElement: { style: { setProperty() {}, removeProperty() {}, getPropertyValue: () => '', getPropertyPriority: () => '' } },
    body: {},
    addEventListener() {},
    removeEventListener() {},
    createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} })
  },
  browser: { runtime: { onMessage: { addListener() {} }, sendMessage() {} } },
  PageSaverI18n: { t: (k) => k },
  devicePixelRatio: 1,
  innerWidth: 1200,
  innerHeight: 900,
  scrollX: 0,
  scrollY: 0,
  addEventListener() {},
  removeEventListener() {}
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'content/picker.js' });

const adjust = sandbox.__mcAdjustRect;
assert.equal(typeof adjust, 'function', 'picker.js must expose __mcAdjustRect for self-check');
const base = () => ({ x: 100, y: 100, w: 200, h: 100 });
const STEP = 24;

// 1. Owner 反馈的核心：↓ 必须向下扩（下边界变大），↑ 必须向上扩（上边界变小）。
const down = adjust(base(), 'ArrowDown', false, STEP);
assert.equal(down.y, 100, 'ArrowDown must not move the top edge');
assert.equal(down.h, 100 + STEP, 'ArrowDown must grow the height downward');
assert.equal(down.y + down.h, 224, 'ArrowDown must extend the bottom edge');
const up = adjust(base(), 'ArrowUp', false, STEP);
assert.equal(up.y, 100 - STEP, 'ArrowUp must move the top edge upward');
assert.equal(up.h, 100 + STEP, 'ArrowUp must keep the bottom edge in place');
assert.equal(up.y + up.h, 200, 'ArrowUp must not shrink the bottom edge');

// 2. ←→ 同理，只改对应的一条边。
const left = adjust(base(), 'ArrowLeft', false, STEP);
assert.equal(left.x, 100 - STEP, 'ArrowLeft must move the left edge leftward');
assert.equal(left.w, 200 + STEP, 'ArrowLeft must keep the right edge in place');
assert.equal(left.x + left.w, 300);
const right = adjust(base(), 'ArrowRight', false, STEP);
assert.equal(right.x, 100, 'ArrowRight must not move the left edge');
assert.equal(right.w, 200 + STEP, 'ArrowRight must extend the right edge');

// 3. Shift = 反向收缩，且不会把选区压到小于 8px。
const shrinkDown = adjust(base(), 'ArrowDown', true, STEP);
assert.equal(shrinkDown.h, 100 - STEP, 'Shift+ArrowDown must pull the bottom edge up');
assert.equal(shrinkDown.y, 100);
const shrinkUp = adjust(base(), 'ArrowUp', true, STEP);
assert.equal(shrinkUp.y, 100 + STEP, 'Shift+ArrowUp must pull the top edge down');
assert.equal(shrinkUp.h, 100 - STEP);
const tiny = adjust({ x: 10, y: 10, w: 10, h: 10 }, 'ArrowDown', true, STEP);
assert.equal(tiny.h, 8, 'shrink must clamp to the 8px minimum');

// 4. Alt 加速：步长由调用方传入 4 倍值。
const fast = adjust(base(), 'ArrowRight', false, STEP * 4);
assert.equal(fast.w, 200 + STEP * 4, 'Alt must use a 4x step');

// 5. 传给页面/文档的边界：向上、向左扩到 0 后不能越界，宽高不超上限。
const clamped = adjust({ x: 10, y: 10, w: 100, h: 100 }, 'ArrowUp', false, STEP, 400, 300);
assert.equal(clamped.y, 0, 'top clamp at document origin');
assert.ok(clamped.x >= 0 && clamped.y >= 0, 'no negative coordinates');
assert.ok(clamped.x + clamped.w <= 400 && clamped.y + clamped.h <= 300, 'no out-of-document rect');
const clampedRight = adjust({ x: 350, y: 10, w: 40, h: 40 }, 'ArrowRight', false, STEP * 4, 400, 300);
assert.equal(clampedRight.x + clampedRight.w, 400, 'right edge must clamp to maxW');

// 6. 非方向键原样返回，不误改选区；方向键不再兼任换层。
const untouched = adjust(base(), 'q', false, STEP);
assert.deepEqual(untouched, base(), 'Q/W are level changes, not rect edits');
assert.ok(!/e\.key === 'q' \|\| e\.key === 'Q' \|\| e\.key === 'ArrowUp'/.test(source),
  'ArrowUp must not be bound to the Q level change any more');
assert.ok(!/e\.key === 'w' \|\| e\.key === 'W' \|\| e\.key === 'ArrowDown'/.test(source),
  'ArrowDown must not be bound to the W level change any more');
assert.ok(source.includes('ArrowLeft') && source.includes('ArrowRight'), 'all four arrows must be handled');
assert.ok(source.includes('nodeRect'), 'node mode must keep an adjustable rect');
assert.ok(source.includes('captureRectToPdf(docRect, label'), 'confirm must send the adjusted rect');

console.log('Picker arrow-key self-check OK: 16 assertions passed.');
