@echo off
chcp 65001 >nul
cd /d "%~dp0"
"%~dp0runtime\node.exe" --disable-warning=ExperimentalWarning "%~dp0server.cjs"
if errorlevel 1 pause
