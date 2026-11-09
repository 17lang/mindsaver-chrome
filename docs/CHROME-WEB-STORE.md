# Chrome Web Store 送审说明

修订：1；日期：2026-11-10；状态：**尚未提交**。本文是可执行的送审清单，不是"已上架"声明。

## 为什么现在还没提交

Chrome Web Store 的注册、付费、协议确认、OAuth 授权与审核提交都绑定 Owner 的 Google 账号，本机没有任何可用凭据（已核查：无 `CWS_*` / Google OAuth 环境变量、无 Web Store CLI、无本地凭据文件；`gh` 登录的是 GitHub 账号，与 Google 账号无关）。以下四项必须由 Owner 在 Google 侧完成，助手不能代办，也不能假装已提交：

1. **开发者账号**：Chrome Web Store Developer Dashboard 注册，一次性 **$5** 注册费，接受开发者协议，Google 账号开启**两步验证**（发布/更新的硬性要求）。
2. **商品详情与隐私标签**：新商品必须先在 Dashboard 填完 **Store listing** 与 **Privacy** 两个标签页，API 才能发布。
3. **OAuth 凭据**：Google Cloud 项目启用 Chrome Web Store API、配置 OAuth 同意屏幕（External + 测试用户）、创建 Web application OAuth client，用 scope `https://www.googleapis.com/auth/chromewebstore` 换取 `refresh_token`；还需要 Dashboard 里的 **Publisher ID** 与商品 **Item ID**。
4. **商店素材**：至少 1 张真实 UI 截图（1280×800 或 640×400）、128×128 商店图标、文案与权限理由。

可以提前准备好的（包、文案、权限理由、数据披露、隐私政策 URL、上传脚本）都已在 `store/` 与 `PRIVACY.md` 备齐。

## naming（名称约定）

- 仓库名：`17lang/mindsaver-chrome`（按 Owner 指定）。
- 扩展清单与界面显示名：**Mind Clipper 0.8.0**，即已实测的产品名。
- 商店展示名建议沿用 **Mind Clipper**。不要把 `Mindsaver for Chrome` 直接用作商店标题：Chrome Web Store 元数据政策不允许名称里把 "Chrome" 当作独立词使用（暗示 Google 背书），也要求名称与扩展清单一致。若要统一品牌，应同步改 `manifest.json`、`_locales/*/messages.json`、`PRIVACY.md`、图标说明与已发布的测试包，再重新打包重测。

## 送审素材清单

| 项目 | 要求 | 现状 |
| --- | --- | --- |
| 上传包 | zip 根目录直接含 `manifest.json`，不含 `tools/` / `docs/` | ✅ `python3 tools/package-chrome.py --output dist/mind-clipper-chrome.zip`（53 文件，约 8 MB）；发布到 Release 的 `mind-clipper-chrome.zip` |
| 名称 | ≤75 字符，不含独立 "Chrome" | ✅ 草稿见 [listing.md](../store/listing.md) |
| 简短描述 | ≤132 字符 | ✅ 中英两版见 listing.md |
| 详细描述 | ≤16,384 字符 | ✅ 中英两版见 listing.md |
| 分类 / 语言 | 至少 1 个分类、1 种主语言 | ✅ Productivity / 中文（简体）、English，另有繁体本地化 |
| 商店图标 | 128×128 PNG | ✅ `icons/icon128.png` |
| 管理图标 / 工具栏图标 | 48×48 / 16×16 | ✅ `icons/icon48.png`、`icons/icon16.png` |
| 截图 | 1–5 张，1280×800 或 640×400 PNG/JPEG，必须展示真实扩展 UI | ⚠️ 待补（`store/screenshots/` 说明） |
| 宣传图 | 440×280 小图、1400×560 marquee | 可选，未准备 |
| 隐私政策 URL | 公开可访问 | ✅ `https://github.com/17lang/mindsaver-chrome/blob/main/PRIVACY.md`（仓库公开后生效） |
| 单一用途说明 | 一句话，窄而明确 | ✅ 见 listing.md |
| 权限理由 | 每个权限一句具体理由 | ✅ [permissions-and-data.md](../store/permissions-and-data.md) |
| 数据使用披露 | 逐类声明，含"不售卖 / 不用于无关用途 / 不用于信用评估"认证 | ✅ 见 permissions-and-data.md |
| 远程代码声明 | 明确"否" | ✅ 全部 JS 随包，MV3 默认 CSP，无 `unsafe-eval`、无 CDN、无远程脚本 |
| 测试说明（Notes for reviewers） | 若需特殊环境 | ✅ 见 listing.md 末尾 |
| 分发 / 可见性 | Public 或 Unlisted | 待 Owner 选择 |

## 上传与发布（拿到凭据后）

`store/upload.py` 只从环境变量读凭据，不写入磁盘、不打印凭据值，**默认 dry-run**，必须显式 `--execute` 才会发请求。

```sh
export CWS_CLIENT_ID='...'
export CWS_CLIENT_SECRET='...'
export CWS_REFRESH_TOKEN='...'
export CWS_PUBLISHER_ID='...'      # Dashboard → Publisher → Settings
export CWS_ITEM_ID='...'           # 新商品在 Dashboard 建好后才有

# 1) 只打印将要调用的请求（安全）
python3 store/upload.py --zip dist/mind-clipper-chrome.zip --dry-run

# 2) 上传新版本到已有商品（v2 API，需 manifest version 递增）
python3 store/upload.py --zip dist/mind-clipper-chrome.zip --upload --execute

# 3) 查询上传/审核状态
python3 store/upload.py --status --execute

# 4) 提交审核（不可逆，需 Dashboard 两个标签页已填完）
python3 store/upload.py --publish --execute
```

现行官方端点（Chrome Web Store API v2）：

- 刷新令牌：`POST https://oauth2.googleapis.com/token`
- 上传：`POST https://chromewebstore.googleapis.com/upload/v2/publishers/{PUBLISHER_ID}/items/{ITEM_ID}:upload`
- 状态：`GET https://chromewebstore.googleapis.com/v2/publishers/{PUBLISHER_ID}/items/{ITEM_ID}:fetchStatus`
- 发布：`POST https://chromewebstore.googleapis.com/v2/publishers/{PUBLISHER_ID}/items/{ITEM_ID}:publish`

**注意**：新商品不能只靠 API 从零发布 —— 必须先在 Developer Dashboard 上传首个 zip 创建 item、填完 Store listing 与 Privacy 标签页；之后 API 才能上传新版本与提交审核。旧版 v1.1 `POST https://www.googleapis.com/upload/chromewebstore/v1.1/items`（带 `x-goog-api-version: 2`）可创建商品，但当前官方文档以 v2 为主，建议首个商品走 Dashboard。

## 审核风险与已知限制（如实填写，避免驳回）

- `<all_urls>`、`tabs`、`scripting`、`offscreen`、`nativeMessaging`、`clipboardWrite`、`downloads` 都是强权限，必须在 Privacy 标签页逐项给具体理由（文档已备好）。首次提交且含宽泛主机权限，可能进入人工审核、耗时数周。
- **单一用途**要写成"把网页保存为 PDF / HTML / Markdown 文件"，不要写成"浏览工具箱"；三条保存路线属于同一用途。
- 商店描述不得宣称未验证的能力：本机保存工具（Go）未编译未登记、设置页工具下载链接是占位，描述里不要写"自动保存到任意目录"作为已可用功能。
- 截图必须是真实 Chrome 中的扩展 UI，不能用渲染的营销图代替；不得含未在描述里出现的功能。
- 提交前复核：`manifest.json` 无 `key` 字段（开发期固定 ID 与商店 ID 不同）、`<all_urls>` 有理由、全部 JS 随包、版本号严格递增、包根含 `manifest.json`。

## 发布后

1. 拿到商店签发的**正式扩展 ID**后，用 `tools/native-helper/install_chrome.py --extension-id <商店ID>` 重新生成 native host 白名单（`allowed_origins`），并更新 `PRIVACY.md` 与设置页里工具下载链接；不要沿用开发 ID。
2. 把商店公开安装回执登记到项目管理根，更新 `README` / `README.zh-CN.md` 的状态段与内部现行文档《产品与适配边界》的商店条款；只有取得公开可安装回执后才可宣称已发布。
3. 后续每次更新递增 `manifest.json` 的 `version`，重新打包并走上传 → 发布流程；新增权限会触发完整复审。
