# NPCStudio — сборка 0.4

build.bat → dist/NPCStudio-0.4.0-fomod.zip. Обычно инкрементальная сборка; build-clean.bat не требуется. Нужны MSVCv14314.44, CMake/Ninja/vcpkg, .NET10, Python, установленный Skyrim.esm.

EspTool Mutagen0.54.4:400NPC/400ACHR/400CLFM, CELL/XMarker, schema2 манифест. Старые160слотов не перенумеровываются. Новые диапазоны не пересекаются и укладываются в ESL.

Native CTest:version1→2, история, приоритет новых, границы400, пол/номер новых блоков, старые co-save, некорректные имена/идентичности. Pack проверяет хешиDLL/исходников, версию, обязательный payload,40наборов с category, FOMOD иZIP. Основные проверки нельзя отключить SkipValidation.

UI: npm ci --prefix tools/ui-tests, node tools/ui-tests/smoke.cjs. Установленный Chrome, отдельный headless контекст, mock bridge; не проверяет игровой движок. Проверены5страниц на720p/1080p, portalcombo/search, спавн скомплектом, слоты/история/повторный/399, категории, имена, настройки, командысidentity. Скриншоты Native/docs/ui-040-*.png — mock.

Сборка и упаковка не означают прохождения игрового теста. Установку и запуск выполняет пользователь. Для отката на0.3 нужен старый сейв: poolVersion2 несовместима со старым DLL. Пользовательские файлы не перезаписывать.
