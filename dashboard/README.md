# PS5 Reborn Dashboard

Standalone Windows launcher built from the PS5 Reborn theme assets. It uses a Tauri/WebView2 window, supports keyboard and standard-layout gamepad input, and starts Kyty without invoking a command shell.

## Build

Install Node.js, Rust, the Visual Studio C++ Build Tools, and WebView2. From this folder:

```powershell
npm install
npm run build
```

The Windows installer is produced under `src-tauri/target/release/bundle/nsis`. The standalone executable is under `src-tauri/target/release/ps5_reborn_dashboard.exe`.

Alternatively, push the workspace root (the parent folder containing both `dashboard` and `.github`) to GitHub. The workflow builds on a Windows runner; download the `ps5-reborn-windows` artifact from the Actions run.

## Library and Kyty

On first launch the app creates `games.json` in its Windows app-data folder and pre-fills the Kyty path and `PPSA37001` game path supplied for this setup. Use Settings to add/remove games, choose cover/background/logo images, or change the emulator path and launch arguments. Artwork is resized and stored in the local JSON library. Each argument goes on its own line; `{gamePath}`, `{gameId}`, and `{title}` are replaced before Kyty starts. Defaults use Kyty's `--game <path> --fullscreen` options.

The first launch also shows an original setup flow for the English interface, controller connection, and Kyty path. Its completion state is saved in `games.json`, so it is only shown once. A controller is optional during setup; use a keyboard or connect one later.

The dashboard starts fullscreen, minimizes while Kyty runs, and restores after the emulator process exits.

Gamepad navigation uses the browser's standard Gamepad API mapping: D-pad/left stick to browse, Cross to launch, Circle to return, L1/R1 to switch Games/Media, and Options to open Settings.
