@echo off
chcp 437 >nul
title OpenClaw Local Browser Proxy
color 0A

echo ==========================================
echo   OpenClaw Local Browser Proxy Launcher
echo ==========================================
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Please install Python first.
    pause
    exit /b 1
)

:: Check ngrok
ngrok version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] ngrok not found. Please install ngrok.
    echo Download: https://ngrok.com/download
    echo Add ngrok.exe to your PATH environment variable.
    pause
    exit /b 1
)

:: Check dependencies
echo [1/4] Checking dependencies...
python -c "import fastapi, uvicorn" >nul 2>&1
if errorlevel 1 (
    echo Installing dependencies...
    pip install fastapi uvicorn -q
)
echo     Dependencies OK
echo.

:: Start local_browser.py
echo [2/4] Starting Local Browser Proxy...
start "Local Browser Proxy" cmd /k "cd /d %~dp0 && python local_browser.py"
echo     Proxy running at http://127.0.0.1:8790
echo.

:: Wait for proxy to start
timeout /t 2 /nobreak >nul

:: Start ngrok
echo [3/4] Starting ngrok tunnel...
start "Ngrok Tunnel" cmd /k "ngrok http 8790"
echo     ngrok starting...
echo.

:: Wait for ngrok to start
timeout /t 5 /nobreak >nul

echo [4/4] Done!
echo.
echo ==========================================
echo   HOW TO USE
echo ==========================================
echo.
echo Local Proxy: http://127.0.0.1:8790
echo.
echo Get your public URL from the ngrok window
echo (e.g., https://abc123.ngrok-free.app)
echo.
echo Configure your Bot:
echo   1. SSH to your Linux server
echo   2. Edit .env file
echo   3. Add: LOCAL_BROWSER_PROXY=https://abc123.ngrok-free.app
echo   4. Restart the bot
echo.
echo Usage in Telegram:
echo   Local open https://bilibili.com
echo.
echo ==========================================
echo.
pause

:: Stop processes
taskkill /FI "WINDOWTITLE eq Local Browser Proxy" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Ngrok Tunnel" /F >nul 2>&1

echo Stopped.
timeout /t 2 /nobreak >nul
