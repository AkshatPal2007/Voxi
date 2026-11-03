# Voxi

A Windows desktop companion with animated word-timed lyrics, automatic player detection, line-by-line fallback and a glowing fullscreen view.

## Install

Extract the release ZIP and run `Voxi_0.1.1_x64-setup.exe`. Open Voxi from the Start menu and play music. Windows 10/11 x64 is the target platform. Setup includes a WebView2 bootstrapper; internet may be required to install the runtime and retrieve lyrics. Recipients do not need development tools.

Automatic detection follows newly started Windows media playback. Settings offers a manual player override, colors, reduced motion, always-on-top and lyric import. Fisheye Visual is the default. Escape exits fullscreen. See [setup instructions](docs/SETUP-WINDOWS.txt).

## Build prerequisites

Use Windows x64 with Node.js 22 or later, Rust MSVC, Visual Studio C++ Build Tools with a Windows SDK, and WebView2.

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run desktop
```

## Build and distribute

Align version numbers in `package.json`, `package-lock.json`, `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json`, and update the setup guide.

```powershell
npm.cmd run desktop:build
.\scripts\package-windows.ps1
```

The optimized executable is in `src-tauri/target/release/`; the NSIS installer is in `src-tauri/target/release/bundle/nsis/`. The packaging script creates a versioned ZIP in `release/` with the installer, setup instructions, third-party notices and SHA-256 checksum.

Share the release ZIP, not the workspace or build caches. Keep dependency notices in distributions. Signing credentials belong in the build environment and must never be committed. The current preview is unsigned; installation on a clean second PC remains unverified. Before publishing, verify installation, playback detection, pause/seek, fullscreen exit and uninstall on another Windows PC.

## Lyrics and privacy

Voxi reads track metadata and playback state from Windows media sessions. LRCLIB receives metadata for lyric lookup. A public GitHub catalog provides additional timed lyrics. Optional LiriQo lookup sends title, artist and duration only when enabled in Settings. Coverage varies by provider and recording. Preferences are stored locally; no Spotify password is required.

Word timestamps animate individual words; line timestamps advance whole lines. Untimed text is manually scrollable. Local LRC and TTML imports are supported.

## Development

Built with Tauri, Rust, TypeScript, Vite and Three.js. `npm.cmd run dev` runs the browser preview without native media access. `npm.cmd run build` checks TypeScript and builds the frontend. `npm.cmd run desktop:portable` creates an executable without an installer, which still requires WebView2. The frontend build retains a deferred Three.js bundle-size advisory.
