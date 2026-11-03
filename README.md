# NPCStudio — сборка0.6.0

build.bat → dist/NPCStudio-0.6.0-fomod.zip. Инкрементально, без build-clean. Нужны MSVC14.44, CMake/Ninja/vcpkg, .NET10, Python и Skyrim.esm. Для автоматического завершения: NPCSTUDIO_NO_PAUSE=1.

Новый адаптер NPC/item renderer требует проверенный Phantasm0.3.0 ccf916f72d59. `python tools/phantasm.py --pack` проверяет SHA256/PE/API относительно NativePlugin/src/preview/PhantasmAPI.h и создаёт отдельный dist/NPCStudio-Phantasm-0.3.0-local.zip из ../SeverAction/97 Phantasm/00 Core. Это личный локальный архив зависимости, чужие бинарники в Git не добавляются. Пользователь устанавливает оба ZIP в MO2 при закрытой игре. Самостоятельно MO2/Skyrim не запускаются.

Pipeline: Mutagen генерация/проверка400slots, native compile + CTest2, stamp DLL/source SHA, FOMOD ZIP validation. `node tools/ui-tests/smoke.cjs` запускает Chrome headless с mock Phantasm: async/partial, аватары,3Dпредметы,100 camera inputs без перестройки roster и остальные страницы/операции. Эти тесты не доказывают FPS/отсутствие вылетов в Skyrim; сборка помечается build-tested, не user-tested.

Стабильная пользовательская точка — checkpoint-0.4.0-user-tested. Предыдущий0.5.1 вызвал GPU hang при вращении; новый0.6.0 ждёт ручного теста. Миграций старых co-save нет, тестировать с новой игры. Подробности и ABI — NativePlugin/docs/RENDERING_060.md.
