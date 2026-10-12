@echo off
title Art Board - Build Production
echo ========================================
echo   Building Art Board for Production
echo ========================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Check if node_modules exists
if not exist "node_modules\" (
    echo [INFO] Installing dependencies...
    echo.
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Failed to install dependencies!
        pause
        exit /b 1
    )
    echo.
)

:: Build the project
echo [INFO] Building production bundle...
echo.
call npm run build

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Build failed!
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Build completed successfully!
echo ========================================
echo.
echo   Output folder: dist/
echo   Open dist/index.html in a browser
echo   Or run: npx serve dist
echo.
pause
