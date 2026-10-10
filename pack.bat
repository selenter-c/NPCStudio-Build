@echo off
title NPC Studio - Pack FOMOD Only
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File pack-mo2.ps1 %*
pause