# NPCStudio — сборка 0.5

build.bat → dist/NPCStudio-0.5.0-fomod.zip. Инкрементальная сборка; build-clean.bat обычно не нужен. MSVCv14314.44, CMake/Ninja/vcpkg, .NET10, Python, установленный Skyrim.esm.

EspTool Mutagen0.54.4:400NPC/400ACHR/400CLFM, CELL/XMarker, манифест schema2. Пул/адреса с0.4 неизменны, ESL сохранён.

Native CTest: co-save/история/границы400, язык системы/сохранённый выбор/миграция Shift+F8/валидация настроек; Direct3D WARP: HLSL, кадры/портрет PNG, камера/свет, восстановление viewport. Эти проверки обязательны. Pack проверяет source/DLL hashes и версию, UI/i18n/40наборов/ESP/FOMOD/ZIP.

UI: npm ci --prefix tools/ui-tests; node tools/ui-tests/smoke.cjs. Отдельный headless Chrome с mock bridge: локали/палитра/расы/портреты/камера и все прежние операции, пять страниц720p/1080p. Mock не читает реальный NPC; скриншоты Native/docs/ui-050-*.png явно содержат MOCK RENDERER.

Установку/запуск выполняет пользователь. 0.4 подтверждена в игре, 0.5 требует ручной проверки рендера и рас. Сохранять отдельный старый сейв и пользовательские JSON при обновлении.
