# 开发指南

## 环境

- Windows 10/11 x64。
- Node.js 22.13+ 与 npm。
- Git 与 Google Chrome。
- Windows PowerShell，用于发布脚本。

正式应用采用 npm workspaces：`apps/desktop`、`apps/extension` 和 `packages/shared`。`tools/pdf-spike` 是独立实验，单独安装依赖。

## 获取源码

```powershell
git clone https://github.com/Airmoond/attention-ui.git
cd attention-ui
npm ci
npm run build -w packages/shared
```

主分支为 `master`。新增开发分支使用 `codex/` 前缀。开始修改前阅读 [MUST_READ.md](../MUST_READ.md)，模块导航见 [00_MODULE_INDEX.md](../00_MODULE_INDEX.md)。

## 启动桌面端与插件

先构建插件，再启动桌面端：

```powershell
npm run build -w apps/extension
npm run dev:desktop
```

在 Chrome 打开 `chrome://extensions`，开启开发者模式，加载仓库下的 `apps/extension/.output/chrome-mv3` 文件夹。

桌面端提供本地服务 `http://127.0.0.1:17321`。按 [安装指南](installation.md) 完成 AI 配置、插件配对和网站启用。开发模式与安装版使用同一服务端口，启动开发版前从托盘退出已运行的安装版。

内置页面：

- `/demo/article.html`：段落总结、解释、提问与专注阅读。
- `/demo/finance.html`：图表生成与数据提取。
- `/guide`：安装说明。
- `/health`：服务状态与版本。

扩展热更新在另一个终端运行：

```powershell
npm run dev:extension
```

此时改为加载 `apps/extension/.output/chrome-mv3-dev`。切换插件目录后停用原扩展实例，并刷新待测试网页。

## 检查与构建

| 命令 | 用途 |
| --- | --- |
| `npm run typecheck` | 检查三个正式 workspace 的类型 |
| `npm test` | 构建共享包并运行共享、桌面与插件测试 |
| `npm run build` | 构建共享包、桌面程序和 Chrome 插件 |
| `npm run package:release` | 构建 Windows 安装程序与配套插件，整理发布目录 |
| `npm run verify:release` | 校验发布文件、版本、内置插件一致性及产物内容 |

桌面服务测试会使用 `127.0.0.1:17321`。运行全项目测试前，从托盘退出当前桌面程序。

## 扩展浏览器回归

先运行 `npm run build -w apps/extension`，然后准备独立测试浏览器：

```powershell
Set-Location tools/pdf-spike
npm ci
$env:PLAYWRIGHT_BROWSERS_PATH = "$PWD/.formula-runtime/browsers"
npx playwright install chromium --no-shell
Set-Location ../..
node scripts/test-site-controls.mjs
Remove-Item Env:PLAYWRIGHT_BROWSERS_PATH
```

脚本加载真实生产扩展，使用独立临时浏览器配置和模拟 AI 响应。结果与截图写入 `tools/pdf-spike/test-results`。这组回归不需要服务商 API Key。

## 打包

```powershell
npm run package:release
npm run verify:release
```

当前脚本默认日期为 `20261003`；指定其他构建日期：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-release.ps1 -BuildDate YYYYMMDD
```

产物包括：

- `apps/desktop/release/AttentionUI-Setup-0.1.1.exe`。
- `apps/extension/.output/attention-uiextension-0.1.1-chrome.zip`。
- `release/0.1.1-attentionui-student-<构建日期>/`：安装程序、插件、说明与演示页面。

本次已分发批次的校验值和实际检查结果见 [发布记录](releases/attentionui-student-test.md)。

## PDF 与公式实验

运行方法见 [PDF 实验说明](../tools/pdf-spike/README.md)。本机公式识别需要独立 Python 环境和模型；正式应用的开发与构建不需要这些依赖。

## 提交修改

一次提交围绕一个明确的问题或功能，附上复现方式和相关检查结果。接口或共享类型变更同时检查两端调用；用户可见行为变更同步更新使用文档。通过 [GitHub Issues](https://github.com/Airmoond/attention-ui/issues) 讨论问题，提交 Pull Request 时说明修改后的行为和验证方式。
