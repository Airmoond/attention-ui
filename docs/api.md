# 本地接口

桌面程序运行后，服务地址为 `http://127.0.0.1:17321`。此服务连接 Chrome 扩展与桌面端，接口定义位于 [共享包](../packages/shared/src/index.ts)。

## 认证

`GET /health` 和 `POST /v1/pair` 不需要客户端令牌。配对成功后，其他 `/v1` 请求携带：

```http
Authorization: Bearer <clientToken>
Content-Type: application/json
```

配对请求使用桌面端显示的令牌：

```json
{
  "pairingToken": "<桌面端显示的配对令牌>"
}
```

成功响应包含 `ok: true` 和 `clientToken`。重新生成配对令牌或断开插件后，需要重新配对。

## 接口列表

| 方法 | 路径 | 请求 | 响应或用途 |
| --- | --- | --- | --- |
| GET | `/health` | 无 | `ok`、`service`、`version`、`aiConfigured` |
| POST | `/v1/pair` | `pairingToken` | 换取 `clientToken` |
| GET | `/v1/auth-check` | 无 | 检查客户端认证，返回 `ok` 和 `authenticated` |
| POST | `/v1/plan` | `pageContext` | 工具规划与来源 `source` |
| POST | `/v1/execute` | `toolId`、`pageContext`，提问时提供 `question` | 对应工具结果 |
| POST | `/v1/events` | `eventType`、`contextType`、`toolId` | 记录工具使用，返回 `ok` |
| GET | `/v1/preferences` | 无 | `ok` 与本地习惯 `preferences` |
| POST | `/v1/preferences/reset` | 无 | 清空习惯，返回重置后的 `preferences` |

`/v1/execute` 支持 `summarize`、`explain`、`ask`、`chart` 和 `extract`。`focus` 在浏览器扩展本地执行。

健康检查示例：

```json
{
  "ok": true,
  "service": "attentionui-desktop",
  "version": "0.1.1",
  "aiConfigured": false
}
```

## 数据定义

`PageContext` 包含片段文本、选文、内容类型和数字候选等字段。规划请求、执行请求与结果均使用 Zod 校验。

- [请求与结果 Schema](../packages/shared/src/schemas.ts)：`PageContextSchema`、`PlanRequestSchema`、`ExecuteRequestSchema`、`ToolResultSchema` 等。
- [配对与网站设置 Schema](../packages/shared/src/extension.ts)：配对响应、服务状态和网站策略。
- [TypeScript 类型](../packages/shared/src/types.ts)：两端接口与工具数据类型。
- [路由注册](../apps/desktop/src/main/server/server.ts)：当前实际提供的服务入口。

字段限制和图表校验以共享 Schema 为准。图表标签与数值需要一一对应，提取数值需要能在当前片段的数字候选中找到。

## 错误与静态页面

认证失败返回 HTTP 401；请求结构错误通常返回 HTTP 400；处理失败返回 HTTP 500。接口错误包含 `ok: false`、`code` 和 `message`。工具执行的业务失败也可能以 HTTP 200 返回 `success: false` 的工具结果，调用方应同时检查 HTTP 状态和结果字段。

桌面服务还提供 `/guide`、`/demo/article.html`、`/demo/finance.html` 和 `/demo/styles.css`，用于安装说明与内置演示。
