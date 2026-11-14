# 保存设置的上游来源

修订：3；更新日期：2026-11-08。

上游：[Obsidian Web Clipper](https://github.com/obsidianmd/obsidian-clipper)
固定提交：`6d56d618b00bd970aa738d6a7a61edee27783e81`；MIT，完整许可见本目录 `LICENSE-obsidian-clipper.txt`。

| 本地文件 | 上游原件及复用范围 | 为 Pagesaver 做的适配 |
| --- | --- | --- |
| settings-section-ui.js | src/managers/settings-section-ui.ts：侧栏事件委托、section 显隐、active 状态 | 去掉 TypeScript 和无关模块依赖，仅 Markdown/PDF/HTML；加入键盘按钮及当前页属性 |
| settings.html | src/settings.html：settings/settings-container/sidebar/content、settings-section/setting-items 结构；template-vault、template-path-name 保存位置字段 | 中英文自动适配；只保留保存位置；添加 PDF/HTML 分类及绝对路径模式 |
| settings.css | src/styles/settings.scss 的设置布局与 setting-item 规则；src/styles/_sidebar.scss 的 sidebar/nav-list 规则 | Sass 嵌套改为浏览器原生 CSS 嵌套；补足独立运行所需颜色、控件和窄屏样式 |
| settings.js | 延用上游 template-vault 选择仓库、template-path-name 指定相对目录的交互与数据含义 | 使用本机工具读取已登记的仓库；检查通过才保存配置；统一服务三种格式 |
| obsidian-save.js（剪贴板部分） | `src/utils/clipboard-utils.ts`：两级剪贴板写入（Clipboard API → `copy-to-clipboard` 页面侧回退消息） | 去 TypeScript 与 browser-polyfill，作为同文件内的 `copyToClipboard` 复用，保持模块自洽；失败策略由本项目产品边界决定，不采用上游把全文塞进 `&content=` 的回退 |
| content/00-boot.js（新增分支） | `src/content.ts` 的 `copy-text-to-clipboard` 分支：textarea + `document.execCommand('copy')` | 消息名对齐上游 clipboard-utils 发出的 `copy-to-clipboard`；增加 `__mc` 过滤和 body 存在性保护 |

`destinations.js`、`native-save.js` 和 tools/native-helper 是补足浏览器任意绝对路径写入限制的新增部分，不称作上游代码。
Markdown 提取沿用项目已有的 Defuddle full 内核，本轮未更换其字节。

没有引入上游高亮、阅读器、AI 解释器、统计、评分、模板编辑器及对应脚本、样式、资源或权限。上游完整设置页不是运行依赖；仅吸收表中所列的保存相关片段。

0.6.0 为降低安装门槛，新增 `obsidian-save.js`：直接从同一提交的 `src/utils/obsidian-note-creator.ts` 复用 `obsidian://new?file=...`、`vault`、相对路径补斜杠及剪贴板传全文方式。去除模板、frontmatter、日记、追加/覆盖、统计及自动保存依赖，不引入高亮或阅读器。增加 clipboardWrite 权限；不读剪贴板。交接后只报告“已交给 Obsidian”，实际创建由 Obsidian 完成。

Markdown 可选默认下载、直接交给 Obsidian、原生绝对目录或原生仓库模式；PDF/HTML 原生模式仍统一通过工具写文件。直接模式填写仓库名称即可，无需读取 Obsidian 私有登记；跟随实际目录才需要原生工具解析。

修订记录：r2（2026-11-03）记录中英文适配及上游保存相关 URI/剪贴板复用。

## Chrome 适配的复用边界（r3）

Obsidian Web Clipper 本身是已发布、可在 Chrome 使用的扩展。因此本项目的 Markdown 链路**保持上游与继承实现，不重复造轮子**：

- 正文提取与 Markdown 转换：`content/htmlsave.js` 继续调用继承的 `lib/defuddle-full.js`（`Defuddle` + `createMarkdownContent`），字节未改；与上游 `src/content.ts` 的 `parseForClip` + `createMarkdownContent` 同构。
- Obsidian 交接：`options/obsidian-save.js` 保留上游 `obsidian://new?file=...&vault=...&clipboard`、相对路径补斜杠与「只报告 handedOff」语义；不引入模板、frontmatter、日记、追加/覆盖、统计或 `&content=` 全文回退。
- 剪贴板：在 `obsidian-save.js` 内沿用上游 `clipboard-utils.ts` 的两级策略与页面侧 `content.ts` 回退分支，不另写项目专用剪贴板实现或另拆文件（继承测试与设置页只加载该模块）。Chrome 侧仅做平台桥接——offscreen document 以 `CLIPBOARD` reason 提供 Clipboard API，service worker 把 `copy-to-clipboard` **定向投递给当前活动标签页**（上游为广播，这里避免多标签页争抢剪贴板）。
- `tools/check-chrome-mv3.mjs` 固定校验上述复用关系，`tools/test-mv3-bridge.cjs` 校验剪贴板回退消息往返。

上游清单文件位置未纳入本项目；本项目按 Chrome 官方 MV3 要求自行声明 `clipboardWrite`、`offscreen`、`tabs` 等权限，见 `manifest.json`。

## v5 修订（r4，2026-11-13）

以上表格与 r3 段落记录的是 0.8.0 及更早的实现，保留作为溯源。0.8.1 起有以下变更，与上游无关，属于本项目自己的产品决策：

- 删除 `native-save.js`、`nativeMessaging` 权限、仓库枚举与所有需要本机保存工具的保存位置。设置页不再出现「下载 Mac 保存工具」。上游 Obsidian Web Clipper 本身也不需要这类工具，v5 与之一致。
- `obsidian-save.js` 改为优先 `obsidian://new?file=...&vault=...&content=...`（正文随链接传递），仅在正文过长时回退到 `&clipboard`；剪贴板写入改由可见的 `options/obsidian-bridge.html` 在扩展页面内完成（`navigator.clipboard` → textarea/execCommand 兜底），写失败即停止交接，避免空笔记。`content/00-boot.js` 的页面侧 `copy-to-clipboard` 分支保留但不再是主链路。上游「只报告 handedOff、不冒充落盘成功」的语义保持不变。
- 下载不再由 service worker 用 blob URL 调 `chrome.downloads.download`（Chrome 会忽略 `filename` 并把文件命名成 blob UUID）。改为在 offscreen document 内用 `<a download>` 触发，并由 service worker 的 `downloads.onDeterminingFilename` 兜底强制命名。
- 设置项改为自动保存，避免 v4 的「尚未保存」状态被误认为已生效。
