@echo off
rem AcadAI one-time setup: installs dependencies, creates .env files, the database and demo data.
cd /d %~dp0
where node >nul 2>nul || (echo Node.js 20.12 or newer is required: https://nodejs.org & pause & exit /b 1)
node setup.mjs %*
pause
