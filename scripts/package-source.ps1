$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$stage = Join-Path $projectRoot ('release/source-clean-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage | Out-Null
$files = @('README.md','LICENSE','CONTRIBUTING.md','SECURITY.md','package.json','package-lock.json','tsconfig.json','vite.config.ts','index.html','.gitignore')
$files += Get-ChildItem -LiteralPath (Join-Path $projectRoot 'src') -File -Recurse | ForEach-Object { $_.FullName.Substring($projectRoot.Length+1) }
$files += @('src-tauri/Cargo.toml','src-tauri/Cargo.lock','src-tauri/build.rs','src-tauri/tauri.conf.json','scripts/package-windows.ps1')
foreach ($folder in @('src-tauri/src','src-tauri/icons','src-tauri/capabilities','docs','.github')) {
  $files += Get-ChildItem -LiteralPath (Join-Path $projectRoot $folder) -File -Recurse | ForEach-Object { $_.FullName.Substring($projectRoot.Length+1) }
}
foreach ($file in $files) {
  $source = Join-Path $projectRoot $file
  if ([IO.Path]::GetExtension($file) -notin @('.png','.ico','.icns')) {
    $content = Get-Content -LiteralPath $source -Raw
    if ($content -match '(?i)[A-Z]:[\\/]+Users[\\/]+|github_pat_[A-Za-z0-9_]+|ghp_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY') { throw "Sensitive pattern found in $file; packaging stopped." }
  }
  $destination = Join-Path $stage $file
  New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
  Copy-Item -LiteralPath $source -Destination $destination
}
$zip = Join-Path $projectRoot 'release/Voxi-deployment-source.zip'
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -Force
Write-Output "Clean source archive: $zip"
Write-Output "Reviewed and packaged $($files.Count) allowlisted files."
