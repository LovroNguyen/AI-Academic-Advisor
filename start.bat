@echo off
rem Starts AcadAI: backend (port 3000), frontend (port 5173) and face service (port 8001),
rem each in its own window. Run setup.bat once before the first start.
cd /d %~dp0
if not exist backend\.env (echo Run setup.bat first. & pause & exit /b 1)

start "AcadAI backend" cmd /k "cd /d %~dp0backend && npm run start:dev"
start "AcadAI frontend" cmd /k "cd /d %~dp0frontend && npm run dev"
if exist face-service\venv\Scripts\python.exe (
  start "AcadAI face service" cmd /k "cd /d %~dp0face-service && venv\Scripts\python.exe main.py"
) else (
  echo Face service not installed: face attendance is unavailable, everything else works.
)

echo Waiting for the servers to start...
timeout /t 20 /nobreak >nul
start "" http://localhost:5173
echo AcadAI is opening in your browser: http://localhost:5173
echo Close the three server windows to stop it.
