# NPCStudio — сборка 0.3.1

Запуск: build.bat. Вывод: dist/NPCStudio-0.3.1-fomod.zip.

Нужны MSVC v143 14.44 (в установленной VS), CMake, Ninja, vcpkg, Python, .NET SDK 10 и установленный Skyrim.esm. build-esp.ps1 принимает -SkyrimData; автоматически проверяет SKYRIM_FOLDER, реестр и локальную Steam-установку.

1. EspTool (Mutagen.Bethesda.Skyrim 0.54.4) генерирует пул и повторно проверяет ESP и slots.json.
2. build-native.ps1 собирает DLL и запускает CTest. В build/NPCStudio.build.json записываются хеши исходников и DLL.
3. pack-mo2.ps1 проверяет ESP, актуальность DLL, версию, обязательные файлы, 16 встроенных наборов снаряжения, FOMOD и ZIP. Отсутствующая DLL и старые PrismaUI/PSC в payload считаются ошибками. Основные проверки обязательны даже при устаревшем -SkipValidation.

build-native.ps1 -Fresh сбрасывает только CMake cache после смены toolchain. build-clean.bat выполняет полную пересборку; обычно не нужен.

UI smoke: npm ci --prefix tools/ui-tests, затем node tools/ui-tests/smoke.cjs. Нужен установленный Chrome; используется отдельный headless-контекст и mock bridge. Это не тест Magelight в игре.

Проверено: build.bat exit 0, CTest, UI smoke (включая снаряжение), ESP и FOMOD. Работа основы 0.2 подтверждена пользователем в игре. Снаряжение 0.3 ожидает ручного теста; это сборочная контрольная точка.

0.3.1: генератор проверяет резервный persistent REFR 000801/XMarker. FOMOD/ZIP обязательно включают NPCStudio_NND_DISTR.ini. UI smoke покрывает подтверждение/отмену удаления, освобождение и повторное назначение слота, новую identity и отклонение старой команды. Нативные тесты проверяют roundtrip удалённого и повторно назначенного слота и валидацию identity.
