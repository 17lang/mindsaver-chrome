# Privacy / 隐私说明

Revision: 3 · 2026-11-10 · Mind Clipper 0.8.0（Chrome Manifest V3）· Open-source repository: https://github.com/17lang/mindsaver-chrome

Mind Clipper processes pages on your computer. It has no developer-operated server, advertising, analytics or account system. It does not send your saved pages or vault locations to the developer.

- **Normal downloads:** page content is written through the browser download API.
- **Complete HTML:** the browser may request images, fonts, styles or video from the page's original resource hosts. Those hosts receive the network requests normally required to load their resources. Offline completeness depends on access to those resources. Resource fetching is done locally by the extension; it is not sent to a developer service.
- **Send to Obsidian:** only when you choose this mode and save an article, its Markdown replaces your clipboard. A local `obsidian://` URL tells your installed Obsidian app which vault/note to create and to read the clipboard. Clipboard contents may be accessible to other applications and any clipboard history or sync services you use. Mind Clipper does not enable clipboard syncing. The browser may ask before opening Obsidian. The extension cannot confirm the app completed a write.
- **Optional local save helper:** when you select an advanced save location, the extension sends file contents, filename and destination to the locally installed helper using Chrome Native Messaging. The helper writes local files, reads the local Obsidian vault registry when requested, has no network access code, and is not a persistent service. It uses a separate host name and a separate install directory from the inherited Firefox tool; existing registrations and saved files are not modified.
- **Settings:** save locations and vault names are stored in the extension's local browser storage, not its sync storage. Remove the extension to remove its settings; uninstalling it does not delete saved files. The helper can be removed separately as described in its README.
- **Permissions:** `<all_urls>` host permission is needed for capture/extraction, full-page screenshots and resource fetching on any page you choose to save; `tabs`/`activeTab` for the page and local app handoff; `downloads` for files; `storage` for settings; `contextMenus` for right-click save actions; `clipboardWrite` for the explicitly selected Obsidian mode; `nativeMessaging` for the optional helper; `scripting` for injecting the bundled frame-capture helper into cross-origin frames; `offscreen` for a hidden extension page that renders canvases/PDFs and creates blob URLs (a Manifest V3 service worker has no DOM). No clipboard-read permission and no remote code execution are used.

For the Chrome Web Store data-use disclosure, saved content can include the source URL and can be passed to another local application at the user's request. This declaration does not mean Mind Clipper uploads pages to a cloud service. Transmission is limited to the save action and destination chosen by you. Store listing, account and review are handled separately from this source document.

Support: [GitHub Issues](https://github.com/17lang/mindsaver-chrome/issues). Do not post private saved content, credentials or local vault paths in a public issue. This document is also the public privacy policy URL used by the Chrome Web Store listing.

---

Mind Clipper 在本机处理网页，没有开发者服务器、广告、统计或账号系统，不会把保存的网页和仓库路径上传给开发者。

普通下载通过浏览器保存。完整 HTML 会向资源原站请求图片、字体、样式或视频，资源网站能收到这些正常请求。选择“交给 Obsidian”并保存时，正文会替换剪贴板内容，再由本机 Obsidian 读取；其他应用及你已开启的剪贴板历史、同步服务可能读取剪贴板，Mind Clipper 不会替你开启同步，也不确认 Obsidian 是否落盘。

只有选择高级位置时，才会把待保存文件和位置交给本机保存工具。该工具没有联网代码和常驻服务；需要仓库列表时仅读取本机 Obsidian 的登记文件。Chrome 版使用独立的通道名与安装目录，不改动继承的 Firefox 工具登记。设置只保存在当前扩展的本地存储中，不使用浏览器同步。卸载扩展不会删除已保存的文件，保存工具可以另行卸载。

Chrome 商店的数据使用声明覆盖网页内容与浏览活动，是为了如实说明内容及原网址可能交给本机应用，不代表上传云端。仅处理用户主动保存的页面。公开问题反馈中请勿包含私人内容、路径或凭据。
