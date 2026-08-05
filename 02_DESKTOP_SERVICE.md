# 模块二：桌面服务、设置和鉴权

> 对应总开发计划第4至7步。
>
> 本模块完成后，FocusUI Desktop应能运行本地HTTP服务、持久化设置、显示基础管理界面，并为浏览器插件提供安全配对机制。
>
> 本模块不创建Chrome插件，也不接入真实AI能力。

## 一、模块目标

完成桌面端作为本地中枢的基础能力：

- 监听`127.0.0.1:17321`。
- 提供健康检查。
- 保存AI和交互设置。
- 显示桌面设置界面。
- 生成配对令牌。
- 为`/v1`接口提供Bearer鉴权。
- 管理服务启动、停止和端口异常。

## 二、前置条件

模块一已完成：

- Electron桌面端可以运行。
- Preload和IPC可用。
- `packages/shared`可以被桌面端引用。
- 类型检查通过。

## 三、主要目录

```text
apps/desktop/src/main/
├─index.ts
├─ipc.ts
├─store/
│  ├─settings-store.ts
│  └─auth-store.ts
└─server/
   ├─server.ts
   ├─auth.ts
   ├─middleware.ts
   └─routes/
      ├─health.ts
      └─pair.ts
```

Renderer主要目录：

```text
apps/desktop/src/renderer/src/
├─App.tsx
├─pages/
│  ├─StatusPage.tsx
│  ├─AISettingsPage.tsx
│  ├─BehaviorPage.tsx
│  └─LogsPage.tsx
└─styles/
```

## 四、子步骤1：本地Express服务

### 服务地址

```text
http://127.0.0.1:17321
```

必须显式绑定：

```ts
server.listen(17321, "127.0.0.1")
```

禁止使用：

```text
0.0.0.0
```

### 健康接口

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

### 服务管理要求

实现：

- 启动服务。
- 停止服务。
- 防止重复启动。
- 关闭应用时释放端口。
- 端口被占用时显示可理解错误。
- 服务状态通过IPC同步到Renderer。

### 验收标准

- 浏览器访问`/health`成功。
- 重复启动不会创建多个服务实例。
- 关闭桌面应用后端口释放。
- 服务异常不会直接导致Electron崩溃。

## 五、子步骤2：设置存储

使用`electron-store`。

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

默认值：

```ts
{
    apiBaseUrl: "",
    apiKey: "",
    modelName: "",
    attentionDelayMs: 900,
    enableAI: true,
    enableLocalTools: true,
    enableFocusMode: true,
    enableHabitLearning: true
}
```

### IPC接口

```text
getSettings
updateSettings
resetSettings
```

### 校验要求

- 使用Zod校验更新值。
- `attentionDelayMs`限制在300至3000之间。
- Renderer不能直接访问`electron-store`。
- API Key不写入日志。
- 设置更新失败时返回明确错误。

### 验收标准

- 修改设置后重启应用，值仍存在。
- 恢复默认设置成功。
- 非法停留时间被拒绝。
- API Key输入框默认隐藏。

## 六、子步骤3：桌面端基础界面

建立四个页面。

### 运行状态页

显示：

- 服务是否运行。
- 服务地址。
- 应用版本。
- AI是否配置。
- 插件是否连接。
- 插件最后连接时间。

按钮：

- 启动服务。
- 停止服务。
- 复制服务地址。

### AI设置页

字段：

- API地址。
- API Key。
- 模型名称。

按钮：

- 保存。
- 测试连接。

当前模块中“测试连接”可以先返回“尚未接入AI”或执行简单格式校验，不调用真实模型。

### 交互设置页

字段：

- 停留时间。
- 启用AI推荐。
- 启用本地工具。
- 启用专注模式。
- 启用习惯学习。
- 清除习惯数据。

习惯数据功能尚未实现时，按钮可以显示明确占位提示，但不能伪造成功。

### 调试日志页

本模块可以使用基础内存日志或模拟日志结构。

不得记录敏感信息。

### 验收标准

- 四个页面可切换。
- 设置可以保存。
- 页面缩放时无明显溢出。
- 运行状态与真实服务状态一致。

## 七、子步骤4：插件配对和鉴权

### 配对数据

桌面端保存：

```ts
type AuthState = {
    pairingToken: string
    clientToken: string | null
    tokenVersion: number
}
```

令牌可以使用`nanoid`生成。

配对令牌适合人工复制，例如：

```text
FUI-H8K2-PQ9M
```

客户端令牌应更长，不适合人工输入。

### 配对接口

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
  "clientToken": "长随机字符串"
}
```

### 鉴权

所有其他`/v1`接口要求：

```http
Authorization: Bearer clientToken
```

缺少、错误或已失效令牌返回401。

### 令牌重置

桌面界面提供：

- 复制配对令牌。
- 重新生成配对令牌。
- 断开当前插件。

重新生成后：

- 旧配对令牌失效。
- 旧客户端令牌失效。
- `tokenVersion`增加。

### CORS

只允许：

- `chrome-extension://`来源。
- 明确列出的开发环境本地来源。

不要直接允许所有来源。

### 验收标准

- 错误配对令牌返回401。
- 正确配对返回客户端令牌。
- 缺少Bearer Token访问受保护接口返回401。
- 重置令牌后旧令牌失效。
- 日志中不输出完整客户端令牌。

## 八、共享类型

建议放入`packages/shared`：

```text
HealthResponse
PairRequest
PairResponse
AppSettings
ApiError
```

API错误建议统一结构：

```ts
type ApiError = {
    ok: false
    code: string
    message: string
}
```

## 九、禁止事项

- 不接入真实AI。
- 不实现`/v1/plan`真实逻辑。
- 不创建浏览器插件。
- 不监听公网地址。
- 不允许任意CORS。
- 不把API Key发给Renderer。
- 不把完整客户端令牌写入日志。
- 不用硬编码成功结果掩盖错误。

## 十、模块验收清单

- [ ] `/health`可以访问。
- [ ] 服务仅监听`127.0.0.1`。
- [ ] 服务可启动和停止。
- [ ] 设置可以持久化。
- [ ] 设置输入经过校验。
- [ ] 四个桌面页面可以使用。
- [ ] 配对接口可以工作。
- [ ] `/v1`鉴权可以工作。
- [ ] 令牌可以重置。
- [ ] 类型检查通过。
- [ ] 尚未接入真实AI。

## 十一、交给编码AI的模块提示词

```text
请先完整阅读MUST_READ.md和02_DESKTOP_SERVICE.md。

当前只开发模块二中的指定子步骤。
不要创建Chrome插件，不要接入真实AI模型，不要提前实现图表和Attention Engine。

本地服务必须只监听127.0.0.1。
所有设置和接口输入必须经过Zod校验。
Renderer不能直接访问electron-store或API Key。
日志不得输出密钥和完整令牌。

完成后运行类型检查、服务接口测试和桌面端手动验收。
```

## 十二、完成报告格式

```text
模块：02_DESKTOP_SERVICE
子步骤：
状态：

新增文件：
修改文件：

接口：
IPC：
存储结构：

执行命令：

类型检查：
接口测试：
桌面手动验收：

安全检查：
遗留问题：

是否满足当前子步骤验收标准：
```
