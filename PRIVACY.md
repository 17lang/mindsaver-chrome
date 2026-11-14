# Privacy / 隐私说明

Revision: 3 · 2026-11-13 · Mind Clipper 0.8.5（Chrome Manifest V3）

Mind Clipper processes pages on your computer. It has no developer-operated server, advertising, analytics or account system. It does not send your saved pages or vault locations to the developer.

- **Normal downloads:** page content is written through the browser download mechanism. Files are named by the rules on the "Filename" settings page.
- **Complete HTML:** the browser may request images, fonts, styles or video from the page's original resource hosts. Those hosts receive the network requests normally required to load their resources. Offline completeness depends on access to those resources. Resource fetching is done locally by the extension; it is not sent to a developer service.
- **Save to an Obsidian vault:** only when you choose this mode and save an article. The Markdown is normally passed inside a local `obsidian://new?...&content=...` URL that tells your installed Obsidian app which vault/note to create; a visible extension page performs the jump so you can see the target vault and note path. Only unusually long articles fall back to `&clipboard`, in which case the hand-off page copies the Markdown to your clipboard first and other applications or clipboard-history services may read it. The browser may ask before opening Obsidian. The extension cannot confirm the app completed a write.
- **No local helper:** this build does not install, register or communicate with any native application. It cannot write to arbitrary absolute folders; PDF/HTML always go to the browser download folder.
- **Settings:** destination and vault names are stored in the extension's local browser storage, not its sync storage. Remove the extension to remove its settings; uninstalling it does not delete saved files.
- **Permissions:** `<all_urls>` host permission is needed for capture/extraction, full-page screenshots and resource fetching on any page you choose to save; `tabs`/`activeTab` for the page and the Obsidian handoff page; `downloads` for files; `storage` for settings; `contextMenus` for right-click save actions; `clipboardWrite` only for the long-article clipboard fallback; `scripting` for injecting the bundled frame-capture helper into cross-origin frames; `offscreen` for a hidden extension page that renders canvases/PDFs and creates blob URLs (a Manifest V3 service worker has no DOM). No `nativeMessaging`, no clipboard-read permission and no remote code execution are used.

For the Chrome Web Store data-use disclosure, saved content can include the source URL and can be passed to another local application at the user's request. This declaration does not mean Mind Clipper uploads pages to a cloud service. Transmission is limited to the save action and destination chosen by you.

Support: GitHub Issues in this repository. Do not post private saved content, credentials or local vault paths in a public issue.

---

Mind Clipper 在本机处理网页，没有开发者服务器、广告、统计或账号系统，不会把保存的网页和仓库路径上传给开发者。

普通下载通过浏览器保存，文件名按「文件命名」设置生成。完整 HTML 会向资源原站请求图片、字体、样式或视频，资源网站能收到这些正常请求。

选择「保存到 Obsidian 仓库」时，正文通常直接放在本机 `obsidian://new?...&content=...` 链接里交给 Obsidian，并由一个可见的提示页显示目标仓库与笔记路径；只有超长文章才会改用剪贴板（由交接提示页先复制正文），此时其他应用及你已开启的剪贴板历史、同步服务可能读取剪贴板。Mind Clipper 不会替你开启同步，也不确认 Obsidian 是否落盘。

本版本**不与任何本机应用通信，也不需要额外安装**，也不向扩展之外的绝对路径写文件；PDF / HTML 始终保存到浏览器下载文件夹。设置只保存在当前扩展的本地存储中，不使用浏览器同步。卸载扩展不会删除已保存的文件。

Chrome 商店的数据使用声明覆盖网页内容与浏览活动，是为了如实说明内容及原网址可能交给本机应用，不代表上传云端。仅处理用户主动保存的页面。公开问题反馈中请勿包含私人内容、路径或凭据。
