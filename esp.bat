@echo off
title NPC Studio - Generate ESP Only
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File build-esp.ps1 %*
pause