# FocusUI 0.1.0 Beta

FocusUI 是一个基于注意力推断和 AI 动态界面的浏览器交互原型。浏览器扩展根据鼠标停留、滚动状态与文本选择识别当前关注块，在内容附近提供受控工具；Desktop 负责本地鉴权、AI 调用、隐私控制与用户偏好。

## 系统要求

- Windows 10/11（x64）
- Google Chrome
- FocusUI Desktop 0.1.0 Beta
- FocusUI Extension 0.1.0 Beta
- 可选：OpenAI 兼容的 AI 服务

## 安装 Desktop

1. 运行 `FocusUI-Setup-0.1.0.exe`。
2. 按安装向导完成当前用户安装，无需把应用固定安装到某个磁盘目录。
3. 启动 FocusUI；首页“快速上手”会引导完成插件、配对、AI 与 Demo。
4. 本地服务默认监听 `http://127.0.0.1:17321`。

安装包尚未进行商业代码签名，Windows 可能显示来源确认提示。请仅使用本项目发布目录中的安装包。

关闭主窗口后 FocusUI 会继续在系统托盘运行。要完全退出，请使用：

```text
系统托盘 → FocusUI → 退出
```

## 加载 Extension

Chrome 不允许普通安装程序静默安装未上架的扩展。FocusUI 将安全限制内的步骤缩减为一次人工确认：

1. 在 Desktop“快速上手”点击“打开插件文件夹并复制路径”。
2. 在 Chrome 打开 `chrome://extensions`。
3. 开启右上角“开发者模式”。
4. 点击“加载已解压的扩展程序”，粘贴 FocusUI 已复制的路径并选择该文件夹。
5. 建议在 Chrome 工具栏的拼图菜单中固定 FocusUI。

安装包内置的是正式生产扩展，不含开发服务器代码。独立交付时也可解压 `focusui-extension.zip`，选择直接包含 `manifest.json` 的目录。

## 配对

```text
Desktop 复制配对令牌
↓
Extension Options 输入令牌
↓
连接桌面端
```

配对成功后，Popup 会显示“桌面端：在线”和“配对：已配对”。客户端令牌只保存在扩展本地存储中，不会显示在界面上。

## AI 配置

在 Desktop 的“AI 设置”中填写：

- Base URL：OpenAI 兼容接口地址
- API Key：服务商提供的密钥
- 模型名称：服务商支持的模型标识

API Key 只保存在 Desktop 的当前用户数据目录，不进入浏览器扩展、网页或发布包。自动测试全部使用本地假响应，不会调用收费 AI。

## 运行 Demo

安装版无需命令行或 Python。在 Desktop“快速上手”中直接点击“打开文章 Demo”或“打开财经 Demo”。也可以手动访问：

- `http://127.0.0.1:17321/demo/article.html`
- `http://127.0.0.1:17321/demo/finance.html`

两个页面随 Desktop 安装，内容固定，不需要互联网或外部 CDN。源码开发者仍可使用 `python -m http.server 8080 -d demo-pages --bind 127.0.0.1` 打开全部三个内部验收页。

### Demo 用途

- Article：文本关注、总结、解释、提问与专注阅读。
- Finance：固定数字候选、表格、数据提取和柱状图/折线图结果。
- Dashboard（仅源码内部验收）：复杂布局、输入与按钮过滤、Shadow DOM、工具条边界和缩放适配。

## 常见问题

### Desktop 显示离线

确认 FocusUI Desktop 已启动；主窗口关闭后请检查系统托盘。也可访问 `http://127.0.0.1:17321/health` 检查本地服务。

### 插件需要重新配对

Desktop 重新生成令牌或断开插件后，旧客户端令牌会失效。重新复制 Desktop 当前显示的配对令牌，在 Extension Options 中连接即可。

### AI 服务连接失败

检查 Base URL、API Key 与模型名称是否匹配服务商配置。Extension 不会直接连接 AI 供应商。

### FocusUI 关闭窗口后仍运行

这是后台托盘机制的正常行为。关闭窗口只隐藏界面，本地服务仍保持运行。

### 如何彻底退出

使用“系统托盘 → FocusUI → 退出”。退出后托盘图标消失，`127.0.0.1:17321` 会释放。

## 隐私说明

- FocusUI 只处理当前关注的语义块，而不是发送整个页面或完整浏览历史。
- API Key 仅存放在 Desktop，不进入 Extension。
- 不保存完整网页正文、选中文本、完整问题或完整 AI 回答到日志。
- 用户习惯仅统计工具 ID、内容类型和计数，不保存浏览历史。
- Desktop 仅监听 `127.0.0.1`，并使用配对令牌、客户端 Bearer 鉴权和严格 CORS。
- AI 输出需通过结构化 Schema 校验，工具执行器只接受固定白名单：`summarize`、`explain`、`ask`、`chart`、`extract`、`focus`。

## 从源码验证与发布

```powershell
npm install
npm run typecheck
npm run build
npm run test
npm run package:release
npm run verify:release
```

最终交付物位于 `release/`。生产安装包仅面向 Windows x64 NSIS；生产扩展为 Manifest V3 ZIP。
