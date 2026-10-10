@echo off
title NPC Studio - Full Build (Incremental)
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File full-build.ps1 %*
pause