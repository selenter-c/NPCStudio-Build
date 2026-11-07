# NPC Studio Build Tools

Build and package [NPC Studio](https://github.com/selenter-c/NPCStudio-GamePlugin) for Skyrim Special Edition 1.6.1170. NPC Studio creates blank, persistent NPCs for editing in game and for AI-driven playthroughs with [SkyrimNet](https://github.com/MinLL/SkyrimNet-GamePlugin).

[**Get the beta**](https://github.com/selenter-c/NPCStudio-GamePlugin/releases) · [Game data and UI](https://github.com/selenter-c/NPCStudio-GamePlugin) · [Native source](https://github.com/selenter-c/NPCStudio-NativePlugin)

## Requirements

- Windows, Git, and Visual Studio Build Tools with the C++ desktop workload.
- CMake 3.24+, Ninja, and vcpkg. Set `VCPKG_ROOT` if vcpkg is outside `C:\vcpkg`.
- .NET SDK 10 for the Mutagen ESP tool and Python 3 for packaging.
- A local copy of `Skyrim.esm`. Set `SKYRIM_FOLDER` to your Skyrim installation root if the game is outside the detected paths.
- For the browser smoke test, Node.js, Playwright, and Google Chrome.

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

The incremental build regenerates and validates the ESP, compiles the native DLL, runs CTest, and writes `dist/NPCStudio-0.8.7-beta.2-fomod.zip`. Use the clean build when the native toolchain or its dependencies change.

To repackage an existing, verified DLL, run `.pack-mo2.ps1`. For a local-only archive that includes Phantasm, place the renderer from [SeverActions 4.7.0](https://github.com/Severause/SeverActions/releases/tag/v4.7.0) in the sibling path `SeverAction/97 Phantasm/00 Core` and run `.pack-mo2.ps1 -IncludePhantasm`. The packer verifies the exact renderer binary before producing a separate local archive. The release archive expects the renderer to be installed from upstream.

## Test the UI

```powershell
npm --prefix tools/ui-tests ci
node tools/ui-tests/smoke.cjs
```

The headless test exercises the editor against a mocked game bridge. In-game tests use Skyrim and MO2.

## Credits

The build uses [Mutagen](https://github.com/Mutagen-Modding/Mutagen) for plugin records and [CommonLibSSE-NG](https://github.com/alandtse/CommonLibVR) for the native plugin. [SkyrimNet](https://github.com/MinLL/SkyrimNet-GamePlugin), [IntelEngine](https://github.com/galanx/IntelEngine-GamePlugin), and [SeverActions](https://github.com/Severause/SeverActions) informed the project structure and integration. See the [GamePlugin credits](https://github.com/selenter-c/NPCStudio-GamePlugin#credits) for the full list.

Developed with **OpenAI Codex**, which helped solve implementation, build, packaging, and validation problems.
