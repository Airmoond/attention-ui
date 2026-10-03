# AttentionUI PDF 阅读与公式实验

独立工程实验，包含连续 PDF 阅读、文字选择和混合正文公式的本机识别。尚未集成到 Desktop/Extension 安装包，不调用远程 AI 服务。

返回 [项目首页](../../README.md) · [开发指南](../../docs/development.md)。

## 运行

先在项目根目录运行 `npm ci`，实验服务复用根目录的 Zod。
需要 Node 22.13+、本机 Chrome，以及 Python + PyMuPDF 1.27.2.3（仅生成原创工程样本）。使用自己的 PDF 阅读时可以跳过生成样本。
在此目录运行：

```powershell
npm ci
node prepare-assets.mjs
python generate-fixtures.py
npm run dev
```

浏览器打开 http://127.0.0.1:4178，点击“打开本地 PDF”，选择 fixtures 下的样本或自己有权使用的文件。

```powershell
npm run typecheck
npm run build
npm test
```

## 本机公式识别

普通文字沿用 PDF 文字层；选区中的数学片段保留公式原图，点击“本机识别公式”后生成可编辑的 LaTeX，再按原顺序与正文组合复制。仍然通过拖选文字选择整段，支持跨页片段。

识别需要 Python 3.12、独立虚拟环境和本地模型。在本目录执行：

```powershell
python -m venv .formula-runtime
.formula-runtime/Scripts/python.exe -m pip install -r formula-requirements.txt
.formula-runtime/Scripts/python.exe -c "from rapid_latex_ocr import LaTeXOCR; LaTeXOCR(); print('Ready')"
npm run dev
```

首次初始化会准备模型文件，之后识别使用本机模型。打开 `http://127.0.0.1:4178`，拖选包含公式的正文，在侧栏点击“本机识别公式”；展开公式可对照原图修改 LaTeX。识别服务运行于 Vite 开发服务中，静态构建不包含 Python 服务。

该流程已完成工程尝试，识别仍可能出现符号错误，准确率优化目前暂停。样本结果与缩放对比见 [公式实验记录](../../docs/validation/v0.2-formula-experiment.md)。

## 浏览器验证

测试使用系统 Chrome 的独立无头会话，访问仅监听回环地址的验证服务（4179 端口），不占用手动阅读页的 4178 端口。截图和结果写入 test-results，均不提交。
构建与启动前需运行 prepare-assets.mjs，将 PDF.js 的字体、CMap 与 wasm 放在本地 public 下。
新增依赖仅用于本实验，版本锁定在本目录 package-lock.json。

段落选区回归默认使用原创样本。如需复验本次用户提供的线性回归讲义，在实验目录设置本机路径再运行测试：

```powershell
$env:ATTENTIONUI_TEST_PDF = '你的本地路径\Lecture2-LinearReg-Notes.pdf'
npm test
Remove-Item Env:ATTENTIONUI_TEST_PDF
```

未设置时只跳过这项专用讲义用例，其余测试照常运行；不会将本地讲义复制进测试样本或上传。

## 阅读操作

- 在正文或两侧空白处滚动即可连续阅读，不需要逐页点击；工具栏固定在顶部。页码输入框仍可快速跳转。
- 点击 `−` / `+` 调整缩放，每次 25%，范围 50%–300%；“适合宽度”按当前阅读区域计算比例。
- 点击“网页全屏”展开阅读区并保留片段侧栏；点击退出按钮或按 Esc 恢复。
- 支持按词或段落拖选，拖到行首/行尾空白时定位到该行边界，避免误选后续段落。
- 支持跨页拖选文字，记录片段显示起止页码；“返回来源页”回到片段起始页。每段最多保留 1500 字。
- 缩放保留阅读位置，但清除当前选区；已记录片段保留。关闭或换文件时清除片段。
- 邻近页面按需绘制，远处页面回收画布并保留文字层，以支持跨页选择。

## 验证边界

- 10 份原创三页文档，中文/英文、单栏/双栏；4 份异常文件，以及 1 份 12 页连续阅读样本，共 15 份。原文由生成器定义，非教材或真实学生资料。
- 支持本地打开、连续滚动、页码跳转、按钮缩放、网页全屏、跨页文字选择、保存当前会话片段、返回来源页。
- 20 MB / 120 页是保护性验证上限，不是对该上限性能已达标的承诺。
- 扫描页只显示图像；加密/损坏/超限文件明确拒绝。
- 不验证 Chrome 扩展打包环境、远程 AI 调用、整本文档理解或扫描正文 OCR；本机公式识别单独记录实验结果。
- 生成 PDF 不纳入 Git；生成器和 manifest 中的校验值可复现。加密文件可能包含随机加密材料，校验值并非跨运行稳定。
- PDF.js 采用 Apache-2.0；PyMuPDF 仅作开发样本工具，不打包分发。迁入正式产品前复核许可证与安全更新。
