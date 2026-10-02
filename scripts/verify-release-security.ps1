param([string]$BuildDate = "20261003")
$ErrorActionPreference = "Stop"
function Get-ReleaseFileHash([string]$LiteralPath) {
  $stream = [System.IO.File]::OpenRead($LiteralPath)
  $algorithm = [System.Security.Cryptography.SHA256]::Create()
  try { [pscustomobject]@{ Hash = [System.BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace("-", "") } }
  finally { $stream.Dispose(); $algorithm.Dispose() }
}
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$package = Get-Content -LiteralPath (Join-Path $repoRoot "package.json") -Raw | ConvertFrom-Json
$version = [string]$package.version
if ($version -notmatch '^\d+\.\d+\.\d+$' -or $BuildDate -notmatch '^\d{8}$') { throw "版本或日期格式无效。" }
$releaseRoot = Join-Path $repoRoot "release\$version-student-$BuildDate"
$extensionZip = Join-Path $releaseRoot "focusui-extension.zip"
$installer = Join-Path $releaseRoot "FocusUI-Setup-$version.exe"
$temporaryRoot = Join-Path $repoRoot "release\.tmp-release-security-$PID"
$expectedFiles = @("FocusUI-Setup-$version.exe", "focusui-extension.zip", "README.md", "QUICK_START.html", "安装使用说明书.html", "DEMO_SCRIPT.md", "测试反馈表.txt", "BUILD_INFO.json", "demo-pages\article.html", "demo-pages\finance.html", "demo-pages\styles.css")
foreach ($file in $expectedFiles) { if (-not (Test-Path -LiteralPath (Join-Path $releaseRoot $file) -PathType Leaf)) { throw "发布文件缺失：$file" } }
$allowedFiles = @($expectedFiles + "SHA256SUMS.txt")
foreach ($file in Get-ChildItem -LiteralPath $releaseRoot -File -Recurse) {
  $relative = $file.FullName.Substring($releaseRoot.Length + 1)
  if ($relative -notin $allowedFiles) { throw "发布目录含非交付文件：$relative" }
}
$info = Get-Content -LiteralPath (Join-Path $releaseRoot "BUILD_INFO.json") -Raw | ConvertFrom-Json
if ($info.version -ne $version -or $info.buildDate -ne $BuildDate) { throw "构建信息不一致。" }
$packagedRoot = Join-Path $repoRoot "apps\desktop\release\win-unpacked\resources\onboarding"
foreach ($file in @("QUICK_START.html", "demo-pages\article.html", "demo-pages\finance.html", "demo-pages\styles.css", "extension\manifest.json")) { if (-not (Test-Path -LiteralPath (Join-Path $packagedRoot $file) -PathType Leaf)) { throw "安装包内置资源缺失：$file" } }
$demos = @(Get-ChildItem -LiteralPath (Join-Path $packagedRoot "demo-pages") -File -Recurse)
if ($demos.Count -ne 3 -or @($demos | Where-Object { $_.Name -notin @("article.html", "finance.html", "styles.css") }).Count -gt 0) { throw "安装包包含内部测试页或非交付资料。" }
if ((Get-ReleaseFileHash -LiteralPath (Join-Path $packagedRoot "QUICK_START.html")).Hash -ne (Get-ReleaseFileHash -LiteralPath (Join-Path $releaseRoot "安装使用说明书.html")).Hash) { throw "内置与交付说明书不一致。" }
if (Test-Path -LiteralPath $temporaryRoot) { throw "临时检查目录已存在。" }
try {
  Expand-Archive -LiteralPath $extensionZip -DestinationPath $temporaryRoot
  $manifestPath = Join-Path $temporaryRoot "manifest.json"
  if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { throw "ZIP 根目录缺少 manifest.json。" }
  $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  $embeddedManifest = Get-Content -LiteralPath (Join-Path $packagedRoot "extension\manifest.json") -Raw | ConvertFrom-Json
  if ($manifest.manifest_version -ne 3 -or $manifest.version -ne $version -or $embeddedManifest.version -ne $version) { throw "插件与 Desktop 版本不一致。" }
  $hosts = @("http://127.0.0.1:17321/*", "http://localhost:17321/*")
  if (@($manifest.host_permissions).Count -ne 2 -or @($manifest.host_permissions | Where-Object { $_ -notin $hosts }).Count -gt 0) { throw "必需网站权限超出本机服务。" }
  if ((@($manifest.host_permissions) + @($manifest.optional_host_permissions) -join "`n") -match "<all_urls>|file://") { throw "不允许广泛或 file 权限。" }
  if (@($manifest.content_scripts).Count -gt 0) { throw "不允许默认注入未启用网站。" }
  $files = @(Get-ChildItem -LiteralPath $temporaryRoot -File -Recurse)
  foreach ($file in $files) {
    if ($file.Name -match "(^\.env($|\.)|\.map$|\.test\.|\.spec\.)" -or $file.FullName -match "chrome-mv3-dev|Chrome profile") { throw "插件含开发、测试或敏感文件。" }
    $relative = $file.FullName.Substring($temporaryRoot.Length + 1)
    $embedded = Join-Path $packagedRoot "extension\$relative"
    if (-not (Test-Path -LiteralPath $embedded -PathType Leaf)) { throw "内置插件缺少：$relative" }
    if ((Get-ReleaseFileHash -LiteralPath $file.FullName).Hash -ne (Get-ReleaseFileHash -LiteralPath $embedded).Hash) { throw "内置插件与独立 ZIP 不一致：$relative" }
  }
  if (@(Get-ChildItem -LiteralPath (Join-Path $packagedRoot "extension") -File -Recurse).Count -ne $files.Count) { throw "内置插件含额外旧文件。" }
  $textFiles = @($files | Where-Object { $_.Extension -in @(".js", ".json", ".html", ".css") })
  if (@($textFiles | Select-String -Pattern "sk-[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9_-]{20,}|module-eight-invalid-key|E:\\Airmond\\focus-ui" -AllMatches).Count -gt 0) { throw "发现疑似凭证或源码路径。" }
  if (@($textFiles | Select-String -Pattern "chrome-mv3-dev|__vite_ping|webpackHotUpdate|localhost:[0-9]+/@vite/client" -AllMatches).Count -gt 0) { throw "发现开发服务器代码。" }
  Write-Host "发布检查通过：$version；内置插件与独立 ZIP 逐文件一致；无额外交付文件。"
  Write-Host "Installer：$((Get-Item -LiteralPath $installer).Length) bytes；Extension：$((Get-Item -LiteralPath $extensionZip).Length) bytes。"
} finally {
  if (Test-Path -LiteralPath $temporaryRoot) {
    $resolved = [System.IO.Path]::GetFullPath($temporaryRoot)
    $parent = [System.IO.Path]::GetFullPath((Join-Path $repoRoot "release")) + [System.IO.Path]::DirectorySeparatorChar
    if (-not $resolved.StartsWith($parent, [System.StringComparison]::OrdinalIgnoreCase)) { throw "拒绝清理发布目录之外的路径。" }
    if (((Get-Item -LiteralPath $resolved -Force).Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { throw "拒绝清理重解析点。" }
    Remove-Item -LiteralPath $resolved -Recurse -Force
  }
}
