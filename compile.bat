@echo off
title NPC Studio - Compile Only (Incremental)
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File build-native.ps1 %*
pause