<#
  Store build of the Android app on Windows (Myket / Bazaar), one command:
    powershell -ExecutionPolicy Bypass -File scripts\build-android.ps1 -Store myket

  What it takes care of (the things that broke the manual build, docs/android-build.md):
  - hoisted pnpm install (the default .pnpm layout makes CMake object paths > 250 characters and ninja fails);
  - signing read from %USERPROFILE%\.gradle\gradle.properties (PowerShell splits -Pa.b=c arguments at the dot);
  - Gradle proxy: when dl.google.com is unreachable it asks for host:port (or take -Proxy 127.0.0.1:10808), detects SOCKS5/HTTP
    and writes it to gradle.properties; -NoProxy removes it;
  - a fresh `expo prebuild`, then `gradlew assembleRelease`.
  Keep the repository in a short folder (e.g. C:\d or F:\d): it is the only complete fix for long paths.
#>
param(
  [ValidateSet('myket', 'bazaar', 'bale', '')][string]$Store = 'myket',
  [string]$ApiUrl = 'https://api.mrbots.ir',
  [string]$Proxy = '',   # local proxy host:port for Gradle, e.g. 127.0.0.1:10808 (asked for when Google Maven is unreachable)
  [switch]$NoProxy       # remove the proxy lines this script wrote to gradle.properties
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

# Proxy: Gradle needs Google's Maven (dl.google.com) at build time, which is blocked from Iran. If it is unreachable, ask for the
# local proxy (host:port), detect whether it speaks SOCKS5 or HTTP, and write it to gradle.properties between marker lines
# (replaced on every run, removed by -NoProxy). The proxy app must be running.
$proxyBegin = '# >>> dozari-build proxy (managed by scripts/build-android.ps1)'
$proxyEnd = '# <<< dozari-build proxy'
$mavenProbe = 'https://dl.google.com/dl/android/maven2/androidx/work/work-runtime-ktx/2.9.1/work-runtime-ktx-2.9.1.pom'

function Test-Url([string[]]$proxyArgs) {
  & curl.exe -s -o NUL -m 10 -f @proxyArgs $mavenProbe 2>&1 | Out-Null
  return ($LASTEXITCODE -eq 0)
}

function Set-GradleProxy([string]$hostPort, [string]$kind) {
  $hp = $hostPort -split ':'
  $lines = if ($kind -eq 'socks') {
    @("systemProp.socksProxyHost=$($hp[0])", "systemProp.socksProxyPort=$($hp[1])")
  } else {
    @("systemProp.http.proxyHost=$($hp[0])", "systemProp.http.proxyPort=$($hp[1])", "systemProp.https.proxyHost=$($hp[0])", "systemProp.https.proxyPort=$($hp[1])", 'systemProp.http.nonProxyHosts=localhost|127.0.0.1', 'systemProp.https.nonProxyHosts=localhost|127.0.0.1')
  }
  Remove-GradleProxy
  $current = if (Test-Path $props) { (Get-Content $props -Raw) } else { '' }
  $block = (@('', $proxyBegin) + $lines + @($proxyEnd)) -join "`r`n"
  Set-Content -Path $props -Value ($current.TrimEnd() + $block + "`r`n") -Encoding ascii
  Write-Host "==> Gradle proxy ($kind $hostPort) written to $props" -ForegroundColor Yellow
}

function Remove-GradleProxy {
  if (-not (Test-Path $props)) { return }
  $current = Get-Content $props -Raw
  $pattern = '(?s)\r?\n?' + [regex]::Escape($proxyBegin) + '.*?' + [regex]::Escape($proxyEnd) + '\r?\n?'
  Set-Content -Path $props -Value (([regex]::Replace($current, $pattern, "`r`n")).TrimEnd() + "`r`n") -Encoding ascii
}

if ($NoProxy) {
  Remove-GradleProxy
  Write-Host '==> Gradle proxy removed from gradle.properties' -ForegroundColor Yellow
} else {
  $hasProxy = (Test-Path $props) -and ((Get-Content $props -Raw) -match '(?m)^\s*systemProp\.(socksProxyHost|https?\.proxyHost)\s*=')
  if (-not $Proxy -and -not $hasProxy) {
    Write-Host '==> checking that Google Maven (needed by Gradle) is reachable' -ForegroundColor Cyan
    if (-not (Test-Url @())) {
      Write-Warning 'dl.google.com is not reachable directly (blocked from Iran). Start your proxy app first.'
      $Proxy = Read-Host 'Local proxy as host:port (e.g. 127.0.0.1:10808), empty to skip'
    }
  }
  if ($Proxy) {
    if ($Proxy -notmatch '^[^:\s]+:\d+$') { throw "Invalid proxy '$Proxy' (expected host:port, e.g. 127.0.0.1:10808)." }
    if (Test-Url @('--socks5-hostname', $Proxy)) { Set-GradleProxy $Proxy 'socks' }
    elseif (Test-Url @('--proxy', "http://$Proxy")) { Set-GradleProxy $Proxy 'http' }
    else { throw "dl.google.com is not reachable through $Proxy as SOCKS5 or HTTP. Check that the proxy app is on and the port is right (SOCKS and HTTP ports differ in v2rayN/Nekoray)." }
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
      Write-Host '==> still locked; stopping node/adb/clangd/ninja processes of this repository and waiting for the antivirus scan' -ForegroundColor Yellow
      Get-CimInstance Win32_Process -Filter "Name = 'node.exe' OR Name = 'adb.exe' OR Name = 'clangd.exe' OR Name = 'ninja.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -match [regex]::Escape($root) } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
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
