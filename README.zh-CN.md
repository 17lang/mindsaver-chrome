# Mindsaver for Chrome / Mind Clipper

[English](README.md)

把网页一键保存为**单页长 PDF**、**完整离线 HTML** 或**干净的 Markdown**，全部在本机完成。这是由 [Pagesaver 0.7.1](https://github.com/17lang/pagesaver) 派生的 Chrome（Manifest V3）开源版本。

仓库按 Owner 指定命名为 `mindsaver-chrome`；扩展清单与界面仍显示已实测的 **Mind Clipper 0.8.0**。若要统一商店展示名，见 [商店送审说明](docs/CHROME-WEB-STORE.md#naming)。

## 三种保存方式

| 模式 | 输出 | 说明 |
| --- | --- | --- |
| 整页 / 选取框架 / 框选区域 | 单页长 PDF，带可搜索文字层 | 浏览器原生截图拼接，按 Chrome 每秒 2 次的配额串行节流 |
| 完整 HTML | 单个自包含 `.html` 文件 | 用 SingleFile 内核内联资源；资源可访问时断网也能打开 |
| Markdown | `.md` 文件，或直接交给 Obsidian | Defuddle 提取 + 复用 Obsidian Web Clipper 的笔记创建流程 |

三种格式共用文件名规则（发布日期在前 + 规范标题、重名自动编号）、各自的保存设置与本机保存协议。没有账号、开发者服务器、统计、广告或 AI 功能。

## 当前状态（提 issue 前请先读）

这是**开源开发版**，不是已上架的 Chrome 商店成品。

- 真实 Chrome 157（Chrome for Testing、独立 profile、CDP）已验证：短页 PDF / HTML / Markdown 下载、真实 service worker 内的截图节流、选区方向键几何（18 条断言）。Owner 也已在 36kr 长文上确认整页 PDF 与两种选区 PDF 全部成功。
- **尚未验证**：完整 QA 矩阵、跨域 iframe、Obsidian 交接、后台休眠恢复、真实站点上方向键扩边后的截取范围、可选的本机保存工具。
- 可选的 Go 本机工具**未编译、未登记**；本轮只能测「默认浏览器下载」和「直接交给 Obsidian」两条路线，设置页的工具下载链接是占位说明。
- Chrome 网上应用店**尚未提交**：需要开发者账号、一次性注册费、商店素材与 OAuth 凭据；已准备好的材料见 [商店送审说明](docs/CHROME-WEB-STORE.md)。

## 本地试用（加载已解压的扩展程序）

Chrome 稳定版已不允许拖入商店外的 `.crx`，官方开发测试方式是「加载已解压的扩展程序」。

1. 从 [Releases](https://github.com/17lang/mindsaver-chrome/releases) 下载 `mind-clipper-chrome.zip`，解压到一个**固定、不会被移动或删除的目录**（Chrome 记住路径，目录没了扩展就失效）。
2. 打开 `chrome://extensions`，开启右上角**开发者模式**，点**「加载已解压的扩展程序」**，选择直接包含 `manifest.json` 的那一层目录。
3. 打开普通 `http://` / `https://` 文章页，**刷新一次**，并在扩展详情里把**「网站访问权限」设为「在所有网站上」**，再点工具栏图标。

需要 Chrome 116+。`chrome://`、商店页、PDF 查看器、新标签页等受限页面无法截取，现在会给出明确的中文指引。长页 PDF 约每屏 0.6 秒，是 Chrome 截图配额所致，不是卡死。

## 从源码构建

需要 Python 3.9+ 与 Node 18+，不需要 npm install。

```sh
python3 tools/package-chrome.py --output dist/mind-clipper-chrome.zip
python3 tools/test_mv3_static.py                 # 7 项静态自检
node tools/check-chrome-mv3.mjs
node tools/test-picker-keys.cjs                  # 选区几何逻辑
node --test tools/test-destinations.cjs tools/test-filename-rules.cjs tools/test-i18n.cjs
```

若已用 `--remote-debugging-port=9222` 启动 Chrome for Testing，可跑真实浏览器交互验证：

```sh
node tools/test-picker-chrome.cjs
```

继承的 Firefox 打包器 `tools/package-extension.py` 与官方内核保持字节不变，由 `tools/check-chrome-mv3.mjs` 强制校验。

## 架构简述

`manifest.json` 为 MV3；`sw.js` 是薄 service worker，顶层同步注册事件、代理白名单内的浏览器 API 并维护 offscreen document。`offscreen.html` / `offscreen.js` 承载继承的 `background.js`（DOM、canvas、XHR、`FileReader`、blob URL —— service worker 都没有这些）。`lib/browser-shim.js` 用显式别名表把 `browser.*` 映射为 `chrome.*`（无动态求值），`lib/sw-api-bridge.js` 承载 `__mc` 消息信封。内容脚本是随包静态文件，经 `chrome.scripting` 注入；标签页早于扩展加载时会按需补注入。[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) 记录的是继承的 Firefox 设计，作为参考资料保留。

## 上游复用

Markdown 提取与 Obsidian 交接**纯复用** [Obsidian Web Clipper](https://github.com/obsidianmd/obsidian-clipper)（MIT，固定提交 `6d56d618b00bd970aa738d6a7a61edee27783e81`）：Defuddle + `createMarkdownContent`、两级剪贴板写入（Clipboard API → 页面侧 `copy-to-clipboard` 回退）与 `obsidian://new?…&clipboard` URI。Chrome 侧只做平台桥接，详见 [options/UPSTREAM.md](options/UPSTREAM.md)。不包含上游的高亮、阅读器、模板、AI 或统计功能。

## 隐私

全部在本机处理。完整权限清单、数据使用声明与剪贴板/Obsidian 注意事项见 [PRIVACY.md](PRIVACY.md)。

## 许可

沿用 Pagesaver 的 **AGPL-3.0-or-later**。第三方组件保留各自许可（MIT / Apache-2.0 / SIL OFL 1.1 / AGPL-3.0），全文与固定版本见 [LICENSE](LICENSE)、[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)、`licenses/` 与 `options/LICENSE-obsidian-clipper.txt`。运行内核字节未改，来源哈希见 [tools/vendor/provenance.json](tools/vendor/provenance.json)。

## 参与贡献

欢迎 issue 与 PR。请附上 Chrome 版本、操作系统、可公开复现的 URL、点了哪个按钮、提示文字与 service worker / 弹窗控制台原文；公开 issue 里不要放私人网页内容、仓库路径或凭据。不要改固定的第三方内核，不要引入 `unsafe-eval` 或远程代码，提交 PR 前跑一遍静态套件。

`AGENTS.md` 与 `PROJECT-MANAGEMENT.md` 是原项目管理约定（含本地 Obsidian 路径）；`docs/FIREFOX-PUBLISHING.md`、`docs/VERIFICATION.md` 是继承的 Firefox 参考资料，不是 Chrome QA 证据。
