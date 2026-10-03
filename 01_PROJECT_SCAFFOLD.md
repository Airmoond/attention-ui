# 模块一：工程骨架与Electron基础

> 对应总开发计划第1至3步。
>
> 本模块完成后，项目应具备可运行的Electron窗口、React渲染层、Preload安全桥接和基础IPC通信。
>
> 本模块不开发本地HTTP服务、浏览器插件和AI功能。

## 一、模块目标

建立可持续开发的Monorepo基础，使桌面端、浏览器插件和共享包拥有清晰边界。

完成后应具备：

- npm workspaces。
- Electron+React+TypeScript桌面程序。
- 安全的Main、Preload和Renderer分层。
- Renderer通过IPC读取应用信息。
- 统一的TypeScript配置。
- 基础构建和类型检查脚本。

## 二、前置条件

- 已安装Node.js稳定版本。
- 已安装npm。
- 当前目录是新建项目目录或已确认可以初始化。
- 已阅读`MUST_READ.md`。
- 当前工作区没有未确认的历史代码修改。

## 三、目标目录

```text
attention-ui/
├─package.json
├─package-lock.json
├─tsconfig.base.json
├─MUST_READ.md
├─.gitignore
├─apps/
│  ├─desktop/
│  └─extension/
├─packages/
│  └─shared/
├─demo-pages/
└─docs/
   └─modules/
```

本模块主要修改：

```text
package.json
tsconfig.base.json
.gitignore
apps/desktop/**
packages/shared/**
```

## 四、子步骤1：创建Monorepo骨架

### 开发要求

根目录`package.json`至少包含：

```json
{
  "name": "attention-ui",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev:desktop": "npm run dev -w apps/desktop",
    "dev:extension": "npm run dev -w apps/extension",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "build": "npm run build --workspaces --if-present",
    "test": "npm run test --workspaces --if-present"
  }
}
```

建立：

```text
apps/desktop
apps/extension
packages/shared
demo-pages
docs/modules
```

`.gitignore`至少包含：

```text
node_modules
dist
out
.output
release
.env
*.log
```

创建`packages/shared`，导出一个基础类型：

```ts
export type AppInfo = {
    version: string
    platform: string
    serviceRunning: boolean
}
```

### 不允许做

- 不创建Express服务。
- 不接入OpenAI。
- 不实现插件。
- 不实现设置持久化。
- 不添加数据库。

### 验收标准

- `npm install`成功。
- npm能够识别workspace。
- 根目录脚本可以执行。
- `packages/shared`可以正常构建或被引用。
- 没有循环依赖。

## 五、子步骤2：创建Electron基础窗口

### 技术要求

使用：

```text
Electron
electron-vite
React
TypeScript
```

窗口配置：

```text
默认宽度：960
默认高度：680
最小宽度：760
最小高度：520
```

安全配置：

```ts
webPreferences: {
    preload: preloadPath,
    contextIsolation: true,
    nodeIntegration: false
}
```

Renderer暂时显示：

```text
AttentionUI Desktop
本地服务：尚未启动
```

### 不允许做

- 不在Renderer中直接使用Node.js。
- 不关闭`contextIsolation`。
- 不开启`nodeIntegration`。
- 不使用远程网页作为Renderer入口。
- 不实现托盘。

### 验收标准

- `npm run dev:desktop`可以启动。
- Electron窗口显示React页面。
- 窗口尺寸符合要求。
- 关闭窗口后进程正常退出。
- Main和Renderer控制台没有阻断性错误。

## 六、子步骤3：建立Preload和IPC

### 目标API

Preload只暴露：

```ts
window.attentionUI.getAppInfo()
```

返回：

```ts
{
    version: string
    platform: string
    serviceRunning: boolean
}
```

使用：

```text
ipcMain.handle
ipcRenderer.invoke
contextBridge.exposeInMainWorld
```

需要补充全局类型声明，使TypeScript识别：

```ts
window.attentionUI
```

Renderer读取并显示：

- 应用版本。
- 当前平台。
- 服务状态。

### 安全要求

- Preload只暴露最小必要API。
- 不暴露完整`ipcRenderer`。
- 不允许Renderer自定义任意IPC频道。
- IPC返回值必须符合共享类型。

### 验收标准

- Renderer无法访问`require`。
- 页面能显示真实应用版本。
- 页面能显示平台信息。
- `serviceRunning`初始为`false`。
- 类型检查通过。

## 七、建议命令

```bash
npm install
npm run dev:desktop
npm run typecheck
npm run build
```

## 八、模块验收清单

- [ ] npm workspaces配置完成。
- [ ] Electron桌面窗口可以运行。
- [ ] React Renderer正常显示。
- [ ] Main、Preload、Renderer边界清晰。
- [ ] `nodeIntegration`保持关闭。
- [ ] `contextIsolation`保持开启。
- [ ] `getAppInfo()`可以调用。
- [ ] TypeScript类型检查通过。
- [ ] 尚未开发本地服务和插件。

## 九、交给编码AI的模块提示词

```text
请先完整阅读MUST_READ.md和01_PROJECT_SCAFFOLD.md。

当前只开发模块一中的指定子步骤。

请先检查现有项目，不要假设目录为空。
修改前列出计划修改的文件。
不要提前实现Express、本地服务、浏览器插件、设置存储、托盘或AI功能。

必须保持Electron安全配置：
contextIsolation=true
nodeIntegration=false

完成后运行类型检查和当前可执行的构建命令。
最后输出修改文件、命令、测试结果、验收方式和遗留问题。
```

## 十、完成报告格式

```text
模块：01_PROJECT_SCAFFOLD
子步骤：
状态：

新增文件：
修改文件：

实现内容：

执行命令：

类型检查结果：
构建结果：
手动验收结果：

尚未实现：
遗留问题：

是否满足当前子步骤验收标准：
```
