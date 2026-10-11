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
# A daemon left over from the previous build keeps files in android\app\build open (EBUSY on delete). Escalate:
# polite `gradlew --stop`, then kill the Gradle/Kotlin java daemons (only java processes whose command line names gradle
# or this repository, so Android Studio is left alone), retrying the delete after each step.
function Remove-AndroidDir {
  if (-not (Test-Path android)) { return }
  if (Test-Path 'android\gradlew.bat') { & 'android\gradlew.bat' --stop 2>&1 | Out-Null }
  foreach ($step in 1..3) {
    foreach ($try in 1..3) {
      Remove-Item -Recurse -Force android -ErrorAction SilentlyContinue
      if (-not (Test-Path android)) { return }
      Start-Sleep -Seconds 2
    }
    if ($step -eq 1) {
      Write-Host '==> android/ is locked; stopping leftover Gradle/Kotlin daemons' -ForegroundColor Yellow
      $pattern = '(?i)gradle|kotlin|' + [regex]::Escape($root)
      Get-CimInstance Win32_Process -Filter "Name = 'java.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -match $pattern } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    } elseif ($step -eq 2) {
      Write-Host '==> still locked; releasing the folder from node/adb/clangd and waiting for the antivirus scan' -ForegroundColor Yellow
      Get-Process node, adb, clangd, ninja -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne $PID } |
        ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
      Start-Sleep -Seconds 5
    }
  }
  if (Test-Path android) {
    throw "Cannot delete apps\mobile\android: a file is still locked. Close Android Studio and any Explorer window on that folder (or exclude F:\ from Windows Defender), then run the script again."
  }
}
Remove-AndroidDir
Run 'expo prebuild' { pnpm exec expo prebuild --platform android }
Set-Location android
Run 'gradlew assembleRelease' { .\gradlew assembleRelease }

$apk = Join-Path (Get-Location) 'app\build\outputs\apk\release\app-release.apk'
Write-Host "`nAPK: $apk" -ForegroundColor Green
Write-Host "Check the signature: apksigner verify --print-certs `"$apk`" (must not say Android Debug)."
Write-Host "Then remove the signing lines from $props."
