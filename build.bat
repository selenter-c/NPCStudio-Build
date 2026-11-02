@echo off
title NPC Studio - Full Build
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File full-build.ps1 %*
set "BuildResult=%ERRORLEVEL%"
if not defined NPCSTUDIO_NO_PAUSE pause
exit /b %BuildResult%
