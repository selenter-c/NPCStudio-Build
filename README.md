# NPC Studio Build Tools

Build and package [NPC Studio](https://github.com/selenter-c/NPCStudio-GamePlugin) for the supported Steam and GOG builds of Skyrim Special Edition. NPC Studio creates blank, persistent NPCs for editing in game and for AI-driven playthroughs with [SkyrimNet](https://github.com/MinLL/SkyrimNet-GamePlugin).

[**Get the latest release**](https://github.com/selenter-c/NPCStudio-GamePlugin/releases/latest) · [Game data and UI](https://github.com/selenter-c/NPCStudio-GamePlugin) · [Native source](https://github.com/selenter-c/NPCStudio-NativePlugin)

## Requirements

- Windows, Git, and Visual Studio Build Tools with the C++ desktop workload.
- CMake 3.24+, Ninja, and vcpkg. Set `VCPKG_ROOT` if vcpkg is outside `C:\vcpkg`.
- .NET SDK 10 for the Mutagen ESP tool and Python 3 for packaging.
- A local copy of `Skyrim.esm`. Set `SKYRIM_FOLDER` to your Skyrim installation root if the game is outside the detected paths.

Player runtime requirements and installation are in the [GamePlugin README](https://github.com/selenter-c/NPCStudio-GamePlugin#requirements).

## Build

Check out the three repositories side by side.

```text
NPCStudio/
  NPCStudio-Build/
  NPCStudio-GamePlugin/
  NPCStudio-NativePlugin/
```

Run these commands from `NPCStudio-Build` in PowerShell.

```powershell
.\build.bat
.\build-clean.bat
```

The incremental build regenerates and validates the ESP, compiles the shared native DLL for all five runtimes, runs CTest, and writes `dist/NPCStudio-0.8.11-fomod.zip`. Use the clean build when the native toolchain or its dependencies change.

To repackage an existing, verified NPC Studio DLL, run `.\pack-mo2.ps1`.

## Test the UI

The optional browser smoke test requires Node.js, Playwright, and Google Chrome.

```powershell
npm --prefix tools/ui-tests ci
node tools/ui-tests/smoke.cjs
```

The headless test exercises the editor against a mocked game bridge. In-game tests use Skyrim and MO2.

## Credits

The build uses [Mutagen](https://github.com/Mutagen-Modding/Mutagen) for plugin records and [CommonLibSSE-NG](https://github.com/alandtse/CommonLibVR) for the native plugin. [SkyrimNet](https://github.com/MinLL/SkyrimNet-GamePlugin), [IntelEngine](https://github.com/galanx/IntelEngine-GamePlugin), and [SeverActions](https://github.com/Severause/SeverActions) informed the project structure and integration. See the [GamePlugin credits](https://github.com/selenter-c/NPCStudio-GamePlugin#credits) for the full list.

Developed with **OpenAI Codex**, which helped solve implementation, build, packaging, and validation problems.
