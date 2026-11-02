# NPCStudio — сборка0.5.1

build.bat → dist/NPCStudio-0.5.1-fomod.zip. Обычно инкрементально, без build-clean. Нужны MSVC14.44, CMake/Ninja/vcpkg, .NET10, Python и Skyrim.esm.

Только новая игра. Миграции и старое расположение80+80 удалены:400 последовательных слотов, первые200 женские. Адреса CLFM900+id/NPCB00+id/ACHRD00+id, максимумE8F, ESL. EspTool/Mutagen0.54.4 проверяет весь пул и schema3 манифест.

Обязательные CTest: актуальный co-save/история/границы/настройки и отказ от иных форматов; Direct3D WARP проверяет рендер. Pack проверяет source/DLL hashes, версию и51файл ZIP. UI: npm ci --prefix tools/ui-tests; node tools/ui-tests/smoke.cjs. Mock Chrome проверяет единые слоты, OrcRace, локали/палитру и прежние операции, пять страниц720p/1080p. Это не тест реального игрового Actor::SwitchRace.

Установку и игру выполняет пользователь. Инструкция и ограничения — NativePlugin/README.md. Предыдущие Git-теги сохранены для отката исходников, но исполняемый код не конвертирует старые сейвы.
