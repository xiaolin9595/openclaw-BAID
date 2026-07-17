@echo off
chcp 65001 >nul
cd /d %~dp0
echo ========================================
echo SwiftClaw Local Bot
echo ========================================
echo.
echo Token: 8625282945:AAGvXmmXBzUDDIvOB6beyeZcH4ssbFs3CjQ
echo Config: .env.local
echo Port: 8001
echo.
echo Make sure local_browser.py is running!
echo.

set ENV_FILE=.env.local

REM Check dependencies
python -c "import fastapi" 2>nul
if errorlevel 1 (
    echo Installing dependencies...
    pip install -q fastapi uvicorn
)

python main.py

pause
