# PDF 可行性验证（阶段 A）
独立工程实验，不进入 Desktop/Extension 生产包，不调用 AI，也不保存文档历史。

## 运行
需要 Node 22.13+、本机 Chrome，以及 Python + PyMuPDF 1.27.2.3（仅生成原创工程样本）。
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

测试使用系统 Chrome 的独立无头会话，访问仅监听回环地址的验证服务。截图和结果写入 test-results，均不提交。
构建与启动前需运行 prepare-assets.mjs，将 PDF.js 的字体、CMap 与 wasm 放在本地 public 下。
新增依赖仅用于本实验，版本锁定在本目录 package-lock.json。

## 验证边界
- 10 份原创三页文档，中文/英文、单栏/双栏；4 份异常文件。原文由生成器定义，非教材或真实学生资料。
- 支持本地打开、翻页、缩放、文字选择、保存当前会话片段、返回来源页。
- 20 MB / 120 页是保护性验证上限，不是对该上限性能已达标的承诺。
- 扫描页只显示图像；加密/损坏/超限文件明确拒绝。
- 不验证 Chrome 扩展打包环境、AI 调用、整本文档理解或 OCR。
- 生成 PDF 不纳入 Git；生成器和 manifest 中的校验值可复现。加密文件可能包含随机加密材料，校验值并非跨运行稳定。
- PDF.js 采用 Apache-2.0；PyMuPDF 仅作开发样本工具，不打包分发。迁入正式产品前复核许可证与安全更新。
