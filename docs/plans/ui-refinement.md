# AttentionUI UI 优化记录

用户于 2026-10-03 确认：采用优雅、简洁、参考苹果的视觉风格，按此前五阶段计划开发。

版本保留：用户对第一版视觉效果不满意，要求先保存并推送独立分支，随后再调整。本版归档于 `codex/ui-refinement-v1`，作为对照和恢复基线；工程验证通过不代表视觉方案已经获用户验收。

## 视觉规范

浅灰白背景、实色阅读内容、深灰文字、蓝色主操作。导航与工具浮层采用轻微通透材料，保留实色回退。系统字体，正文 14–15px、阅读正文 16–18px。圆角与间距统一；原生 SVG 线图标，不新增产品依赖。焦点可见，状态同时使用文字和颜色，遵循减少动画偏好。

颜色与阴影在 `packages/ui/tokens.css` 统一，图标路径在 `packages/ui/icons.ts` 统一。两端各自使用自己的 React；共享数据包职责保持为类型与校验。

## 实施与验收

1. 建立视觉规范和独立预览：桌面 AI 设置、插件弹窗、回答卡片。预览使用真实组件和原创模拟数据，与用户配置和真实 AI 隔离。
2. 桌面端五页：导航、设置分组、快速上手、运行状态和日志。
3. 插件弹窗与设置页：连接、网站、阅读操作层次和原生开关。
4. 网页工具：工具条、回答、提问、图表、专注阅读；样式仅进入 Shadow DOM。
5. 类型检查、已有测试、生产构建、网站控制回归，以及窗口、缩放、键盘和异常状态检查。

各阶段拆为最多八个文件的实现批次，工程检查通过后继续；视觉手感留供用户复验。PDF 为独立实验，正式 PDF 集成不属于本轮。

## 本机预览

根目录运行 `node node_modules/vite/bin/vite.js --config tools/ui-preview/vite.config.ts`，打开 `http://127.0.0.1:5190`。顶部可切换桌面、插件及阅读工具；所有配对、AI 和文件操作为明确标注的模拟预览，不连接供应商。

预览统一使用 React 18 运行时和类型映射，解决两端 React 版本差异；正式两端依赖没有更改。预览中的页顶导航和材料位置适配仅属于演示容器。当前安装包仍为原有 0.1.1；更新源码与构建产物不等于重新分发安装包。

## 2026-10-03 验证结果

五阶段的工程实现与验证完成，视觉风格供用户复验。没有安装或升级用户现有软件，没有调用真实供应商 AI。

| 检查 | 结果 |
| --- | --- |
| `npm run typecheck` | 正式 shared / desktop / extension 均通过 |
| `npm test` | 179/179：shared 10、desktop 60、extension 109 |
| `npm run build` | 两端生产构建通过 |
| `node scripts/test-site-controls.mjs` | 真实构建扩展 20/20 浏览器检查通过 |
| `node scripts/test-ui-refinement.mjs` | 真实组件预览 40/40 检查通过，无页面脚本错误 |
| `node node_modules/typescript/bin/tsc -p tools/ui-preview/tsconfig.json` | 独立预览类型检查通过 |
| `node node_modules/vite/bin/vite.js build --config tools/ui-preview/vite.config.ts` | 独立预览构建通过 |

UI 检查覆盖五个桌面页面的 960×680、760×520、1280×800 和 390×844 布局；125% / 150% 浏览器内容缩放；密钥隐藏与显示、保存与连接反馈、设置边界、空问题、键盘发送、重置取消、服务状态、安装说明展开、网站控制、320px 工具条边界、图表、加载/失败/重试、专注阅读焦点与 Esc、减少动画偏好。

已目视核对桌面默认/最小窗口、插件弹窗、窄屏连接页、回答/窄屏回答、图表、工具条和专注阅读截图。截图与结果位于 `tools/ui-preview/test-results/`，仅留本机并已忽略。

保留既有 WXT/Vite 弃用提示；独立预览因包含 ECharts 有脚本体积提示。内置浏览器连接失败，改用项目已有独立 Chromium。受限环境解析本机依赖链接失败时，用获准的完整文件访问运行检查；未修改依赖。

浏览器内容缩放是工程验证，真实 Windows 系统显示缩放仍需人工复验。真实百科复杂布局、原生首次授权弹窗和 PDF 正式集成仍沿用原有验收边界。

## 修改文件与作用

| 文件 | 作用 |
| --- | --- |
| `packages/ui/tokens.css` | 两端统一配色、系统字体、圆角、阴影与焦点规范 |
| `packages/ui/icons.ts` | 共享原创 SVG 路径，独立于 React 版本 |
| `apps/desktop/src/renderer/src/App.tsx` | 品牌、侧栏图标、选中状态和底部服务状态 |
| `apps/desktop/src/renderer/src/styles.css` | 桌面浅色布局、分组控件、响应式和辅助功能样式 |
| `apps/desktop/src/renderer/src/pages/AISettingsPage.tsx` | 连接分组、字段说明、区分保存/测试进度与成功/失败 |
| `apps/desktop/src/renderer/src/pages/BehaviorPage.tsx` | 设置行、开关说明、状态反馈 |
| `apps/desktop/src/renderer/src/pages/QuickStartPage.tsx` | 安装步骤展开、简短说明、异步失败及等待反馈 |
| `apps/desktop/src/renderer/src/pages/StatusPage.tsx` | 配对操作说明与当前插件入口一致 |
| `apps/desktop/src/renderer/src/pages/LogsPage.tsx` | 日志说明与状态播报，使用统一布局 |
| `apps/extension/entrypoints/popup/App.tsx` | 连接/网站/阅读层次、独立网站开关、保留原有控制行为 |
| `apps/extension/entrypoints/options/App.tsx` | 连接与配对分组、等待反馈、错误处理及 Enter 配对 |
| `apps/extension/entrypoints/content.tsx` | 以字符串注入统一样式，仅进入 Shadow DOM |
| `apps/extension/src/ui/settings.css` | 插件弹窗与连接页的公共样式 |
| `apps/extension/src/ui/reading.css` | 网页工具、回答、表格、提问、加载、错误与专注阅读样式 |
| `apps/extension/src/ui/Icon.tsx` | 插件 React 图标组件 |
| `apps/extension/src/ui/AttentionToolbar.tsx` | 工具条图标，沿用原有位置管理 |
| `apps/extension/src/ui/AIResultCard.tsx` | 标题栏、片段来源提示、独立滚动正文及操作栏 |
| `apps/extension/src/ui/AskBox.tsx` | 发送操作的主要按钮样式 |
| `apps/extension/src/ui/ChartCard.tsx` | 统一图表颜色和网格细节 |
| `apps/extension/src/ui/FocusReader.tsx` | 关闭图标、可滚动正文键盘入口、焦点约束和 Esc |
| `tools/ui-preview/index.html` | 本机预览入口 |
| `tools/ui-preview/main.tsx` | 真实组件与原创模拟数据、独立 Shadow DOM 预览 |
| `tools/ui-preview/preview.css` | 演示容器与界面切换样式 |
| `tools/ui-preview/vite.config.ts` | 仅监听回环地址的预览配置 |
| `tools/ui-preview/tsconfig.json` | 独立预览及导入组件的类型验证 |
| `scripts/test-ui-refinement.mjs` | 可复现的 UI 浏览器验证与截图 |
| `.gitignore` | 增加本轮 UI 截图目录忽略，保留既有主页改动 |
| `MUST_READ.md` | 同步当前 UI 进度与既有阶段验收边界 |
| 本文 | 设计规范、文件范围、验证结果与复验步骤 |

原有主页代码、依赖锁文件改动及本机讲义均未纳入 UI 修改范围。

## 手动复验

1. 打开本机预览，切换桌面、弹窗、连接页与阅读工具，检查风格与字号。
2. 桌面五页切换，检查安装说明展开、模型设置、交互开关和日志；窗口缩小后内容应可滚动、无横向溢出。
3. 阅读工具切换回答、提问、图表、工具条、专注阅读、加载和失败，检查关闭与键盘操作。
4. 在开发版桌面端与重新加载的生产插件中完成配对，按既有流程启用网站、选文和阅读；首次真实授权与真实 AI 由用户按需执行。
5. 在 Windows 125% / 150% 系统显示缩放下复验文字清晰度、窗口布局和点击手感。
