# NPC Studio — Build System

> **Автор:** Selenter
> **Версия:** 0.1.0
> **Обновлено:** 2026-10-10

## Описание

Скрипты для генерации ESP, компиляции C++ плагина и упаковки мода NPC Studio в FOMOD-архив для Mod Organizer 2.

**НЕ содержит исходный код** — только скрипты сборки.

## Требования

| Инструмент | Мин. версия | Назначение |
|-----------|-------------|-----------|
| Visual Studio 2022+ | 17.x / 18.x | C++ компилятор (MSVC) |
| CMake | 3.24+ | Генерация build-файлов |
| Git | 2.x | FetchContent для зависимостей |
| Python | 3.8+ | Генерация ESP файла |
| vcpkg | latest | Управление зависимостями |

### Установка vcpkg (если не установлен)

```powershell
git clone https://github.com/microsoft/vcpkg.git C:\vcpkg --depth 1
C:\vcpkg\bootstrap-vcpkg.bat -disableMetrics
C:\vcpkg\vcpkg.exe install spdlog:x64-windows nlohmann-json:x64-windows fmt:x64-windows rapidcsv:x64-windows
```

## Скрипты

### PowerShell (.ps1)

| Файл | Назначение |
|------|-----------|
| `build-esp.ps1` | Генерация NPCStudio.esp через Python |
| `build-native.ps1` | Компиляция C++ плагина через CMake + Ninja + MSVC |
| `pack-mo2.ps1` | Упаковка в FOMOD .zip для MO2 |
| `full-build.ps1` | **Всё в одном:** ESP → компиляция → упаковка |

### Batch (.bat) — запуск двойным кликом

| Файл | Назначение |
|------|-----------|
| `build.bat` | Полная сборка (incremental, ~10s) |
| `build-clean.bat` | Полная сборка с нуля (~3min) |
| `compile.bat` | Только компиляция C++ |
| `pack.bat` | Только упаковка FOMOD |
| `esp.bat` | Только генерация ESP |

## Быстрый старт

**Двойной клик по `build.bat`** — или из консоли:

```powershell
cd NPCStudio-Build
.\full-build.ps1
```

Результат: `NPCStudio-Build/dist/NPCStudio-0.1.0-fomod.zip`

## Использование

| Команда | Описание | Время |
|---------|----------|-------|
| `build.bat` | Полная сборка (incremental) | ~10s |
| `build-clean.bat` | Полная сборка с нуля | ~3min |
| `compile.bat` | Только компиляция | ~5s |
| `pack.bat` | Только упаковка | ~2s |
| `esp.bat` | Только генерация ESP | <1s |

### Параметры (для .ps1 скриптов)

```powershell
.\full-build.ps1 -Clean             # Полная пересборка
.\full-build.ps1 -Config Debug      # Debug-конфигурация
.\build-native.ps1 -Clean           # Только чистая компиляция
```

## Структура вывода

```
NPCStudio-Build/
├── output/                    # Временные файлы (staging)
│   └── staging/               # Сборка структуры FOMOD
├── dist/                      # Финальные артефакты
│   └── NPCStudio-X.Y.Z-fomod.zip
├── build-esp.ps1              # Генерация ESP
├── build-native.ps1           # Компиляция C++
├── pack-mo2.ps1               # Упаковка FOMOD
├── full-build.ps1             # Полный цикл
└── README.md                  # Этот файл
```

## Как это работает

### build-esp.ps1
1. Проверяет наличие Python
2. Генерирует минимальный TES4 плагин (NPCStudio.esp)
3. Результат: `NPCStudio-GamePlugin/Data/NPCStudio.esp`

### build-native.ps1
1. Находит vcvarsall.bat (VS 2022 или VS 2026 Insiders)
2. Запускает cmake configure с Ninja + vcpkg toolchain
3. Запускает cmake build
4. Результат: `NPCStudio-NativePlugin/build/NPCStudio.dll`

### pack-mo2.ps1
1. Читает версию из `fomod/info.xml`
2. Копирует содержимое `Data/` в staging (без папки Data/)
3. Копирует `NPCStudio.dll` в `SKSE/Plugins/`
4. Копирует `fomod/` в staging
5. Создаёт .zip через .NET ZipArchive (forward-slash пути для FOMOD)
6. Валидирует архив
7. Результат: `dist/NPCStudio-X.Y.Z-fomod.zip`

### full-build.ps1
1. Запускает build-esp.ps1 (генерация ESP)
2. Запускает build-native.ps1 (компиляция DLL)
3. Запускает pack-mo2.ps1 (упаковка FOMOD)
4. Выводит итоговый путь к архиву

## Структура FOMOD архива

```
NPCStudio-X.Y.Z-fomod.zip/
├── NPCStudio.esp              ← Плагин Skyrim
├── SKSE/
│   └── Plugins/
│       ├── NPCStudio.dll      ← C++ SKSE плагин
│       ├── NPCStudio_DISTR.ini
│       └── NPCsNamesDistributor/
│           └── NPCStudio_Names.json
├── Scripts/
│   └── Source/
│       ├── NPCStudio_Manager.psc
│       ├── NPCStudio_PlayerAlias.psc
│       ├── NPCStudio_MCM.psc
│       ├── NPCStudio_InputHandler.psc
│       └── NPCStudio_Utils.psc
├── PrismaUI/
│   └── views/
│       └── NPCStudio/
│           ├── index.html
│           ├── style.css
│           └── script.js
└── fomod/
    ├── info.xml
    └── ModuleConfig.xml
```

## Troubleshooting

| Проблема | Решение |
|----------|---------|
| "Python not found" | Установите Python 3.8+ и добавьте в PATH |
| "cmake not found" | Установите CMake 3.24+ и добавьте в PATH |
| "vcvarsall.bat not found" | Установите Visual Studio с компонентом "Desktop development with C++" |
| "vcpkg not found" | Установите vcpkg (см. выше) и укажите `-VcpkgRoot` |
| "spdlog not found" | Запустите `vcpkg install spdlog:x64-windows` |
| "Ninja not found" | Скрипт автоматически ищет Ninja в VS; если нет — установите через `vcpkg install ninja` |
| ZIP с backslash | Не используйте Compress-Archive; pack-mo2.ps1 использует .NET ZipArchive |
| MO2: "SelectExactlyOne" error | Используйте `type="SelectAll"` в ModuleConfig.xml для одного плагина |