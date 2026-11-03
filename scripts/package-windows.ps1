$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$config = Get-Content -LiteralPath (Join-Path $projectRoot 'src-tauri/tauri.conf.json') -Raw | ConvertFrom-Json
$releaseName = "Voxi_$($config.version)_x64"
$installerName = "$releaseName-setup.exe"
$installerPath = Join-Path $projectRoot "src-tauri/target/release/bundle/nsis/$installerName"
if (-not (Test-Path -LiteralPath $installerPath)) { throw 'Build the NSIS installer with npm.cmd run desktop:build first.' }
$shareFolder = Join-Path $projectRoot "release/$releaseName"
New-Item -ItemType Directory -Path $shareFolder -Force | Out-Null
Copy-Item -LiteralPath $installerPath -Destination (Join-Path $shareFolder $installerName) -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs/SETUP-WINDOWS.txt') -Destination (Join-Path $shareFolder 'SETUP.txt') -Force
if (Test-Path -LiteralPath (Join-Path $projectRoot 'docs/THIRD-PARTY-NOTICES.txt')) {
  Copy-Item -LiteralPath (Join-Path $projectRoot 'docs/THIRD-PARTY-NOTICES.txt') -Destination $shareFolder -Force
}
$hash = Get-FileHash -LiteralPath (Join-Path $shareFolder $installerName) -Algorithm SHA256
"$($hash.Hash.ToLowerInvariant())  $installerName" | Set-Content -LiteralPath (Join-Path $shareFolder 'SHA256SUMS.txt') -Encoding ascii
$zipPath = Join-Path $projectRoot "release/$releaseName-share.zip"
Compress-Archive -LiteralPath $shareFolder -DestinationPath $zipPath -Force
Write-Output "Share package: $zipPath"
Write-Output "Installer SHA256: $($hash.Hash)"
