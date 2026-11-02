# NPCStudio — сборка 0.2

Запуск: build.bat. Вывод: dist/NPCStudio-0.2.0-fomod.zip.

Нужны MSVC v143 14.44 (в установленной VS), CMake, Ninja, vcpkg, Python, .NET SDK 10 и установленный Skyrim.esm. build-esp.ps1 принимает -SkyrimData; автоматически проверяет SKYRIM_FOLDER, реестр и локальную Steam-установку.

1. EspTool (Mutagen.Bethesda.Skyrim 0.54.4) генерирует пул и повторно проверяет ESP и slots.json.
2. build-native.ps1 собирает DLL и запускает CTest. В build/NPCStudio.build.json записываются хеши исходников и DLL.
3. pack-mo2.ps1 проверяет ESP, актуальность DLL, версию, обязательные файлы, FOMOD и ZIP. Отсутствующая DLL и старые PrismaUI/PSC в payload считаются ошибками. Основные проверки обязательны даже при устаревшем -SkipValidation.

build-native.ps1 -Fresh сбрасывает только CMake cache после смены toolchain. build-clean.bat выполняет полную пересборку; обычно не нужен.

UI smoke: npm ci --prefix tools/ui-tests, затем node tools/ui-tests/smoke.cjs. Нужен установленный Chrome; используется отдельный headless-контекст и mock bridge. Это не тест Magelight в игре.

Проверено: build.bat exit 0, CTest, UI smoke, ESP и FOMOD. В игре подтверждена загрузка DLL/пула/view. Спавн/save/restart/load ожидают ручного теста, поэтому контрольная точка не является стабильным игровым релизом.
