$ErrorActionPreference = "Stop"

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$releaseRoot = Join-Path $repoRoot "release"
$desktopInstaller = Join-Path $repoRoot "apps\desktop\release\FocusUI-Setup-0.1.0.exe"
$extensionZip = Join-Path $repoRoot "apps\extension\.output\focus-uiextension-0.1.0-chrome.zip"

$rootPackage = Get-Content -LiteralPath (Join-Path $repoRoot "package.json") -Raw | ConvertFrom-Json
$desktopPackage = Get-Content -LiteralPath (Join-Path $repoRoot "apps\desktop\package.json") -Raw | ConvertFrom-Json
$extensionPackage = Get-Content -LiteralPath (Join-Path $repoRoot "apps\extension\package.json") -Raw | ConvertFrom-Json
$versions = @($rootPackage.version, $desktopPackage.version, $extensionPackage.version) | Select-Object -Unique
if (@($versions).Count -ne 1 -or [string]$versions -ne "0.1.0") {
  throw "Root、Desktop 与 Extension 版本必须统一为 0.1.0。"
}

Push-Location $repoRoot
try {
  & npm.cmd run build:zip -w apps/extension
  if ($LASTEXITCODE -ne 0) { throw "Extension 生产 ZIP 构建失败。" }

  & npm.cmd run build:win -w apps/desktop
  if ($LASTEXITCODE -ne 0) { throw "Desktop 生产打包失败。" }
} finally {
  Pop-Location
}

foreach ($requiredFile in @($desktopInstaller, $extensionZip)) {
  if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
    throw "缺少生产构建产物：$requiredFile"
  }
}

New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null
$releaseDemoRoot = Join-Path $releaseRoot "demo-pages"
New-Item -ItemType Directory -Path $releaseDemoRoot -Force | Out-Null

Copy-Item -LiteralPath $desktopInstaller -Destination (Join-Path $releaseRoot "FocusUI-Setup-0.1.0.exe") -Force
Copy-Item -LiteralPath $extensionZip -Destination (Join-Path $releaseRoot "focusui-extension.zip") -Force
foreach ($demoFile in @("article.html", "finance.html", "styles.css")) {
  Copy-Item -LiteralPath (Join-Path $repoRoot "demo-pages\$demoFile") -Destination (Join-Path $releaseDemoRoot $demoFile) -Force
}
$staleDashboard = [System.IO.Path]::GetFullPath((Join-Path $releaseDemoRoot "dashboard.html"))
if (-not $staleDashboard.StartsWith($releaseDemoRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "拒绝清理发布目录之外的旧 Demo。"
}
if (Test-Path -LiteralPath $staleDashboard -PathType Leaf) {
  Remove-Item -LiteralPath $staleDashboard -Force
}
Copy-Item -LiteralPath (Join-Path $repoRoot "README.md") -Destination (Join-Path $releaseRoot "README.md") -Force
Copy-Item -LiteralPath (Join-Path $repoRoot "QUICK_START.html") -Destination (Join-Path $releaseRoot "QUICK_START.html") -Force
Copy-Item -LiteralPath (Join-Path $repoRoot "DEMO_SCRIPT.md") -Destination (Join-Path $releaseRoot "DEMO_SCRIPT.md") -Force

Write-Host "FocusUI 发布目录已生成：$releaseRoot"
Get-ChildItem -LiteralPath $releaseRoot -File -Recurse | Select-Object FullName, Length
