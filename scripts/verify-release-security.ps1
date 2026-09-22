$ErrorActionPreference = "Stop"

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$releaseRoot = [System.IO.Path]::GetFullPath((Join-Path $repoRoot "release"))
$extensionZip = Join-Path $releaseRoot "focusui-extension.zip"
$installer = Join-Path $releaseRoot "FocusUI-Setup-0.1.0.exe"
$temporaryRoot = Join-Path $repoRoot ".tmp-release-security-$PID"

if (-not $releaseRoot.StartsWith($repoRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Release 路径不在项目目录内。"
}
foreach ($requiredFile in @(
  $installer,
  $extensionZip,
  (Join-Path $releaseRoot "README.md"),
  (Join-Path $releaseRoot "QUICK_START.html"),
  (Join-Path $releaseRoot "DEMO_SCRIPT.md"),
  (Join-Path $releaseRoot "demo-pages\article.html"),
  (Join-Path $releaseRoot "demo-pages\finance.html"),
  (Join-Path $releaseRoot "demo-pages\styles.css")
)) {
  if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
    throw "发布文件缺失：$requiredFile"
  }
}

$packagedOnboardingRoot = Join-Path $repoRoot "apps\desktop\release\win-unpacked\resources\onboarding"
foreach ($requiredPackagedFile in @(
  (Join-Path $packagedOnboardingRoot "QUICK_START.html"),
  (Join-Path $packagedOnboardingRoot "demo-pages\article.html"),
  (Join-Path $packagedOnboardingRoot "demo-pages\finance.html"),
  (Join-Path $packagedOnboardingRoot "demo-pages\styles.css"),
  (Join-Path $packagedOnboardingRoot "extension\manifest.json")
)) {
  if (-not (Test-Path -LiteralPath $requiredPackagedFile -PathType Leaf)) {
    throw "安装包内置的新手资源缺失：$requiredPackagedFile"
  }
}
if (Test-Path -LiteralPath (Join-Path $packagedOnboardingRoot "demo-pages\dashboard.html")) {
  throw "安装包不应包含内部 Dashboard 验收页。"
}

if (Test-Path -LiteralPath $temporaryRoot) {
  throw "临时安全检查目录已存在：$temporaryRoot"
}

try {
  Expand-Archive -LiteralPath $extensionZip -DestinationPath $temporaryRoot
  $manifestPath = Join-Path $temporaryRoot "manifest.json"
  if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw "Extension ZIP 根目录缺少 manifest.json。"
  }

  $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  if ($manifest.manifest_version -ne 3 -or $manifest.version -ne "0.1.0") {
    throw "Extension Manifest 版本不正确。"
  }
  $allHosts = @($manifest.host_permissions) -join "`n"
  if ($allHosts -match "<all_urls>|file://") {
    throw "Extension 包含不需要的广泛或 file 权限。"
  }

  $extensionFiles = @(Get-ChildItem -LiteralPath $temporaryRoot -File -Recurse)
  $forbiddenNames = @($extensionFiles | Where-Object {
    $_.Name -match "(^\.env($|\.)|\.map$|\.test\.|\.spec\.)" -or $_.FullName -match "chrome-mv3-dev|Chrome profile"
  })
  if ($forbiddenNames.Count -gt 0) {
    throw "Extension ZIP 含有开发、测试或敏感文件。"
  }

  $textFiles = @($extensionFiles | Where-Object { $_.Extension -in @(".js", ".json", ".html", ".css") })
  $secretMatches = @($textFiles | Select-String -Pattern "sk-[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9_-]{20,}|module-eight-invalid-key|E:\\Airmond\\focus-ui" -AllMatches)
  if ($secretMatches.Count -gt 0) {
    throw "Extension ZIP 发现疑似凭证或源码绝对路径。"
  }
  $developmentMatches = @($textFiles | Select-String -Pattern "chrome-mv3-dev|__vite_ping|webpackHotUpdate|localhost:[0-9]+/@vite/client" -AllMatches)
  if ($developmentMatches.Count -gt 0) {
    throw "Extension ZIP 发现开发服务器或 HMR 代码。"
  }

  Write-Host "Release 安全检查通过。"
  Write-Host "Manifest V3：$($manifest.version)"
  Write-Host "Extension 文件数：$($extensionFiles.Count)"
  Write-Host "Installer 大小：$((Get-Item -LiteralPath $installer).Length) bytes"
  Write-Host "Extension ZIP 大小：$((Get-Item -LiteralPath $extensionZip).Length) bytes"
} finally {
  if (Test-Path -LiteralPath $temporaryRoot) {
    $resolvedTemporaryRoot = [System.IO.Path]::GetFullPath($temporaryRoot)
    if (-not $resolvedTemporaryRoot.StartsWith($repoRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
      throw "拒绝清理项目目录之外的临时路径。"
    }
    $temporaryItem = Get-Item -LiteralPath $resolvedTemporaryRoot -Force
    if (($temporaryItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw "拒绝递归清理重解析点。"
    }
    Remove-Item -LiteralPath $resolvedTemporaryRoot -Recurse -Force
  }
}
