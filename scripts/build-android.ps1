<#
  Store build of the Android app on Windows (Myket / Bazaar), one command:
    powershell -ExecutionPolicy Bypass -File scripts\build-android.ps1 -Store myket

  What it takes care of (the things that broke the manual build, docs/android-build.md):
  - hoisted pnpm install (the default .pnpm layout makes CMake object paths > 250 characters and ninja fails);
  - signing read from %USERPROFILE%\.gradle\gradle.properties (PowerShell splits -Pa.b=c arguments at the dot);
  - a fresh `expo prebuild`, then `gradlew assembleRelease`.
  Keep the repository in a short folder (e.g. C:\d or F:\d): it is the only complete fix for long paths.
#>
param(
  [ValidateSet('myket', 'bazaar', 'bale', '')][string]$Store = 'myket',
  [string]$ApiUrl = 'https://api.mrbots.ir'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

function Run([string]$what, [scriptblock]$block) {
  Write-Host "==> $what" -ForegroundColor Cyan
  & $block
  if ($LASTEXITCODE -ne 0) { throw "$what failed (exit $LASTEXITCODE)" }
}

if ($root.Length -gt 12) {
  Write-Warning "The repository path '$root' is long. If CMake/ninja fails ('build.ninja still dirty'), move the repository to a short folder such as C:\d and run again."
}

# Signing: the four android.injected.signing.* lines must be in the user's gradle.properties (outside the repository).
$props = Join-Path $env:USERPROFILE '.gradle\gradle.properties'
$text = if (Test-Path $props) { Get-Content $props -Raw } else { '' }
foreach ($key in 'store.file', 'store.password', 'key.alias', 'key.password') {
  if ($text -notmatch "(?m)^\s*android\.injected\.signing\.$([regex]::Escape($key))\s*=") {
    throw "Missing android.injected.signing.$key in $props (see docs/android-build.md, 'Store release')."
  }
}

Set-Location $root
$virtualStore = Join-Path $root 'node_modules\.pnpm'
if (Test-Path $virtualStore) {
  Write-Host '==> node_modules uses the default pnpm layout; removing it to reinstall hoisted' -ForegroundColor Yellow
  Get-ChildItem $root -Directory -Recurse -Filter node_modules -Depth 2 -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch 'node_modules\\.+node_modules' } |
    ForEach-Object { Remove-Item -Recurse -Force $_.FullName }
}
Run 'pnpm install (hoisted)' { pnpm install --node-linker=hoisted }

$env:EXPO_PUBLIC_API_URL = $ApiUrl
$env:EXPO_PUBLIC_STORE = $Store
Set-Location (Join-Path $root 'apps\mobile')
Remove-Item -Recurse -Force android -ErrorAction SilentlyContinue
Run 'expo prebuild' { pnpm exec expo prebuild --platform android }
Set-Location android
Run 'gradlew assembleRelease' { .\gradlew assembleRelease }

$apk = Join-Path (Get-Location) 'app\build\outputs\apk\release\app-release.apk'
Write-Host "`nAPK: $apk" -ForegroundColor Green
Write-Host "Check the signature: apksigner verify --print-certs `"$apk`" (must not say Android Debug)."
Write-Host "Then remove the signing lines from $props."
