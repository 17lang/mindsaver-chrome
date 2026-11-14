/* Visible Obsidian hand-off page. Extension pages may navigate to a custom URL
 * scheme (the browser asks the user once); a service worker cannot reliably do
 * that. Keeping a visible page also gives the user the exact vault / note path
 * when something goes wrong. */
(function () {
  'use strict';
  var KEY = 'mcObsidianHandoff';
  var $ = function (id) { return document.getElementById(id); };
  var current = null;

  function writeClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }

  function legacyCopy(text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    area.remove();
    if (!ok) throw new Error('copy failed');
  }

  function openObsidian() {
    if (!current || !current.uri) {
      $('state').textContent = '没有待交接的笔记，请先从扩展里保存一次 Markdown。';
      return;
    }
    var finish = function () {
      $('state').textContent = '已请求打开 Obsidian，请在 Obsidian 中确认笔记。';
      window.location.href = current.uri;
    };
    if (!current.clipboardText) { finish(); return; }
    $('state').textContent = '长文：正在复制正文到剪贴板…';
    writeClipboard(current.clipboardText).then(finish, function () {
      // Never open Obsidian with &clipboard after a failed write: that would
      // create an empty or stale-content note.
      $('state').textContent = '无法写入剪贴板，已停止交接。请把 Markdown 位置改回浏览器下载文件夹后重试。';
    });
  }

  chrome.storage.local.get(KEY, function (data) {
    var handoff = data && data[KEY];
    if (!handoff || !handoff.uri) {
      $('state').textContent = '没有待交接的笔记，请先从扩展里保存一次 Markdown。';
      return;
    }
    current = handoff;
    $('vault').textContent = handoff.vault || '当前打开的仓库';
    $('note').textContent = (handoff.notePath || '') + '.md';
    $('mode').textContent = handoff.clipboardText
      ? '剪贴板（长文，本页先复制正文）' : '链接直传（不占用剪贴板）';
    $('hint').textContent = '交接时间：' + new Date(handoff.at || Date.now()).toLocaleString('zh-CN');
    $('state').textContent = '正在打开 Obsidian…';
    setTimeout(openObsidian, 400);
  });

  $('open').addEventListener('click', openObsidian);
  $('copy').addEventListener('click', function () {
    if (!current || !current.uri) return;
    navigator.clipboard.writeText(current.uri).then(function () {
      $('state').textContent = '链接已复制，可粘贴到浏览器地址栏手动打开。';
    }, function () {
      $('state').textContent = '复制失败，请点「重新打开 Obsidian」重试。';
    });
  });
  $('settings').addEventListener('click', function () {
    chrome.runtime.openOptionsPage();
  });
})();
