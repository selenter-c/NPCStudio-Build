@echo off
title NPC Studio - Full Build (Clean Rebuild)
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File full-build.ps1 -Clean %*
pause