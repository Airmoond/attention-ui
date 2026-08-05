# FocusUI模块开发索引

> 本目录中的文件是`MUST_READ.md`的分模块执行版。
>
> 开始任何模块前，AI必须先阅读项目根目录中的`MUST_READ.md`，再阅读当前模块文件。
>
> 当前模块未完成验收前，不得进入下一个模块。

## 一、模块划分

| 顺序 | 文件 | 主要内容 | 对应总计划 |
|---|---|---|---|
| 1 | `01_PROJECT_SCAFFOLD.md` | Monorepo、Electron窗口、Preload和IPC | 第1至3步 |
| 2 | `02_DESKTOP_SERVICE.md` | 本地服务、设置存储、桌面界面、配对鉴权 | 第4至7步 |
| 3 | `03_EXTENSION_FOUNDATION.md` | Chrome插件、Popup、Options、双端通信、Shadow DOM | 第8至10步 |
| 4 | `04_ATTENTION_CONTEXT.md` | 语义块识别、Attention Engine、上下文提取 | 第11至13步 |
| 5 | `05_DYNAMIC_UI.md` | 悬浮工具条、本地规则、专注阅读 | 第14、15、20步 |
| 6 | `06_AI_FEATURES.md` | AI规划、总结、解释、提问、图表 | 第16至19步 |
| 7 | `07_ADAPTATION_DESKTOP_FINISH.md` | 用户习惯、托盘、日志和错误处理 | 第21至23步 |
| 8 | `08_TEST_BUILD_DEMO.md` | Demo页面、测试、打包和最终集成 | 第24至27步 |

## 二、推荐执行顺序

```text
01_PROJECT_SCAFFOLD
        ↓
02_DESKTOP_SERVICE
        ↓
03_EXTENSION_FOUNDATION
        ↓
04_ATTENTION_CONTEXT
        ↓
05_DYNAMIC_UI
        ↓
06_AI_FEATURES
        ↓
07_ADAPTATION_DESKTOP_FINISH
        ↓
08_TEST_BUILD_DEMO
```

不要并行开发多个模块。桌面端、插件端和AI接口相互依赖，并行修改会显著增加调试成本。

## 三、模块状态表

每完成一个模块后更新此表。

| 模块 | 状态 | Git提交 | 遗留问题 |
|---|---|---|---|
| 01_PROJECT_SCAFFOLD | 未开始 | 无 | 无 |
| 02_DESKTOP_SERVICE | 未开始 | 无 | 无 |
| 03_EXTENSION_FOUNDATION | 未开始 | 无 | 无 |
| 04_ATTENTION_CONTEXT | 未开始 | 无 | 无 |
| 05_DYNAMIC_UI | 未开始 | 无 | 无 |
| 06_AI_FEATURES | 未开始 | 无 | 无 |
| 07_ADAPTATION_DESKTOP_FINISH | 未开始 | 无 | 无 |
| 08_TEST_BUILD_DEMO | 未开始 | 无 | 无 |

状态只允许使用：

```text
未开始
开发中
等待验收
已完成
已阻塞
```

## 四、每个模块的使用方法

向编码AI发送：

```text
请先完整阅读项目根目录中的MUST_READ.md。

然后阅读：
docs/modules/当前模块文件名.md

本轮只开发该模块中的当前子步骤。
不要提前开发模块中的后续子步骤，也不要进入下一个模块。

开始修改前，先汇报：
1.当前项目状态。
2.本轮涉及的文件。
3.本轮不会修改的模块。
4.当前子步骤的验收方式。

完成后，按照模块文件中的完成报告格式输出。
```

## 五、拆分子步骤的原则

一个子步骤出现以下任一情况时，应继续拆分：

- 预计修改超过8个文件。
- 同时涉及桌面端、插件端和共享包三个区域。
- 同时包含界面、接口和持久化。
- 一次修改后难以独立验收。
- 需要引入多个新依赖。
- AI无法明确列出修改边界。

拆分后使用：

```text
模块X-A
模块X-B
```

先完成并验收X-A，再进入X-B。

## 六、Git提交建议

每个模块至少提交一次，每个关键子步骤也可以单独提交。

```bash
git add .
git commit -m "完成模块X：模块名称"
```

修复问题：

```bash
git add .
git commit -m "修复模块X：具体问题"
```

进入下一个模块前运行：

```bash
git status
npm run typecheck
npm test
```

工作区应保持干净，类型检查应通过。
