@echo off
title Art Board - Production Server
echo ========================================
echo   Art Board - Production Server
echo ========================================
echo.

:: Check if dist folder exists
if not exist "dist\" (
    echo [ERROR] Production build not found!
    echo Please run build.bat first.
    pause
    exit /b 1
)

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Check if serve is installed
where serve >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [INFO] Installing serve package globally...
    echo.
    call npm install -g serve
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Failed to install serve!
        echo You can manually serve the dist/ folder with any HTTP server.
        pause
        exit /b 1
    )
)

echo [INFO] Starting production server...
echo.
echo   App will open at: http://localhost:3000
echo   Press Ctrl+C to stop the server
echo.
echo ========================================
echo.

:: Open browser after a short delay
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000"

:: Serve the dist folder
call serve dist -l 3000

pause
