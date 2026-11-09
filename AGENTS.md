# 仓库约定（AGENTS.md）

修订：2；日期：2026-11-10。公开默认分支：`main`；开发分支：`mind-clipper`。

本仓库是 [Pagesaver 0.7.1](https://github.com/17lang/pagesaver) 的 Chrome Manifest V3 派生版，构建与使用见 [README.md](README.md)。外部贡献者**不需要**访问任何本地管理根或 Obsidian 库：项目规格、路线与追溯保存在维护者本地的独立管理根，不属于本仓库，也不要求贡献者访问。

- 最大限度复用三格式保存、设置、文件名规则及固定官方依赖；不引入高亮、阅读器、AI、统计或远程托管代码。
- 第三方运行内核与 `licenses/` 保持字节不变；不放宽 MV3 默认 CSP、不用 `unsafe-eval`、不改继承的 Firefox 打包器 `tools/package-extension.py`。
- 提交前跑 `python3 tools/test_mv3_static.py`、`node tools/check-chrome-mv3.mjs` 与继承的 Node 测试；真实浏览器行为需独立 Chrome profile 验证，**静态自检不等于 QA 或验收**。
- 提交信息用英文，写清变更与证据边界；不要把开发自检、进程内 mock 或文字反馈写成真机验收。
- 维护者内部流程：代码变更当次同步现行规格与双向追溯，使用本仓 `.git` 下的 PHD 文档门禁，不绕过 Hook；开发机路径属于本地配置，不写入公开文档。
- 默认中文、界面简练、跨平台共用优先。Chrome 商店状态见 [docs/CHROME-WEB-STORE.md](docs/CHROME-WEB-STORE.md)。
