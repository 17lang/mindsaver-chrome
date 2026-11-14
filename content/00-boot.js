// 必须第一个加载：捕获 content script 初始化阶段的报错。
// 这样万一某个库没挂上，我们能在界面上显示"确切原因"，而不是只看到 undefined。
(function () {
  window.__joppBootErrors = [];

  window.addEventListener('error', function (e) {
    try {
      var msg = e.message || (e.error && e.error.message) || PageSaverI18n.t('ui_13a46616e16f');
      var where = e.filename ? ' @ ' + String(e.filename).split('/').pop() + ':' + (e.lineno || 0) : '';
      window.__joppBootErrors.push(msg + where);
    } catch (x) { /* 忽略 */ }
  });

  window.addEventListener('unhandledrejection', function (e) {
    try {
      var r = e.reason;
      window.__joppBootErrors.push(PageSaverI18n.t('ui_e498787a1115') + ((r && r.message) || r));
    } catch (x) { /* 忽略 */ }
  });

  // Obsidian Web Clipper 的页面侧剪贴板回退（MIT）：
  // src/content.ts 的 "copy-text-to-clipboard" 分支 @ 6d56d618...
  // 上游是已上架的 Chrome 扩展，Markdown 交接沿用这段已验证路径，不另造实现。
  // 消息名与 src/utils/clipboard-utils.ts 发出的 action 一致。
  browser.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request && request.__mc) return false;
    if (!request || request.action !== 'copy-to-clipboard') return false;
    if (!document.body) { sendResponse({ success: false }); return false; }
    const textArea = document.createElement('textarea');
    textArea.value = String(request.text || '');
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      sendResponse({ success: true });
    } catch (err) {
      sendResponse({ success: false });
    }
    document.body.removeChild(textArea);
    return true;
  });
})();
