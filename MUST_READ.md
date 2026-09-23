# FocusUI MUST_READ

> 本文件是FocusUI项目的最高优先级开发说明。任何AI编码助手在阅读、修改、调试或重构项目之前，都必须先完整阅读本文件。
>
> 当当前任务、聊天中的临时要求与本文件冲突时，以用户在当前对话中明确提出的最新要求为准；除此之外，以本文件为准。
>
> 本项目采用逐步Vibe Coding开发。一次只完成一个步骤，当前步骤没有验收通过前，不得提前实现后续步骤。

## 1.项目概述

FocusUI是一个由Windows桌面软件和Chrome浏览器插件共同组成的AI自适应网页交互系统。

系统包含两个主要程序：

1. FocusUI Desktop：Windows桌面软件，最终打包为`.exe`。
2. FocusUI Extension：Chrome浏览器插件，负责在网页中感知用户当前关注的内容，并展示动态交互组件。

项目的核心目标是：

> 让网页界面根据用户当前关注的内容和长期使用习惯，主动提供最合适的交互功能。

FocusUI主要验证四项能力：

1. 当用户关注某段网页内容时，工具条主动出现在内容附近。
2. AI根据当前内容决定应该显示哪些工具。
3. AI可以生成原网页中不存在的新交互，例如“生成图表”。
4. 用户经常使用的工具会逐渐排到更靠前的位置。

## 2.产品核心表达

FocusUI的设计方向可以概括为：

- 从“用户寻找UI”到“UI主动来到用户附近”。
- 从“导航式交互”到“注意力式交互”。
- 从“用户适应界面”到“界面适应用户”。
- 从“固定功能集合”到“根据当前内容选择交互能力”。
- 从“AI直接生成任意网页代码”到“AI在受控组件库中规划界面”。

FocusUI不会声称自己能够真正检测用户视线。

MVP通过以下信号推断用户当前关注的内容：

- 鼠标所在位置。
- 鼠标停留时间。
- 鼠标移动速度。
- 页面滚动状态。
- 元素在视口中的可见程度。
- 用户是否选择了文字。

项目文案中应使用“注意力推断”“关注内容推断”或“交互意图推断”，不要使用“精准眼动检测”。

## 3.MVP演示范围

当前开发目标是最小可运行Demo，不追求完整产品。

MVP必须实现以下功能。

### 3.1普通文章场景

用户将鼠标停留在网页段落上约900毫秒。

段落附近出现工具条：

```text
总结｜解释｜提问｜专注
```

点击“总结”后，显示当前内容摘要。

点击“解释”后，使用更容易理解的语言解释当前内容。

点击“提问”后，出现输入框，用户可以围绕当前内容提问。

点击“专注”后，进入沉浸式阅读模式。

### 3.2数据内容场景

用户将鼠标停留在包含年份、金额、比例或连续数字的数据内容上。

工具条增加：

```text
生成图表
```

点击后，插件从当前内容中提取标签和数值，并生成柱状图或折线图。

例如：

```text
2023年营收为80亿元，2024年营收为105亿元，2025年营收为136亿元。
```

生成结果应包含：

```text
标题：年度营收变化
标签：2023年、2024年、2025年
数值：80、105、136
单位：亿元
```

### 3.3专注阅读场景

用户点击“专注”后：

- 页面背景变暗。
- 当前主要内容进入居中的阅读面板。
- 导航栏、侧边栏和广告不再干扰阅读。
- 用户可以点击关闭按钮或按Esc退出。
- 退出后原网页恢复。
- 不破坏原网页React、Vue或其他前端框架状态。

### 3.4习惯适应场景

系统记录用户在不同内容类型下使用工具的次数。

例如，用户连续多次在数据内容上点击“生成图表”，之后“生成图表”会移动到工具条前面。

MVP使用本地统计完成排序，不训练机器学习模型。

## 4.MVP明确不做的内容

当前阶段禁止主动扩展以下功能：

- 摄像头眼动追踪。
- 自动点赞、自动关注、自动评论。
- 自动发送表单。
- 自动点击原网页中的真实按钮。
- AI直接生成任意HTML。
- AI直接生成任意CSS。
- AI直接生成或执行JavaScript。
- AI操作网页账户。
- 手机端。
- Firefox专项适配。
- Edge专项适配。
- 云端账户系统。
- 多设备同步。
- 强化学习推荐系统。
- 对所有网站的完整兼容。
- 自动重构整个网页。
- 插件商店正式发布。
- 复杂权限系统。
- 复杂数据库。
- 与当前MVP无关的动画和视觉特效。

如果当前步骤不要求某项功能，不得因为“顺手”而提前开发。

## 5.系统架构

系统数据流如下：

```text
用户在网页中移动鼠标、选择文字、停止滚动
                    ↓
Chrome插件Content Script
                    ↓
Attention Engine推断用户关注内容
                    ↓
Semantic Block Resolver寻找完整语义块
                    ↓
Context Extractor提取结构化上下文
                    ↓
Local Policy立即生成本地工具
                    ↓
Background Service Worker
                    ↓
HTTP请求127.0.0.1:17321
                    ↓
FocusUI Desktop本地服务
                    ↓
AI Planner或Tool Executor
                    ↓
Zod校验结构化结果
                    ↓
浏览器插件接收结果
                    ↓
Component Registry选择固定React组件
                    ↓
在网页附近渲染工具条、卡片或图表
```

### 5.1桌面端职责

FocusUI Desktop负责：

- 保存AI API地址。
- 保存AI API Key。
- 保存模型名称。
- 调用AI模型。
- 运行本地HTTP服务。
- 校验AI返回结果。
- 管理插件配对。
- 管理用户习惯数据。
- 保存交互设置。
- 显示运行日志。
- 最终打包为Windows`.exe`。

### 5.2插件端职责

FocusUI Extension负责：

- 监听鼠标、滚动和文本选择。
- 推断用户当前关注的网页内容。
- 查找语义内容块。
- 提取当前内容上下文。
- 显示本地工具。
- 与桌面端通信。
- 渲染工具条、摘要卡片、解释卡片、提问框和图表。
- 实现专注阅读模式。
- 在桌面端离线时提供本地降级能力。

### 5.3共享包职责

`packages/shared`负责保存桌面端和插件端共同使用的：

- TypeScript类型。
- Zod Schema。
- 工具ID。
- 接口请求和响应结构。
- 常量。
- 错误码。

桌面端和插件端不得各自复制一份不同版本的同一数据结构。

## 6.不可违反的架构规则

### 6.1AI只负责规划和生成数据

AI可以决定：

- 当前应该显示哪些工具。
- 工具的显示顺序。
- 摘要内容。
- 解释内容。
- 当前问题的回答。
- 图表标题。
- 图表类型。
- 图表标签和数值。

AI不能决定：

- 执行任意JavaScript。
- 创建任意HTML结构。
- 创建任意CSS规则。
- 点击原网页按钮。
- 提交表单。
- 修改账户设置。
- 读取输入框或密码框。
- 执行系统命令。

核心原则：

```text
AI决定“使用哪个受控组件，以及组件显示什么数据”
程序决定“组件是否允许、如何渲染、能否执行”
```

### 6.2浏览器插件不能保存API Key

API Key只能保存在FocusUI Desktop中。

以下位置禁止出现API Key：

- 浏览器插件源码。
- 插件构建产物。
- `chrome.storage.local`。
- 请求日志。
- Git仓库。
- `.env.example`中的真实值。
- 前端控制台输出。

### 6.3所有AI结果必须校验

AI返回的数据必须经过Zod Schema校验。

校验失败时：

- 不渲染非法结果。
- 记录不包含敏感内容的错误日志。
- 使用本地规则降级。
- 不让插件或桌面端崩溃。

### 6.4插件UI必须使用Shadow DOM

插件插入第三方网页的所有UI必须放在Shadow DOM中。

目标：

- 网页CSS不污染插件UI。
- 插件CSS不污染原网页。
- 网页中已有组件库不会修改插件按钮。
- 插件不依赖目标网站CSS变量。

### 6.5本地服务只监听回环地址

本地服务只能监听：

```text
127.0.0.1:17321
```

禁止监听：

```text
0.0.0.0
```

除非用户在后续明确要求局域网访问。

## 7.推荐技术栈

### 7.1桌面端

- Electron
- TypeScript
- React
- electron-vite
- electron-builder
- Express
- Zod
- electron-store
- nanoid
- 官方或兼容OpenAI接口的JavaScript SDK

最终产物：

```text
FocusUI-Setup-0.1.0.exe
```

### 7.2浏览器插件

- WXT
- TypeScript
- React
- Chrome Manifest V3
- Shadow DOM
- chrome.storage.local
- ECharts
- Zod

### 7.3测试

- Vitest
- 必要时使用简单手动测试页面
- MVP不强制编写复杂端到端测试

### 7.4包管理

项目使用npm workspaces。

禁止在没有必要的情况下同时混用：

- npm
- pnpm
- yarn

## 8.项目目录

```text
focus-ui/
├─package.json
├─package-lock.json
├─tsconfig.base.json
├─README.md
├─MUST_READ.md
├─.gitignore
│
├─apps/
│  ├─desktop/
│  │  ├─package.json
│  │  ├─electron.vite.config.ts
│  │  ├─electron-builder.yml
│  │  ├─src/
│  │  │  ├─main/
│  │  │  │  ├─index.ts
│  │  │  │  ├─window.ts
│  │  │  │  ├─tray.ts
│  │  │  │  ├─ipc.ts
│  │  │  │  ├─store/
│  │  │  │  │  ├─settings-store.ts
│  │  │  │  │  └─preference-store.ts
│  │  │  │  ├─server/
│  │  │  │  │  ├─server.ts
│  │  │  │  │  ├─auth.ts
│  │  │  │  │  ├─middleware.ts
│  │  │  │  │  └─routes/
│  │  │  │  │     ├─health.ts
│  │  │  │  │     ├─pair.ts
│  │  │  │  │     ├─plan.ts
│  │  │  │  │     ├─execute.ts
│  │  │  │  │     ├─events.ts
│  │  │  │  │     └─preferences.ts
│  │  │  │  ├─ai/
│  │  │  │  │  ├─client.ts
│  │  │  │  │  ├─planner.ts
│  │  │  │  │  ├─summarizer.ts
│  │  │  │  │  ├─explainer.ts
│  │  │  │  │  ├─question-answer.ts
│  │  │  │  │  └─chart-extractor.ts
│  │  │  │  └─logger/
│  │  │  │     └─logger.ts
│  │  │  ├─preload/
│  │  │  │  ├─index.ts
│  │  │  │  └─types.d.ts
│  │  │  └─renderer/
│  │  │     ├─index.html
│  │  │     └─src/
│  │  │        ├─main.tsx
│  │  │        ├─App.tsx
│  │  │        ├─pages/
│  │  │        │  ├─StatusPage.tsx
│  │  │        │  ├─AISettingsPage.tsx
│  │  │        │  ├─BehaviorPage.tsx
│  │  │        │  └─LogsPage.tsx
│  │  │        ├─components/
│  │  │        └─styles/
│  │  └─resources/
│  │
│  └─extension/
│     ├─package.json
│     ├─wxt.config.ts
│     ├─entrypoints/
│     │  ├─background.ts
│     │  ├─content.tsx
│     │  ├─popup/
│     │  │  ├─index.html
│     │  │  └─App.tsx
│     │  └─options/
│     │     ├─index.html
│     │     └─App.tsx
│     ├─src/
│     │  ├─attention/
│     │  │  ├─attention-engine.ts
│     │  │  ├─pointer-tracker.ts
│     │  │  └─scroll-tracker.ts
│     │  ├─context/
│     │  │  ├─semantic-block.ts
│     │  │  ├─context-extractor.ts
│     │  │  ├─number-extractor.ts
│     │  │  └─content-classifier.ts
│     │  ├─communication/
│     │  │  ├─desktop-client.ts
│     │  │  └─messages.ts
│     │  ├─policy/
│     │  │  ├─local-policy.ts
│     │  │  └─habit-sorter.ts
│     │  ├─ui/
│     │  │  ├─FocusUIRoot.tsx
│     │  │  ├─AttentionToolbar.tsx
│     │  │  ├─SummaryCard.tsx
│     │  │  ├─ExplanationCard.tsx
│     │  │  ├─AskBox.tsx
│     │  │  ├─ChartCard.tsx
│     │  │  ├─DataTableCard.tsx
│     │  │  ├─FocusReader.tsx
│     │  │  ├─LoadingCard.tsx
│     │  │  └─ErrorCard.tsx
│     │  ├─position/
│     │  │  └─position-manager.ts
│     │  ├─storage/
│     │  │  └─extension-store.ts
│     │  └─styles/
│     └─public/
│
├─packages/
│  └─shared/
│     ├─package.json
│     └─src/
│        ├─index.ts
│        ├─types.ts
│        ├─schemas.ts
│        └─constants.ts
│
├─demo-pages/
│  ├─article.html
│  ├─finance.html
│  ├─dashboard.html
│  └─styles.css
│
└─docs/
   ├─api.md
   ├─architecture.md
   └─demo-script.md
```

目录可以在实际开发中轻微调整，但不能破坏桌面端、插件端和共享包的边界。

## 9.核心数据结构

### 9.1允许的工具

```ts
export const ToolIdSchema = z.enum([
    "summarize",
    "explain",
    "ask",
    "chart",
    "extract",
    "focus"
])
```

### 9.2PageContext

```ts
export type PageContext = {
    url: string
    pageTitle: string
    text: string
    selectedText: string | null
    nearbyHeading: string | null
    contextKind:
        | "text"
        | "numbers"
        | "table"
        | "code"
        | "unknown"
    numericCandidates: Array<{
        label: string
        rawValue: string
        value: number | null
    }>
}
```

约束：

- 正文最多1500个字符。
- 选中文本最多1500个字符。
- 数字候选最多20组。
- 不发送完整网页HTML。
- 不读取输入框。
- 不读取密码框。
- 不读取`contenteditable`区域。
- 不记录用户完整浏览历史。

### 9.3UIPlan

```ts
export const UIPlanSchema = z.object({
    contextType: z.enum([
        "text",
        "numbers",
        "table",
        "code",
        "unknown"
    ]),
    confidence: z.number().min(0).max(1),
    tools: z.array(
        z.object({
            id: ToolIdSchema,
            label: z.string().min(1).max(12),
            reason: z.string().max(100)
        })
    ).max(3)
})
```

### 9.4ChartResult

```ts
export const ChartResultSchema = z.object({
    title: z.string().max(100),
    chartType: z.enum(["bar", "line", "pie"]),
    labels: z.array(z.string()).min(2).max(20),
    values: z.array(z.number()).min(2).max(20),
    unit: z.string().max(20).nullable()
})
```

额外验证：

- `labels.length === values.length`。
- 所有数值必须是有限数字。
- 返回数值应能在原文数字候选中找到。
- 无法建立明确对应关系时不得生成图表。
- MVP优先支持`bar`和`line`。

## 10.本地接口

桌面端监听：

```text
http://127.0.0.1:17321
```

接口：

```text
GET  /health
POST /v1/pair
POST /v1/plan
POST /v1/execute
POST /v1/events
GET  /v1/preferences
POST /v1/preferences/reset
```

### 10.1健康检查

```http
GET /health
```

返回：

```json
{
  "ok": true,
  "service": "focusui-desktop",
  "version": "0.1.0",
  "aiConfigured": false
}
```

### 10.2插件配对

```http
POST /v1/pair
```

请求：

```json
{
  "pairingToken": "FUI-H8K2-PQ9M"
}
```

返回：

```json
{
  "ok": true,
  "clientToken": "随机客户端令牌"
}
```

其他`/v1`接口必须携带：

```http
Authorization: Bearer clientToken
```

### 10.3规划工具

```http
POST /v1/plan
```

输入当前`PageContext`，返回经过Schema校验的`UIPlan`。

### 10.4执行工具

```http
POST /v1/execute
```

支持：

```text
summarize
explain
ask
chart
extract
```

`focus`优先由插件本地执行，不需要AI。

### 10.5记录事件

```http
POST /v1/events
```

示例：

```json
{
  "eventType": "tool_clicked",
  "contextType": "numbers",
  "toolId": "chart"
}
```

## 11.Attention Engine基础规则

默认触发条件：

```text
同一语义内容块保持稳定
停留时间超过900毫秒
鼠标速度低于0.25px/ms
滚动停止超过500毫秒
元素可见比例超过60%
```

必须排除：

```text
input
textarea
select
button
密码框
contenteditable区域
插件自身元素
导航栏
页脚
文本长度少于20个字符的元素
覆盖页面大部分区域的大型容器
```

支持的语义块：

```text
table
tr
pre
blockquote
li
p
article
section
div
```

冷却规则：

- 同一元素30秒内不重复自动弹出。
- 快速移动鼠标时不触发。
- 页面滚动过程中不触发。
- 用户离开元素后重置计时。
- 页面切换后取消旧请求。
- 同一时刻只保留一个活动工具条。

## 12.本地工具策略

AI请求之前，插件应立即显示本地工具。

默认规则：

| 内容类型 | 默认工具 |
|---|---|
| text | 总结、解释、提问 |
| numbers | 生成图表、解释、提取数据 |
| table | 生成图表、提取数据、总结 |
| code | 解释、提问 |
| unknown | 总结、提问 |
| 长文章 | 专注、总结 |

正确流程：

```text
用户停留
↓
插件本地判断内容类型
↓
本地工具立即出现
↓
后台请求桌面端AI规划
↓
AI结果通过Schema校验
↓
轻量调整工具顺序或增加工具
```

桌面端离线或AI失败时，本地工具仍然可用。

## 13.用户习惯排序

桌面端保存：

```ts
type PreferenceState = {
    globalToolCount: Record<string, number>
    contextToolCount: Record<
        string,
        Record<string, number>
    >
    pinnedTools: string[]
}
```

基础排序规则：

```text
工具得分=
当前内容类型使用次数×0.7+
全局使用次数×0.3
```

约束：

- 使用不足三次时不改变默认顺序。
- 每次最多移动一个位置。
- 当前内容类型权重大于全局使用次数。
- 固定工具优先。
- 用户可以清除习惯数据。
- 不允许工具顺序在每次打开时剧烈变化。

## 14.桌面软件界面范围

桌面软件只需要四个页面。

### 14.1运行状态

显示：

- 本地服务状态。
- 服务地址。
- 应用版本。
- AI是否配置。
- 插件是否连接。
- 插件最后连接时间。

### 14.2AI设置

包含：

- API地址。
- API Key。
- 模型名称。
- 保存按钮。
- 测试连接按钮。

API Key默认隐藏。

### 14.3交互设置

包含：

- 鼠标停留时间。
- 是否启用AI推荐。
- 是否启用本地工具。
- 是否启用专注模式。
- 是否启用习惯学习。
- 清除习惯数据。

### 14.4调试日志

只显示最近100条日志。

允许记录：

- 服务启动。
- 插件配对。
- 插件请求。
- AI调用成功。
- AI调用失败。
- Schema校验失败。
- 工具执行。

禁止记录：

- API Key。
- clientToken。
- pairingToken完整值。
- 完整网页正文。
- 密码框内容。
- 输入框内容。

## 15.Vibe Coding总规则

任何AI编码助手必须遵守以下规则。

### 15.1任务范围

1. 一次只完成用户指定的当前步骤。
2. 不得提前实现后续步骤。
3. 不得因为当前功能相关而顺便增加复杂功能。
4. 当前步骤未通过验收前，不进入下一步。
5. 如果一步需要修改超过8个文件，应优先拆分为子步骤。
6. 如果用户明确要求一次完成更多内容，以用户最新要求为准。

### 15.2修改前必须执行

开始修改前，AI必须：

1. 阅读`MUST_READ.md`。
2. 查看当前项目目录。
3. 阅读与当前步骤有关的文件。
4. 确认现有实现是否已经完成部分功能。
5. 说明计划修改哪些文件。
6. 不重复实现已经存在并正常工作的代码。
7. 不假设文件内容，必须先查看。

### 15.3编码要求

1. 使用TypeScript。
2. 尽量避免`any`。
3. 确实需要使用`any`时，必须说明原因。
4. 所有接口输入和输出必须有类型。
5. 所有外部输入必须进行校验。
6. AI响应必须使用Zod校验。
7. 异步操作必须有错误处理。
8. 网络请求必须处理超时。
9. 不允许吞掉错误。
10. 不允许只写空`catch`。
11. 不允许在插件中保存API Key。
12. 不允许使用模型生成的HTML直接赋值给`innerHTML`。
13. 不允许执行模型生成代码。
14. 不允许为了方便关闭Electron安全设置。
15. Renderer中保持`nodeIntegration: false`。
16. Renderer中保持`contextIsolation: true`。
17. 桌面端IPC通过Preload暴露最小API。
18. 插件UI使用Shadow DOM。
19. 不进行当前步骤以外的大规模重构。
20. 新增依赖前必须说明用途。
21. 能使用平台原生API时，不随意增加大型依赖。
22. 不修改与当前任务无关的配置。
23. 不删除现有测试。
24. 不用临时硬编码掩盖真实问题。
25. Demo固定数据只能出现在明确的Demo页面或测试中。

### 15.4安全要求

1. 本地服务仅监听`127.0.0.1`。
2. `/v1`接口必须鉴权。
3. 插件通过配对令牌换取客户端令牌。
4. 日志中禁止输出密钥。
5. 禁止读取密码框。
6. 禁止读取输入框。
7. 禁止发送完整网页。
8. 禁止自动操作网页账户。
9. 禁止执行远程代码。
10. 所有动态UI都必须可关闭。
11. 所有网页变化都必须可撤销。
12. AI不可用时必须安全降级。

### 15.5完成后必须执行

每一步完成后，AI必须：

1. 运行类型检查。
2. 运行当前模块已有测试。
3. 运行必要的构建命令。
4. 根据当前步骤给出手动验收方法。
5. 列出所有新增和修改的文件。
6. 说明每个文件的作用。
7. 列出执行过的命令。
8. 给出测试结果。
9. 说明仍然存在的问题。
10. 明确说明是否满足当前步骤验收标准。
11. 不自动进入下一步。

## 16.每轮任务固定提示词

开始任何新步骤时，使用以下提示词：

```text
请继续开发FocusUI项目。

开始编码前必须完整阅读项目根目录中的MUST_READ.md。

当前只执行：
第X步：步骤名称

请先完成以下工作：
1.查看当前项目目录。
2.阅读与本步骤相关的已有文件。
3.判断本步骤是否已有部分实现。
4.列出准备新增或修改的文件。
5.说明本轮不会提前实现哪些后续功能。

然后完成当前步骤。

开发规则：
1.不要重写已经正常工作的模块。
2.不要进行与当前步骤无关的大规模重构。
3.桌面端和插件共享的数据结构放入packages/shared。
4.所有外部输入和AI输出必须校验。
5.所有异步操作必须处理错误。
6.不要在浏览器插件中保存AI API Key。
7.不要让AI生成或执行任意HTML、CSS和JavaScript。
8.插件插入网页的界面必须使用Shadow DOM。
9.本轮最多修改8个文件；超过时先拆分子步骤。
10.当前步骤未通过验收前不要进入下一步。

完成后必须输出：
1.新增了哪些文件。
2.修改了哪些文件。
3.每个文件完成了什么。
4.执行了哪些命令。
5.类型检查结果。
6.测试结果。
7.手动验收方法。
8.当前遗留问题。
9.是否满足当前步骤验收标准。

不要进入第X+1步。
```

## 17.错误修复提示词

遇到错误时，向AI提供：

```text
当前执行：
第X步：步骤名称

我执行的命令：
粘贴命令

我执行的操作：
描述操作过程

期望结果：
描述期望

实际结果：
描述实际结果

终端完整输出：
粘贴完整输出

Electron控制台：
粘贴完整错误

Chrome扩展Service Worker控制台：
粘贴完整错误

网页控制台：
粘贴完整错误

相关文件：
列出文件路径

请先定位根因，只修复当前错误。
不要提前实现后续功能。
不要通过删除功能、关闭类型检查或写死返回值掩盖问题。
修复后说明根因、修改文件、验证命令和结果。
```

不要只说“运行不了”“有报错”“页面不显示”。

## 18.Git工作流

每完成一个步骤并验收通过后提交一次Git。

建议格式：

```bash
git add .
git commit -m "完成第X步：步骤名称"
```

修复步骤中的问题可以使用：

```bash
git add .
git commit -m "修复第X步：问题描述"
```

进入下一步前建议确认：

```bash
git status
```

工作区应保持干净。

禁止让AI一次完成大量步骤后统一提交。

## 19.开发计划总览

开发顺序分为六个阶段。

### 阶段一：建立双端工程基础

1. 创建Monorepo项目骨架。
2. 创建Electron桌面程序基础窗口。
3. 建立桌面端IPC通信。
4. 创建本地Express服务。
5. 建立桌面设置存储。
6. 完成桌面端基础设置界面。
7. 实现插件配对和请求鉴权。
8. 创建Chrome插件基础工程。
9. 打通插件和桌面端通信。

### 阶段二：完成网页感知和基础UI

10. 实现Content Script和Shadow DOM根节点。
11. 实现语义内容块识别。
12. 实现Attention Engine。
13. 实现上下文提取和本地分类。
14. 实现悬浮工具条和位置管理。
15. 实现本地降级工具。

### 阶段三：接入AI功能

16. 接入AI规划接口。
17. 实现总结功能。
18. 实现解释和提问功能。
19. 实现数据提取和图表功能。

### 阶段四：完成自适应能力

20. 实现专注阅读模式。
21. 实现用户习惯排序。

### 阶段五：完善桌面体验和测试

22. 完成桌面托盘和后台运行。
23. 完成日志和错误处理。
24. 制作三个固定Demo页面。
25. 增加自动化测试。

### 阶段六：打包和验收

26. 完成生产构建。
27. 完成最终集成测试。

## 20.逐步开发计划

## 第一步：创建Monorepo项目骨架

### 目标

建立根目录、npm workspaces、桌面端目录、插件端目录和共享包。

### 必须完成

- 创建`apps/desktop`。
- 创建`apps/extension`。
- 创建`packages/shared`。
- 创建`demo-pages`。
- 创建`docs`。
- 创建根目录`package.json`。
- 配置npm workspaces。
- 创建`tsconfig.base.json`。
- 创建`.gitignore`。
- 共享包导出一个测试类型。

### 禁止提前完成

- Electron窗口。
- 浏览器插件功能。
- 本地HTTP服务。
- AI接口。

### 验收

- `npm install`成功。
- npm识别三个workspace。
- `npm run typecheck`能够执行。
- 共享包可以被其他workspace引用。

## 第二步：创建Electron桌面程序基础窗口

### 目标

桌面程序能够启动并显示React窗口。

### 必须完成

- 使用Electron、electron-vite、React和TypeScript。
- 窗口默认尺寸960×680。
- 最小尺寸760×520。
- 显示“FocusUI Desktop”。
- 显示“本地服务：尚未启动”。
- 开启`contextIsolation`。
- 关闭`nodeIntegration`。

### 验收

- `npm run dev:desktop`可以启动。
- 窗口显示正常。
- 关闭后进程正常退出。
- 开发者工具无阻断性错误。

## 第三步：建立桌面端IPC通信

### 目标

Renderer安全读取应用版本和运行状态。

### 必须完成

Preload暴露：

```ts
window.focusUI.getAppInfo()
```

返回：

```ts
{
    version: string
    platform: string
    serviceRunning: boolean
}
```

### 验收

- Renderer不能直接访问`require`。
- 能显示应用版本。
- 能显示平台信息。
- TypeScript识别`window.focusUI`。

## 第四步：创建本地Express服务

### 目标

桌面软件启动后运行本地HTTP服务。

### 必须完成

- 监听`127.0.0.1:17321`。
- 实现`GET /health`。
- 支持启动和停止服务。
- 防止重复启动。
- 处理端口占用。
- 服务状态同步到Renderer。

### 验收

访问：

```text
http://127.0.0.1:17321/health
```

能够看到正确JSON。

关闭桌面软件后端口释放。

## 第五步：建立桌面设置存储

### 目标

使用`electron-store`保存设置。

### 设置结构

```ts
type AppSettings = {
    apiBaseUrl: string
    apiKey: string
    modelName: string
    attentionDelayMs: number
    enableAI: boolean
    enableLocalTools: boolean
    enableFocusMode: boolean
    enableHabitLearning: boolean
}
```

### 必须完成

- `getSettings`。
- `updateSettings`。
- `resetSettings`。
- 默认停留时间900毫秒。
- 停留时间限制300到3000毫秒。
- API Key默认隐藏。
- Renderer不能直接访问配置文件。

### 验收

重启应用后设置仍然存在。

## 第六步：完成桌面端基础设置界面

### 目标

完成四个基础页面。

### 页面

- 运行状态。
- AI设置。
- 交互设置。
- 调试日志。

### 验收

- 页面可切换。
- 设置可保存。
- 重启后仍然存在。
- 窗口缩小时无明显溢出。

## 第七步：实现插件配对和请求鉴权

### 目标

防止任意本机网页调用FocusUI接口。

### 必须完成

- 生成`pairingToken`。
- 正确配对后返回`clientToken`。
- `/v1`接口验证Bearer Token。
- 错误配对返回401。
- 重新生成配对令牌后旧令牌失效。
- CORS仅允许插件来源和明确的开发来源。

### 验收

- 正确令牌配对成功。
- 错误令牌失败。
- 缺少鉴权访问受保护接口失败。

## 第八步：创建Chrome插件基础工程

### 目标

插件可以被Chrome开发者模式加载。

### 必须完成

- 使用WXT、React、TypeScript和Manifest V3。
- 创建Popup。
- 创建Options。
- 保存桌面服务地址。
- 保存配对令牌输入。
- 权限仅申请当前需要的范围。

### 验收

- 插件加载成功。
- Popup打开成功。
- Options打开成功。
- 设置写入`chrome.storage.local`。

## 第九步：打通插件和桌面端通信

### 目标

插件检测桌面端并完成配对。

### 必须完成

Background处理：

```text
CHECK_DESKTOP_HEALTH
PAIR_DESKTOP
```

保存：

```ts
type ExtensionSettings = {
    desktopBaseUrl: string
    clientToken: string | null
    enabled: boolean
}
```

### 验收

- 桌面端运行时显示在线。
- 桌面端关闭时显示离线。
- 正确配对后保存状态。
- 重启Chrome后配对仍存在。

## 第十步：实现Content Script和Shadow DOM根节点

### 目标

在网页中插入隔离UI。

### 必须完成

- 创建唯一宿主节点。
- 创建Shadow Root。
- 创建React Root。
- 显示测试按钮。
- 防止重复注入。
- 插件关闭后卸载根节点。

### 验收

- 三个测试网页中样式基本一致。
- 页面刷新后只有一个根节点。
- 插件关闭后根节点消失。

## 第十一步：实现语义内容块识别

### 目标

识别完整段落、表格或代码块。

### 必须完成

- 使用`elementFromPoint`。
- 使用`closest`寻找语义块。
- 过滤无效元素。
- 提取文本。
- 开发模式下高亮目标块。

### 验收

- 鼠标位于`span`时可找到父级`p`。
- 不选择`body`。
- 不选择超大容器。
- 不选择输入框、按钮或插件自身元素。

## 第十二步：实现Attention Engine

### 目标

稳定停留后触发关注事件。

### 必须完成

监听：

```text
pointermove
scroll
selectionchange
```

计算：

- 当前语义块。
- 停留时间。
- 鼠标速度。
- 滚动停止时间。

加入冷却和重置逻辑。

### 验收

- 停留达到阈值后只触发一次。
- 快速划过不触发。
- 滚动时不触发。
- 离开元素后计时重置。
- 同一元素不连续弹出。

## 第十三步：实现上下文提取和本地分类

### 目标

生成统一`PageContext`。

### 必须完成

提取：

- URL。
- 页面标题。
- 内容文本。
- 选中文本。
- 附近标题。
- 数字候选。
- 内容类型。

本地分类：

```text
table元素→table
pre或code→code
多个数字→numbers
其他→text
```

### 验收

- 控制台可看到结构化上下文。
- 文本长度受限。
- 不发送完整HTML。
- 不读取输入框。

## 第十四步：实现悬浮工具条和位置管理

### 目标

在目标内容附近显示工具条。

### 必须完成

- `AttentionToolbar`。
- `position-manager`。
- 右侧优先。
- 右侧不足时左侧。
- 左右不足时下方。
- 不超出视口。
- 支持关闭和Esc。
- 支持滚动后关闭或重新定位。

### 验收

- 页面不同区域都能正确显示。
- 缩放窗口后不超出屏幕。
- 工具条不被网页遮挡。
- 不遮挡鼠标位置。

## 第十五步：实现本地降级工具

### 目标

没有桌面端或AI时仍可用。

### 必须完成

- 根据内容类型生成本地工具。
- 桌面端离线时显示明确提示。
- 专注模式可在本地运行。
- 网络错误不导致插件崩溃。

### 验收

关闭桌面端后工具条仍能出现。

## 第十六步：接入AI规划接口

### 目标

AI规划当前工具。

### 必须完成

- 桌面端实现`POST /v1/plan`。
- 输入和输出使用Zod校验。
- AI失败时返回本地规划。
- 插件先显示本地工具，再异步更新。
- 非法工具ID被拒绝。

### 验收

- 普通文本推荐总结或解释。
- 数字内容可推荐图表。
- AI失败时本地工具保留。

## 第十七步：实现总结功能

### 目标

点击总结后显示摘要卡片。

### 必须完成

- `toolId=summarize`。
- 加载状态。
- 成功卡片。
- 错误卡片。
- 关闭功能。
- 短期缓存。

### 验收

- 点击后立即显示加载状态。
- 成功后显示摘要。
- 失败后显示错误。
- 重复内容短时间内使用缓存。

## 第十八步：实现解释和提问功能

### 目标

完成解释与围绕当前内容提问。

### 必须完成

- `toolId=explain`。
- `toolId=ask`。
- AskBox输入框。
- 空问题禁止发送。
- 防止并发混乱。
- 回答仅围绕当前内容。

### 验收

解释和提问都可以稳定返回结果。

## 第十九步：实现数据提取和图表功能

### 目标

完成MVP最关键的“生成图表”。

### 必须完成

- 实现`ChartResultSchema`。
- 验证标签和值长度一致。
- 验证数字来源。
- 使用ECharts。
- 支持柱状图和折线图。
- 无法正确对应时拒绝生成。

### 验收

在`finance.html`中：

- 年份和数值对应正确。
- 柱状图正常显示。
- 折线图正常显示。
- 单位正确。
- 错误数据不会被渲染。

## 第二十步：实现专注阅读模式

### 目标

进入可撤销的阅读面板。

### 必须完成

- 全屏遮罩。
- 居中阅读容器。
- 标题和正文。
- 关闭按钮。
- Esc退出。
- 禁止背景滚动。
- 退出后恢复滚动。
- 不直接删除原网页DOM。

### 验收

多次进入和退出不会破坏原网页。

## 第二十一步：实现用户习惯排序

### 目标

工具顺序随使用习惯轻量变化。

### 必须完成

记录：

- 工具ID。
- 内容类型。
- 点击次数。
- 最后使用时间。

实现：

- 三次以上才改变顺序。
- 每次最多移动一个位置。
- 内容类型偏好高于全局偏好。
- 支持清除习惯数据。

### 验收

连续使用图表三次后，数据场景中的工具顺序发生变化。

## 第二十二步：完成桌面托盘和后台运行

### 目标

关闭窗口后服务继续运行。

### 必须完成

托盘菜单：

```text
打开FocusUI
启动服务
停止服务
退出
```

### 验收

- 隐藏窗口后服务仍可用。
- 托盘可重新打开窗口。
- 点击退出后端口释放。
- 不产生重复托盘图标。

## 第二十三步：完成日志和错误处理

### 目标

方便调试和比赛现场排障。

### 必须完成

- `info`日志。
- `warning`日志。
- `error`日志。
- 最多保存最近100条。
- 不记录敏感内容。
- 错误不导致应用退出。

### 验收

AI失败时有日志，日志中不存在密钥。

## 第二十四步：制作三个固定Demo页面

### 目标

建立稳定演示环境。

### 必须完成

`article.html`：

- 标题。
- 多段正文。
- 专业术语段落。
- 导航栏。
- 侧边栏。
- 广告占位。

`finance.html`：

- 年度营收。
- 季度利润。
- 用户增长率。
- HTML表格。
- 数字段落。

`dashboard.html`：

- 数据卡片。
- 侧边菜单。
- 无关按钮。
- 主要内容区。

### 验收

三个页面可以本地打开并覆盖主要演示流程。

## 第二十五步：增加自动化测试

### 目标

保护核心逻辑。

### 至少测试

- `UIPlanSchema`。
- `ChartResultSchema`。
- 语义块过滤。
- 内容分类。
- 习惯排序。
- 鉴权中间件。
- 设置边界值。

### 验收

- `npm test`能够执行。
- 非法工具ID测试失败。
- 图表长度不一致测试失败。
- 设置越界测试失败。

## 第二十六步：完成生产构建

### 目标

生成Windows安装程序和插件压缩包。

### 必须完成

桌面端输出：

```text
FocusUI-Setup-0.1.0.exe
```

插件输出：

```text
focusui-extension.zip
```

应用信息：

```text
产品名称：FocusUI
应用ID：com.focusui.desktop
版本：0.1.0
```

### 验收

- `.exe`可以安装。
- 桌面软件可以启动。
- 本地服务可以启动。
- 插件可以加载。
- 插件能连接打包后的桌面软件。

## 第二十七步：最终集成测试

### 测试顺序

1. 安装FocusUI Desktop。
2. 启动桌面软件。
3. 填写AI配置。
4. 测试AI连接。
5. 复制配对令牌。
6. 加载Chrome插件。
7. 完成配对。
8. 打开`article.html`。
9. 停留在段落。
10. 点击总结。
11. 点击解释。
12. 使用提问。
13. 进入专注模式。
14. 打开`finance.html`。
15. 停留在数据内容。
16. 生成图表。
17. 连续使用图表三次。
18. 检查工具顺序变化。
19. 关闭桌面软件。
20. 检查插件降级提示。
21. 重新启动桌面软件。
22. 检查连接恢复。

### 最终验收

- 完整流程无阻断性错误。
- 每个异步操作都有加载或错误反馈。
- AI失败不导致插件崩溃。
- 所有界面变化可以关闭。
- 桌面端退出后端口释放。
- 图表数据正确。
- API Key未进入插件。
- AI结果全部经过Schema校验。

## 21.当前步骤记录

每次开始新步骤时更新本节。

```text
当前步骤：0.2 阶段 A，学生真实场景基线与 PDF 技术验证
当前子步骤：工程验证已完成，真实学生资料与人工场景验收待补
当前状态：阶段 A 工程检查通过，等待人工验收；0.1.0 Beta 已完成并归档
当前负责人：AI编码助手开发与验证；项目团队人工验收
上一步提交：8b1f240；稳定基线：v0.1.0-beta；开发分支：codex/v0.2-real-world
当前遗留问题：真实课程 PDF、正式插件接入与长文档边界待验证；详见 docs/validation/v0.2-stage-a.md
```

完成步骤后更新：

```text
当前步骤：第X步
当前状态：已完成并验收
对应Git提交：提交哈希或提交说明
遗留问题：无或具体问题
下一步：第X+1步
```

AI不得只依靠本节判断项目状态，必须同时检查真实代码和Git状态。

## 22.开发优先级

### 必须完成

- Electron桌面程序。
- 本地HTTP服务。
- 插件配对。
- 浏览器插件连接。
- Attention Engine。
- 语义内容块识别。
- 悬浮工具条。
- 总结。
- 解释。
- 生成图表。
- 专注模式。
- Windows`.exe`打包。

### 时间不足时可以简化

- 提问功能。
- 托盘功能。
- 日志页面视觉效果。
- 复杂习惯排序。
- 插件Popup美化。
- 动画。
- 自定义主题。
- 饼图。

### 不得牺牲的核心链路

```text
用户关注内容
↓
插件提取上下文
↓
桌面端调用AI
↓
返回受控UI计划或工具结果
↓
插件渲染固定组件
```

## 23.最终MVP验收清单

### 桌面端

- 可以打包为`.exe`。
- 可以保存AI设置。
- 可以启动本地服务。
- 可以与插件配对。
- 可以调用AI。
- 可以校验AI结果。
- 可以保存用户偏好。
- 可以显示基础日志。

### 浏览器插件

- 可以识别关注内容。
- 可以显示动态工具条。
- 可以连接桌面端。
- 可以展示摘要。
- 可以展示解释。
- 可以围绕内容提问。
- 可以生成图表。
- 可以进入专注模式。
- 桌面端离线时可以降级。

### 安全性

- API Key不进入插件。
- 本地服务仅监听`127.0.0.1`。
- `/v1`接口需要鉴权。
- AI不能生成或执行任意代码。
- 所有AI结果经过Schema验证。
- 不读取密码框和输入框。
- 不发送完整网页。
- 所有动态界面可以关闭。
- 所有网页变化可以撤销。

### 演示稳定性

- `article.html`正常。
- `finance.html`正常。
- `dashboard.html`正常。
- 完整演示流程控制在90秒左右。
- AI失败时有可展示的本地降级结果。
- 图表数据正确率优先于界面美观。

## 24.比赛演示顺序

### 第一阶段：注意力触发

打开文章页面。

鼠标停留在段落上，工具条出现。

说明：

```text
传统网页需要用户主动寻找按钮。FocusUI通过鼠标停留、滚动状态和文本选择推断用户当前关注的内容，并把相关操作直接送到内容附近。
```

### 第二阶段：内容理解

点击“总结”和“解释”。

展示当前内容对应的AI卡片。

### 第三阶段：生成新交互

打开财经页面。

停留在数据上，出现“生成图表”。

说明：

```text
生成图表并不是原网页提供的功能。FocusUI理解当前内容后，从受控组件库中选择了一个新的交互组件。
```

### 第四阶段：动态重构

点击“专注”，进入阅读面板。

说明：

```text
FocusUI可以根据当前任务调整信息展示，降低无关内容干扰。
```

### 第五阶段：桌面端和隐私

展示桌面端：

- AI配置。
- 插件连接状态。
- 本地服务状态。
- 使用日志。

说明：

```text
浏览器插件负责感知和交互，桌面软件负责AI调用、隐私控制和用户偏好。API Key不会进入浏览器插件。
```

### 第六阶段：习惯适应

展示多次使用图表后工具顺序变化。

说明：

```text
FocusUI不仅适应当前内容，也会在本地学习用户长期的工具使用习惯。
```

## 25.给AI的最终提醒

在修改任何代码之前，再次确认：

- 已经阅读本文件。
- 已经查看真实目录。
- 已经阅读相关文件。
- 当前只处理一个步骤。
- 没有提前开发后续功能。
- 没有在插件中保存API Key。
- 没有让AI输出任意可执行网页代码。
- 没有关闭Electron安全设置。
- 已计划运行类型检查和测试。
- 已明确当前步骤的验收标准。

FocusUI的第一目标是做出稳定、可演示、能说明核心思想的MVP。

不要为了“功能看起来更多”，牺牲核心链路的稳定性。
