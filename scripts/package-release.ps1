param([string]$BuildDate = "20261003")
$ErrorActionPreference = "Stop"
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$packages = @("package.json", "apps\desktop\package.json", "apps\extension\package.json", "packages\shared\package.json") | ForEach-Object { Get-Content -LiteralPath (Join-Path $repoRoot $_) -Raw | ConvertFrom-Json }
$versions = @($packages.version | Select-Object -Unique)
if ($versions.Count -ne 1 -or $versions[0] -notmatch '^\d+\.\d+\.\d+$') { throw "Root、Desktop、Extension 与 Shared 必须使用相同的三段版本号。" }
if ($BuildDate -notmatch '^\d{8}$') { throw "BuildDate 必须为 YYYYMMDD。" }
$version = [string]$versions[0]
$releaseRoot = Join-Path $repoRoot "release\$version-student-$BuildDate"
$desktopInstaller = Join-Path $repoRoot "apps\desktop\release\FocusUI-Setup-$version.exe"
Push-Location $repoRoot
try {
  & npm.cmd run build -w packages/shared
  if ($LASTEXITCODE -ne 0) { throw "共享包构建失败。" }
  & npm.cmd run build:zip -w apps/extension
  if ($LASTEXITCODE -ne 0) { throw "Extension 生产 ZIP 构建失败。" }
  & npm.cmd run build:win -w apps/desktop
  if ($LASTEXITCODE -ne 0) { throw "Desktop 生产打包失败。" }
} finally { Pop-Location }
$extensionZips = @(Get-ChildItem -LiteralPath (Join-Path $repoRoot "apps\extension\.output") -File | Where-Object { $_.Name -like "*-$version-chrome.zip" })
if ($extensionZips.Count -ne 1) { throw "未找到唯一的当前版本 Extension ZIP。" }
if (-not (Test-Path -LiteralPath $desktopInstaller -PathType Leaf)) { throw "当前版本安装包缺失。" }
New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null
$releaseDemoRoot = Join-Path $releaseRoot "demo-pages"
New-Item -ItemType Directory -Path $releaseDemoRoot -Force | Out-Null
Copy-Item -LiteralPath $desktopInstaller -Destination (Join-Path $releaseRoot "FocusUI-Setup-$version.exe") -Force
Copy-Item -LiteralPath $extensionZips[0].FullName -Destination (Join-Path $releaseRoot "focusui-extension.zip") -Force
# Explicit lists exclude local lecture PDFs, profiles and credentials.
foreach ($demoFile in @("article.html", "finance.html", "styles.css")) { Copy-Item -LiteralPath (Join-Path $repoRoot "demo-pages\$demoFile") -Destination (Join-Path $releaseDemoRoot $demoFile) -Force }
foreach ($document in @("README.md", "QUICK_START.html", "DEMO_SCRIPT.md")) { Copy-Item -LiteralPath (Join-Path $repoRoot $document) -Destination (Join-Path $releaseRoot $document) -Force }
Copy-Item -LiteralPath (Join-Path $repoRoot "QUICK_START.html") -Destination (Join-Path $releaseRoot "安装使用说明书.html") -Force
Copy-Item -LiteralPath (Join-Path $repoRoot "docs\releases\student-feedback.txt") -Destination (Join-Path $releaseRoot "测试反馈表.txt") -Force
$sourceCommit = & git -c "safe.directory=$($repoRoot.Replace('\', '/'))" -C $repoRoot rev-parse HEAD
if ($LASTEXITCODE -ne 0) { throw "无法读取源码基线。" }
[ordered]@{ version = $version; edition = "学生测试版"; buildDate = $BuildDate; sourceBaseCommit = $sourceCommit.Trim(); guide = "安装使用说明书.html"; scope = "网页测试版；不包含独立 PDF/公式实验" } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $releaseRoot "BUILD_INFO.json") -Encoding UTF8
Write-Host "FocusUI 学生测试版已生成：$releaseRoot"
Write-Host "发布验证通过后，再创建同学转发用 ZIP。"
Get-ChildItem -LiteralPath $releaseRoot -File -Recurse | Select-Object FullName, Length
