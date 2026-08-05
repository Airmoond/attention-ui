# 模块五：动态工具条、本地能力与专注模式

> 对应总开发计划第14、15和20步。
>
> 本模块完成后，用户停留在网页内容上时，应能看到稳定的悬浮工具条。即使桌面端或AI不可用，插件仍应提供本地工具和专注阅读能力。
>
> 本模块不实现真实AI摘要、解释和图表提取。

## 一、模块目标

完成插件的核心交互层：

- Attention触发后显示工具条。
- 根据内容类型选择本地工具。
- 工具条自动避开视口边缘。
- 支持关闭、Esc和滚动处理。
- 桌面端离线时显示清晰降级状态。
- 实现本地专注阅读模式。

## 二、前置条件

模块四已完成：

- 可以生成`AttentionCandidate`。
- 可以生成`PageContext`。
- 可以判断`contextKind`。
- Shadow DOM和React Root已存在。

## 三、主要目录

```text
apps/extension/src/
├─policy/
│  └─local-policy.ts
├─position/
│  └─position-manager.ts
└─ui/
   ├─FocusUIRoot.tsx
   ├─AttentionToolbar.tsx
   ├─LoadingCard.tsx
   ├─ErrorCard.tsx
   └─FocusReader.tsx
```

## 四、子步骤1：本地工具策略

### 默认规则

| 内容类型 | 默认工具 |
|---|---|
| text | summarize、explain、ask |
| numbers | chart、explain、extract |
| table | chart、extract、summarize |
| code | explain、ask |
| unknown | summarize、ask |
| 长文章 | focus、summarize |

工具ID必须来自共享白名单：

```text
summarize
explain
ask
chart
extract
focus
```

本地工具配置可以包含：

```ts
type LocalTool = {
    id: ToolId
    label: string
    availableOffline: boolean
}
```

当前本地可真正执行的功能：

```text
focus
```

其他工具在AI未接入前显示说明：

```text
需要连接FocusUI Desktop并配置AI
```

### 验收标准

- 不同`contextKind`返回正确工具。
- 工具数量不超过3个。
- 工具ID全部合法。
- AI不可用时仍能返回工具。

## 五、子步骤2：悬浮工具条

### AttentionToolbar

显示内容：

- 工具按钮。
- 关闭按钮。
- 可选连接状态。
- 可选加载状态。

交互：

- 点击工具按钮。
- 点击关闭。
- 点击外部关闭。
- 按Esc关闭。
- 新候选出现时替换旧工具条。

### 视觉要求

MVP保持简洁：

- 小尺寸。
- 高对比度。
- 圆角。
- 轻微阴影。
- 简短淡入。
- 不使用复杂动画。
- 不遮挡大面积正文。

### 可访问性

- 按钮使用真实`button`。
- 提供`aria-label`。
- 键盘可聚焦。
- Esc可以关闭。
- 加载状态有文字提示。

## 六、子步骤3：位置管理

### 输入

```ts
type PositionInput = {
    targetRect: DOMRect
    toolbarWidth: number
    toolbarHeight: number
    viewportWidth: number
    viewportHeight: number
    pointerX: number
    pointerY: number
}
```

### 优先级

```text
目标右侧
↓
目标左侧
↓
目标下方
↓
目标上方
```

规则：

- 与目标保持适当间距。
- 不超出视口。
- 不遮挡鼠标坐标。
- 页面边缘保留安全边距。
- 浏览器缩放后重新计算。
- 窗口resize后重新计算。
- 滚动时可以关闭，MVP优先选择关闭而不是持续跟随。

### 验收标准

- 页面四角附近都能显示。
- 工具条不超出视口。
- 不明显遮挡鼠标所在文本。
- resize后位置仍正常。
- 滚动后工具条关闭或正确更新。

## 七、子步骤4：本地降级交互

桌面端离线、未配对或AI未配置时：

- 工具条仍出现。
- `focus`仍可用。
- AI工具点击后显示明确提示。
- 不反复弹出错误通知。
- 不导致React树崩溃。

错误提示示例：

```text
FocusUI Desktop未连接
```

或：

```text
请先在桌面端配置AI服务
```

不要显示内部堆栈给普通用户。

### 验收标准

关闭桌面端后：

- 工具条正常出现。
- 专注模式正常。
- 其他工具显示可理解提示。
- 控制台没有未处理Promise错误。

## 八、子步骤5：专注阅读模式

### 设计原则

不直接删除或隐藏原网页DOM节点。

采用：

```text
Shadow DOM中的全屏遮罩
+
独立阅读容器
```

### 内容来源

优先：

```text
article
main
当前语义块
```

可使用简单启发式提取主内容。

过滤：

```text
script
style
nav
footer
form
button
广告占位
插件自身元素
```

### 功能

- 标题。
- 正文。
- 关闭按钮。
- Esc退出。
- 禁止背景滚动。
- 退出后恢复原滚动状态。
- 多次进入不会重复创建节点。
- 页面导航或插件禁用时自动清理。

### 内容渲染安全

- 不直接渲染任意HTML。
- MVP优先复制文本和安全结构。
- 需要保留段落时，使用程序创建固定元素。
- 不执行原网页中的脚本。
- 不复制表单控件。

### 验收标准

- 可以进入和退出。
- 背景不能滚动。
- 退出后滚动恢复。
- 原网页状态没有被破坏。
- 多次进入退出无重复节点。
- Esc有效。

## 九、UI状态建议

```ts
type FocusUIState =
    | { kind: "idle" }
    | {
        kind: "toolbar"
        candidate: AttentionCandidate
        context: PageContext
        tools: LocalTool[]
      }
    | {
        kind: "message"
        message: string
      }
    | {
        kind: "focus-reader"
        title: string
        paragraphs: string[]
      }
```

不要让多个独立布尔值形成难以维护的组合状态。

## 十、禁止事项

- 不接入真实AI。
- 不生成真实摘要。
- 不生成真实图表。
- 不自动点击网页。
- 不直接删除原网页导航栏。
- 不使用`innerHTML`渲染模型内容。
- 不添加复杂动画库。
- 不创建多个同时活动的工具条。

## 十一、模块验收清单

- [ ] 本地规则正确。
- [ ] 工具条稳定显示。
- [ ] 工具条位置正确。
- [ ] 关闭和Esc有效。
- [ ] 桌面端离线时可以降级。
- [ ] 专注模式可用。
- [ ] 原网页不被破坏。
- [ ] Shadow DOM隔离正常。
- [ ] 类型检查通过。
- [ ] 没有未处理异步错误。

## 十二、交给编码AI的模块提示词

```text
请先完整阅读MUST_READ.md和05_DYNAMIC_UI.md。

当前只开发模块五中的指定子步骤。
不要接入真实AI，不要实现摘要、解释、问答或真实图表提取。

请保证：
1.工具条只存在一个。
2.工具条不能超出视口。
3.桌面端离线时仍能使用本地专注模式。
4.专注模式不能直接删除原网页DOM。
5.所有UI位于Shadow DOM。
6.不要使用innerHTML渲染不可信内容。

完成后在页面顶部、底部、左侧和右侧分别测试位置。
```

## 十三、完成报告格式

```text
模块：05_DYNAMIC_UI
子步骤：
状态：

新增文件：
修改文件：

本地工具规则：
位置策略：
UI状态：
离线降级：
专注模式实现：

执行命令：

类型检查：
单元测试：
手动测试：

已知界面问题：
遗留问题：

是否满足当前子步骤验收标准：
```
