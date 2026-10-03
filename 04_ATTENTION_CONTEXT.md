# 模块四：注意力推断与网页上下文

> 对应总开发计划第11至13步。
>
> 本模块完成后，插件应能识别鼠标所在的语义内容块，在稳定停留后触发关注事件，并生成结构化`PageContext`。
>
> 本模块不显示正式工具条，也不调用AI。

## 一、模块目标

构建AttentionUI最关键的网页感知层：

- 识别完整段落、列表项、表格行和代码块。
- 排除按钮、输入框和超大容器。
- 计算停留时间和鼠标速度。
- 检测滚动状态和文本选择。
- 触发`AttentionCandidate`。
- 提取页面上下文。
- 进行本地内容分类。

## 二、前置条件

模块三已完成：

- Content Script可运行。
- Shadow DOM根节点存在。
- 插件可以启用和禁用。
- Shared包可用。
- Background通信可用，但本模块不依赖AI。

## 三、主要目录

```text
apps/extension/src/
├─attention/
│  ├─attention-engine.ts
│  ├─pointer-tracker.ts
│  └─scroll-tracker.ts
└─context/
   ├─semantic-block.ts
   ├─context-extractor.ts
   ├─number-extractor.ts
   └─content-classifier.ts
```

共享类型：

```text
packages/shared/src/types.ts
packages/shared/src/schemas.ts
```

## 四、子步骤1：语义内容块识别

### 基础流程

```text
pointer坐标
↓
document.elementFromPoint()
↓
排除插件自身元素
↓
closest()查找语义块
↓
尺寸、文本和标签过滤
↓
返回HTMLElement或null
```

### 优先元素

建议优先级：

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

不要简单使用一个过宽的`closest()`后立即返回，必须继续检查元素质量。

### 过滤规则

必须排除：

```text
input
textarea
select
button
option
form
password输入
contenteditable
nav
footer
header中的导航区域
插件自身宿主节点和Shadow DOM
```

文本要求：

```text
最少20个可见字符
最多不以文本长度作为唯一判断
```

尺寸要求：

- 面积不能过小。
- 不得覆盖接近整个视口。
- `div`只在找不到更语义化元素时使用。
- 不返回`body`、`html`。

建议返回：

```ts
type SemanticBlock = {
    element: HTMLElement
    text: string
    rect: DOMRect
    kind: "paragraph" | "list" | "table" | "code" | "section"
}
```

### 开发调试

开发模式可以为当前语义块显示轻微轮廓。

生产模式默认关闭调试轮廓。

### 验收标准

- 鼠标位于`span`上时找到父级`p`。
- 鼠标位于表格单元格时找到合理的`tr`或`table`。
- 鼠标位于代码文本时找到`pre`。
- 不返回`body`。
- 不返回输入框和按钮。
- 不返回插件自身节点。
- 大型页面容器不会被误选。

## 五、子步骤2：Pointer和Scroll追踪

### PointerTracker

记录：

```ts
type PointerSnapshot = {
    x: number
    y: number
    timestamp: number
    speedPxPerMs: number
}
```

计算相邻采样点距离和时间差。

`pointermove`建议节流到约50毫秒一次。

避免每个原始事件都进行完整DOM分析。

### ScrollTracker

记录：

```ts
type ScrollState = {
    lastScrollAt: number
    isScrolling: boolean
}
```

默认：

```text
滚动停止500毫秒后视为idle
```

### Selection

监听：

```text
selectionchange
```

只记录页面普通文本选择，不读取输入控件。

### 验收标准

- 控制台可看到稳定的鼠标速度。
- 快速移动和慢速停留可以区分。
- 滚动时`isScrolling=true`。
- 停止滚动后恢复idle。
- 监听器可以正确清理。

## 六、子步骤3：Attention Engine

### 基础状态

```ts
type AttentionState = {
    currentBlock: HTMLElement | null
    enteredAt: number
    lastPointerAt: number
    pointerSpeed: number
    lastScrollAt: number
    triggeredBlock: HTMLElement | null
}
```

### 默认触发条件

```text
当前语义块保持不变
停留时间达到attentionDelayMs
鼠标速度低于0.25px/ms
滚动停止超过500ms
内容块可见比例超过60%
```

`attentionDelayMs`优先读取桌面端设置；暂时无法获取时使用900毫秒默认值。

### 触发事件

```ts
type AttentionCandidate = {
    element: HTMLElement
    rect: DOMRect
    text: string
    triggeredAt: number
}
```

触发接口：

```ts
onAttentionCandidate(candidate)
```

### 冷却机制

- 同一元素30秒内不重复自动触发。
- 页面滚动时取消当前计时。
- 鼠标离开语义块时重置。
- 新语义块替换旧语义块。
- 页面失去焦点时暂停。
- 同一时刻只保留一个候选。
- 卸载Content Script时清理定时器和监听器。

### 验收标准

- 停留达到阈值后触发一次。
- 快速划过不触发。
- 滚动时不触发。
- 离开后重置。
- 同一块不会频繁触发。
- 页面切换或禁用插件后不继续监听。

## 七、子步骤4：上下文提取

### PageContext

```ts
type PageContext = {
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

### 提取规则

`text`：

- 当前语义块可见文本。
- 去除多余空白。
- 最多1500字符。

`selectedText`：

- 仅普通页面文本。
- 最多1500字符。
- 为空时返回`null`。

`nearbyHeading`：

- 查找当前元素之前或父容器中的最近标题。
- 支持`h1`至`h6`。
- 找不到返回`null`。

`numericCandidates`：

- 最多20组。
- 保留原始字符串。
- 将百分号、千位分隔符等规范化为数值。
- 不确定标签时允许空标签，不得伪造。

### 数字正则

可使用：

```ts
/[-+]?\d+(?:,\d{3})*(?:\.\d+)?%?/g
```

需要额外处理：

- 年份。
- 百分号。
- 货币符号。
- 单位文本。
- 负数。

### 本地分类

基础规则：

```text
目标元素包含table或tr→table
包含pre或code→code
存在多个有意义数字→numbers
有可用文本→text
其他→unknown
```

“多个数字”应避免把单个日期误判为数据场景。

### 验收标准

- 文章段落返回`text`。
- 表格返回`table`。
- 代码块返回`code`。
- 数据段落返回`numbers`。
- 不发送完整HTML。
- 不读取输入框。
- 文本和数字候选符合长度限制。

## 八、性能要求

- `pointermove`必须节流。
- 不对整个页面持续运行复杂查询。
- 仅在候选块变化时更新IntersectionObserver。
- MutationObserver只处理必要变化。
- 不创建无限增长的元素缓存。
- 不在每次鼠标事件中序列化完整上下文。

## 九、禁止事项

- 不显示正式工具条。
- 不调用桌面端AI。
- 不生成摘要。
- 不生成图表。
- 不使用摄像头。
- 不声称真实检测眼动。
- 不读取输入框和密码框。
- 不把DOM元素放入可序列化共享类型。

## 十、模块验收清单

- [ ] 语义块识别稳定。
- [ ] 无效元素被排除。
- [ ] Pointer速度计算正确。
- [ ] Scroll idle判断正确。
- [ ] Attention触发和冷却正确。
- [ ] PageContext结构完整。
- [ ] 内容分类基本正确。
- [ ] 数字候选可用。
- [ ] 监听器可以清理。
- [ ] 性能无明显卡顿。
- [ ] 类型检查通过。

## 十一、交给编码AI的模块提示词

```text
请先完整阅读MUST_READ.md和04_ATTENTION_CONTEXT.md。

当前只开发模块四中的指定子步骤。
不要实现工具条、AI规划、摘要、图表和专注模式。

请特别关注：
1.避免每次pointermove执行昂贵DOM查询。
2.排除input、textarea、button、contenteditable和插件自身节点。
3.不返回body、html或覆盖整个页面的大型div。
4.所有事件监听器和定时器必须可清理。
5.不要把HTMLElement写入chrome.storage或通过消息序列化。

完成后提供至少三个测试页面上的手动测试结果。
```

## 十二、完成报告格式

```text
模块：04_ATTENTION_CONTEXT
子步骤：
状态：

新增文件：
修改文件：

识别规则：
触发规则：
过滤规则：
性能处理：

执行命令：

类型检查：
单元测试：
手动测试页面与结果：

已知误判：
遗留问题：

是否满足当前子步骤验收标准：
```
