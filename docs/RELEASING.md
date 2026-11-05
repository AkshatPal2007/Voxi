# Preparing a Windows preview

Use `main` after the Windows checks pass. The manual **Build Windows preview**
GitHub Actions workflow creates a ZIP artifact; it does not publish a release.
Alternatively, build locally using the README instructions.

1. Align the version in `package.json`, `package-lock.json`,
   `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/tauri.conf.json`
   and `docs/SETUP-WINDOWS.txt`.
2. Run the tests, frontend build and locked native check.
3. Build the NSIS installer and run `scripts/package-windows.ps1`.
4. On a second Windows x64 PC, install the ZIP's setup file, start Spotify,
   verify detection, lyrics, pause/resume, seeking, artwork, fullscreen exit,
   reduced motion and uninstall. Test browser playback separately.
5. Review the packaged setup guide, MIT license, dependency notices and checksum.
   Check that the installer version matches the announced version.
6. Upload the versioned share ZIP to the intended download location. For Drive,
   enable link-based viewing and verify the link in a signed-out browser. Link
   to the ZIP so recipients also receive the notices and setup instructions.
7. Announce only features and platforms actually verified. Keep the preview's
   unsigned status and known limitations visible in the release notes.

Current 0.1.5 limitations: unsigned installer; no clean second-PC installation
test yet; external lyric providers have variable coverage and availability.
Word timing is not available for every song. Album ambience is experimental.

Do not distribute workspace archives, raw recordings, build caches, signing
material or personal environment files. Installer signing, if added later,
must use a separately secured build environment. A checksum verifies file
integrity; it is not a publisher signature.
