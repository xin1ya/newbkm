@echo off
rem Cuilan Islands - one-click dev server
cd /d "%~dp0"
title Cuilan Dev Server
where pnpm >nul 2>nul || (echo [ERROR] pnpm not found. Install Node.js 20+ then run: npm i -g pnpm & pause & exit /b 1)
if not exist node_modules (echo Installing dependencies... & call pnpm install || (echo [ERROR] pnpm install failed & pause & exit /b 1))
echo Starting dev server at http://localhost:5173/
echo Tips: add ?quick to skip the dream prologue, ?lite for low quality. Press Ctrl+C to stop.
start "" cmd /c "timeout /t 4 >nul & start http://localhost:5173/"
call pnpm dev
pause
