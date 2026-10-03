# 模块三：浏览器插件基础与双端通信

> 对应总开发计划第8至10步。
>
> 本模块完成后，Chrome插件应能加载、保存设置、检测桌面端、完成配对，并在网页中创建隔离的Shadow DOM根节点。
>
> 本模块不实现Attention Engine和AI工具。

## 一、模块目标

建立浏览器插件的基础运行环境：

- WXT+React+TypeScript。
- Chrome Manifest V3。
- Popup和Options页面。
- Background Service Worker。
- 与桌面端健康检查和配对。
- `chrome.storage.local`设置存储。
- Content Script。
- 唯一Shadow DOM根节点。

## 二、前置条件

模块二已完成：

- 桌面端`/health`可用。
- `/v1/pair`可用。
- Bearer鉴权可用。
- 配对令牌可在桌面端查看。
- 共享类型包可用。

## 三、主要目录

```text
apps/extension/
├─package.json
├─wxt.config.ts
├─entrypoints/
│  ├─background.ts
│  ├─content.tsx
│  ├─popup/
│  │  ├─index.html
│  │  └─App.tsx
│  └─options/
│     ├─index.html
│     └─App.tsx
└─src/
   ├─communication/
   │  ├─desktop-client.ts
   │  └─messages.ts
   ├─storage/
   │  └─extension-store.ts
   └─ui/
      └─AttentionUIRoot.tsx
```

## 四、子步骤1：创建WXT插件

### 技术要求

使用：

```text
WXT
React
TypeScript
Manifest V3
```

权限从最小范围开始：

```text
storage
activeTab
scripting
```

Host权限：

```text
http://127.0.0.1:17321/*
http://localhost/*
https://en.wikipedia.org/*
```

需要本地Demo页面时，可以在开发阶段允许`file://`，但必须说明如何在Chrome扩展设置中启用“允许访问文件网址”。

### Popup

显示：

```text
AttentionUI
桌面端状态：未检测
当前页面：已启用
```

### Options

包含：

- 桌面服务地址。
- 配对令牌。
- 连接桌面端按钮。
- 当前配对状态。
- 启用插件开关。

### 验收标准

- 插件可通过开发者模式加载。
- Popup可打开。
- Options可打开。
- 设置可以保存到`chrome.storage.local`。
- 插件Service Worker没有阻断性错误。

## 五、子步骤2：插件设置存储

使用统一结构：

```ts
type ExtensionSettings = {
    desktopBaseUrl: string
    clientToken: string | null
    enabled: boolean
}
```

默认值：

```ts
{
    desktopBaseUrl: "http://127.0.0.1:17321",
    clientToken: null,
    enabled: true
}
```

实现：

```text
getExtensionSettings
updateExtensionSettings
clearClientToken
```

### 安全要求

- 不保存API Key。
- `clientToken`只存入扩展本地存储。
- 不输出完整令牌到控制台。
- 服务地址必须验证为本机HTTP地址。

MVP默认只允许：

```text
http://127.0.0.1:17321
http://localhost:17321
```

### 验收标准

- 重启Chrome后设置仍存在。
- 清除配对状态后客户端令牌消失。
- 非法服务地址被拒绝。

## 六、子步骤3：Background与桌面端通信

Background负责所有主要网络通信。

消息类型：

```text
CHECK_DESKTOP_HEALTH
PAIR_DESKTOP
GET_CONNECTION_STATUS
```

建议统一消息结构：

```ts
type ExtensionMessage =
    | { type: "CHECK_DESKTOP_HEALTH" }
    | { type: "PAIR_DESKTOP"; pairingToken: string }
    | { type: "GET_CONNECTION_STATUS" }
```

`desktop-client.ts`负责：

- 请求超时。
- 解析JSON。
- 统一错误。
- 自动添加Bearer Token。
- 不在错误中泄露令牌。

### 健康检查

调用：

```http
GET /health
```

Popup展示：

```text
桌面端在线
桌面端离线
尚未配对
已经配对
```

### 配对

Options发送配对令牌到Background。

Background调用：

```http
POST /v1/pair
```

成功后保存`clientToken`。

### 验收标准

- 桌面端运行时显示在线。
- 桌面端关闭时显示离线。
- 正确令牌配对成功。
- 错误令牌显示明确错误。
- 重启Chrome后仍保持配对。
- 网络超时不会让Popup卡死。

## 七、子步骤4：Content Script和Shadow DOM

### 宿主节点

创建唯一节点：

```text
attention-ui-host
```

要求：

- 使用固定ID或唯一属性检测重复。
- 创建开放或关闭的Shadow Root均可，但需要说明选择。
- 在Shadow Root中挂载React Root。
- 插件关闭后能够卸载。
- 页面刷新后只存在一个根节点。

先显示固定测试组件：

```text
AttentionUI已启用
```

位置：

```text
网页右下角
```

### 样式隔离

插件样式只能进入Shadow Root。

不要：

- 向原网页`head`全局插入样式。
- 依赖网站Tailwind、Bootstrap或CSS变量。
- 修改原网页字体和颜色。

### 验收标准

在以下页面测试：

- Wikipedia文章。
- 本地普通HTML页面。
- 样式复杂的测试页面。

结果：

- 测试按钮样式基本一致。
- 网页样式不受影响。
- 重复注入不会创建多个按钮。
- 禁用插件功能后根节点消失。

## 八、禁止事项

- 不实现语义内容识别。
- 不实现鼠标停留。
- 不实现工具条。
- 不调用AI。
- 不读取网页输入框。
- 不把网络逻辑分散到多个React组件。
- 不在Content Script保存API Key。
- 不使用网页全局CSS。

## 九、模块验收清单

- [ ] 插件可加载。
- [ ] Popup可用。
- [ ] Options可用。
- [ ] 设置持久化。
- [ ] Background可检测桌面端。
- [ ] 配对成功。
- [ ] 配对失败有反馈。
- [ ] Shadow DOM根节点创建成功。
- [ ] 根节点不会重复。
- [ ] 插件关闭后可以卸载UI。
- [ ] 类型检查通过。

## 十、交给编码AI的模块提示词

```text
请先完整阅读MUST_READ.md和03_EXTENSION_FOUNDATION.md。

当前只开发模块三中的指定子步骤。
不要实现Attention Engine、语义块识别、工具条、AI规划、摘要或图表。

主要网络通信必须放在Background Service Worker。
插件中禁止保存AI API Key。
Content Script插入网页的UI必须使用Shadow DOM。
任何令牌不得完整输出到日志。

完成后给出Chrome开发者模式加载步骤和每项手动验收方法。
```

## 十一、完成报告格式

```text
模块：03_EXTENSION_FOUNDATION
子步骤：
状态：

新增文件：
修改文件：

Manifest权限：
消息类型：
本地存储结构：

执行命令：

类型检查：
插件构建：
Chrome手动验收：

安全检查：
遗留问题：

是否满足当前子步骤验收标准：
```
