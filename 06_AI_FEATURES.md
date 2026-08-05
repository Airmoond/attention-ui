# 模块六：AI规划与工具执行

> 对应总开发计划第16至19步。
>
> 本模块完成后，FocusUI应能根据当前网页内容规划工具，并执行总结、解释、提问、数据提取和图表生成。
>
> 所有AI输出必须是受控结构化数据，禁止生成或执行任意网页代码。

## 一、模块目标

完成AI主链路：

```text
插件提取PageContext
↓
Background发送桌面端
↓
桌面端调用模型
↓
Zod校验
↓
返回UIPlan或工具结果
↓
插件渲染固定组件
```

必须实现：

- `/v1/plan`。
- `/v1/execute`。
- AI客户端。
- 结构化输出。
- 本地降级。
- 摘要卡片。
- 解释卡片。
- AskBox。
- 图表卡片。
- 请求缓存和并发控制。

## 二、前置条件

模块五已完成：

- 工具条可显示。
- PageContext可生成。
- Background与桌面端通信正常。
- 本地工具可以降级。
- Component UI基础存在。

桌面端已经配置：

- API地址。
- API Key。
- 模型名称。

## 三、主要目录

桌面端：

```text
apps/desktop/src/main/
├─ai/
│  ├─client.ts
│  ├─planner.ts
│  ├─summarizer.ts
│  ├─explainer.ts
│  ├─question-answer.ts
│  └─chart-extractor.ts
└─server/routes/
   ├─plan.ts
   └─execute.ts
```

插件：

```text
apps/extension/src/
├─communication/
│  └─desktop-client.ts
└─ui/
   ├─SummaryCard.tsx
   ├─ExplanationCard.tsx
   ├─AskBox.tsx
   ├─ChartCard.tsx
   ├─DataTableCard.tsx
   ├─LoadingCard.tsx
   └─ErrorCard.tsx
```

共享：

```text
packages/shared/src/
├─types.ts
├─schemas.ts
└─constants.ts
```

## 四、AI客户端

### 配置来源

只从桌面端设置存储读取：

- `apiBaseUrl`。
- `apiKey`。
- `modelName`。

禁止从插件请求中接收API Key。

### 客户端要求

- 请求超时。
- 统一错误类型。
- 不输出密钥。
- 支持测试连接。
- 模型名称为空时拒绝调用。
- API Key为空时返回明确配置错误。
- 不自动无限重试。
- MVP最多重试一次可恢复网络错误。

### 错误分类

建议：

```text
AI_NOT_CONFIGURED
AI_TIMEOUT
AI_AUTH_FAILED
AI_RATE_LIMITED
AI_INVALID_RESPONSE
AI_PROVIDER_ERROR
```

## 五、子步骤1：AI规划接口

### 接口

```http
POST /v1/plan
```

请求：

```ts
type PlanRequest = {
    pageContext: PageContext
}
```

返回：

```ts
type PlanResponse = {
    source: "ai" | "local"
    plan: UIPlan
}
```

### UIPlan Schema

```ts
const UIPlanSchema = z.object({
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

### 规划提示词原则

模型任务：

- 根据当前内容选择最多三个工具。
- 只能从白名单选择。
- 不能返回HTML、CSS或JavaScript。
- 没有明确数字关系时不推荐图表。
- 短文本不推荐专注模式。
- 无法判断时降低置信度。

### 插件更新流程

```text
先显示本地工具
↓
请求AI规划
↓
校验结果
↓
只进行轻量排序或替换
```

避免工具条大幅跳动。

### 降级

AI失败时返回本地规划结果：

```json
{
  "source": "local",
  "plan": {
    "contextType": "text",
    "confidence": 0.5,
    "tools": []
  }
}
```

实际工具可以由本地策略补充。

### 验收标准

- 普通文本推荐总结或解释。
- 数字内容可推荐图表。
- 非法工具ID被拒绝。
- AI失败时本地工具保留。
- 插件不会因为AI响应慢而无UI。

## 六、子步骤2：总结功能

### 请求

```http
POST /v1/execute
```

```json
{
  "toolId": "summarize",
  "pageContext": {},
  "question": null
}
```

### 输出

建议结构：

```ts
type TextToolResult = {
    type: "text"
    content: string
}
```

### 提示词要求

- 只总结当前提供内容。
- 不补充外部事实。
- 最多150个中文字符左右。
- 内容不足时明确说明。
- 保留关键数字和结论。

### 插件UI

实现：

- 点击后立即显示`LoadingCard`。
- 成功后显示`SummaryCard`。
- 失败后显示`ErrorCard`。
- 可以关闭。
- 同一内容短期缓存。

### 缓存

建议Key：

```text
toolId + contextHash + modelName
```

缓存只保存在内存或受控本地存储。

不要缓存敏感输入。

### 验收标准

- 加载状态及时出现。
- 摘要与当前内容一致。
- 错误可理解。
- 重复点击不会重复调用。
- 页面切换后旧结果不会覆盖新页面。

## 七、子步骤3：解释功能

### 目标

用更简单、准确的语言解释当前内容。

### 提示词要求

- 先解释主旨。
- 必要时解释专业术语。
- 不脱离原文扩展。
- 不使用虚构比喻替代专业含义。
- 控制长度。
- 对代码内容可以解释结构和逻辑，但不自动修改代码。

### 输出

沿用：

```ts
type TextToolResult = {
    type: "text"
    content: string
}
```

### 验收标准

- 解释与当前段落相关。
- 专业术语有清晰定义。
- 不添加不存在的事实。
- 可以关闭和重新执行。

## 八、子步骤4：提问功能

### 请求

```json
{
  "toolId": "ask",
  "pageContext": {},
  "question": "用户问题"
}
```

### 输入限制

- 问题不能为空。
- 问题长度限制。
- 同一AskBox一次只允许一个活动请求。
- 新请求可以取消或等待旧请求完成。
- 不读取网页输入框作为问题。

### 回答要求

- 仅根据提供的当前内容回答。
- 内容不足时明确说无法从当前内容确定。
- 不假装访问了未提供网页部分。
- 可以引用短片段，但不输出大段原文。

### 验收标准

- 空问题不能发送。
- 加载状态正确。
- 并发状态不会混乱。
- 切换关注块后旧回答不会错位显示。

## 九、子步骤5：数据提取

### 目标

从表格或数字段落中提取结构化数据。

输出建议：

```ts
const ExtractResultSchema = z.object({
    type: z.literal("table"),
    title: z.string().max(100),
    columns: z.array(z.string()).min(1).max(10),
    rows: z.array(
        z.array(z.union([z.string(), z.number(), z.null()]))
    ).max(50)
})
```

### 约束

- 不补造不存在的数据行。
- 数值与原文候选比对。
- 表格过大时只取最相关部分。
- 不提取隐藏输入值。
- 不读取表单。

## 十、子步骤6：图表生成

### ChartResult Schema

```ts
const ChartResultSchema = z.object({
    title: z.string().max(100),
    chartType: z.enum(["bar", "line", "pie"]),
    labels: z.array(z.string()).min(2).max(20),
    values: z.array(z.number()).min(2).max(20),
    unit: z.string().max(20).nullable()
})
```

额外验证：

```text
labels.length === values.length
所有值为有限数字
数值可在原文候选中找到
标签与数值关系明确
```

无法建立对应关系时返回：

```ts
type ChartUnavailableResult = {
    type: "unavailable"
    reason: string
}
```

不要为了展示图表而猜测数据。

### ECharts

MVP优先支持：

```text
bar
line
```

饼图可保留Schema，但可以不作为比赛主演示。

### ChartCard

需要：

- 标题。
- 图表区域。
- 单位。
- 数据来源提示。
- 关闭按钮。
- 容器resize处理。
- 组件卸载时释放ECharts实例。

### 验收标准

在`finance.html`中：

- 标签和值正确对应。
- 柱状图正常。
- 折线图正常。
- 单位正确。
- 非法结果不渲染。
- ECharts实例无明显内存泄漏。

## 十一、请求并发和取消

必须处理：

- 用户快速切换关注块。
- 用户连续点击不同工具。
- 页面导航。
- 插件禁用。
- 桌面端断开。

建议为每次请求附加：

```text
requestId
contextId
```

返回时检查当前活动上下文是否一致。

旧响应不得覆盖新上下文。

## 十二、日志与隐私

允许记录：

- 工具ID。
- 内容类型。
- 请求耗时。
- 成功或失败。
- Schema错误类型。

禁止记录：

- API Key。
- 完整网页正文。
- 用户完整问题。
- 完整模型响应。
- clientToken。

## 十三、禁止事项

- 不执行模型返回代码。
- 不渲染模型返回HTML。
- 不允许模型返回任意组件名。
- 不自动点击网页。
- 不猜测图表数据。
- 不将API Key发到插件。
- 不在错误日志中输出完整请求体。
- 不绕过Zod校验。

## 十四、模块验收清单

- [ ] AI客户端可配置。
- [ ] `/v1/plan`可用。
- [ ] AI规划有本地降级。
- [ ] 总结可用。
- [ ] 解释可用。
- [ ] 提问可用。
- [ ] 数据提取可用。
- [ ] 图表可用。
- [ ] 非法AI结果被拒绝。
- [ ] 请求并发安全。
- [ ] 缓存不会错位。
- [ ] API Key未进入插件。
- [ ] 类型检查和测试通过。

## 十五、交给编码AI的模块提示词

```text
请先完整阅读MUST_READ.md和06_AI_FEATURES.md。

当前只开发模块六中的指定子步骤。
所有AI输出必须经过packages/shared中的Zod Schema校验。
AI只能返回受控工具ID和数据，禁止返回或执行任意HTML、CSS和JavaScript。
API Key只能从桌面端设置存储读取。

请优先保证数据正确和失败降级。
图表数据无法明确对应时必须拒绝生成，不能猜测。
旧请求响应不得覆盖新的关注上下文。

完成后说明使用的提示词、Schema、错误分类、缓存策略和手动测试结果。
```

## 十六、完成报告格式

```text
模块：06_AI_FEATURES
子步骤：
状态：

新增文件：
修改文件：

接口：
Schema：
模型提示词目标：
降级策略：
缓存和并发策略：

执行命令：

类型检查：
单元测试：
AI接口测试：
插件手动测试：

安全检查：
已知模型问题：
遗留问题：

是否满足当前子步骤验收标准：
```
