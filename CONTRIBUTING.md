# Contributing to Voxi

Voxi is a lyrics-first Windows music companion. Contributions to animation,
player support, lyric matching, accessibility, documentation and performance
are welcome. Open an issue to discuss large changes before implementing them.

## Run locally

Use Windows 10/11 x64, Node.js 22+, Rust's MSVC toolchain, Visual Studio C++
Build Tools with a Windows SDK, and Microsoft Edge WebView2.

```powershell
git clone https://github.com/AkshatPal2007/Voxi.git
cd Voxi
npm.cmd ci
npm.cmd test
npm.cmd run desktop
```

`npm.cmd run dev` opens a browser preview; native Windows playback and artwork
require the desktop app. Play music in Spotify desktop for the primary workflow.
No Spotify account credentials or API keys are needed by Voxi.

## Design and engineering

- Keep the animated lyrics readable and central. Customization should support them.
- Use genuine word timestamps. Keep line-only and untimed fallbacks honest.
- Preserve the existing TypeScript, Three.js and Tauri stack.
- Respect reduced motion, keyboard navigation and fullscreen Escape behavior.
- Avoid unnecessary dependencies, full-frame effects and work on every frame.
- Dispose of GPU resources and cancel obsolete asynchronous work.
- Disclose new network services and what playback information they receive.
- Keep changes focused; explain behavior and tradeoffs in the pull request.

## Verify a change

```powershell
npm.cmd test
npm.cmd run build
cargo check --locked --manifest-path src-tauri/Cargo.toml
```

For playback or rendering changes, also test the desktop app: track switches,
pause/resume, seeking, missing lyrics, fullscreen, and reduced motion. Record
what you actually checked and any limitations. Include before/after captures
for visual changes, with private windows and notifications excluded.

Use short original text in lyric test fixtures; do not submit full copyrighted
lyrics, recordings, account cookies or credentials. Third-party data and
services retain their own terms. Preserve dependency notices.

## Submit a pull request

Fork the repository, create a branch, make your change and open a pull request
against `main`. Link the issue, explain the user-visible result, and list your
checks. Small documentation and bug fixes can be submitted directly as PRs.
You do not need a contributor agreement. Contributions are made under this
repository's MIT license. Be respectful and constructive in discussions.

Report security issues using [SECURITY.md](SECURITY.md), not a public issue.
