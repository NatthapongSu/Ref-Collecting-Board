@echo off
echo ========================================
echo   Art Board - Quick Start
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

echo [INFO] Node.js found: 
node --version
echo.

:: Check if dependencies are installed
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
    echo [OK] Dependencies installed!
    echo.
)

:: Ask user what they want to do
echo What would you like to do?
echo.
echo 1. Start development server
echo 2. Build for production
echo 3. Preview production build
echo 4. Exit
echo.
set /p choice="Enter your choice (1-4): "

if "%choice%"=="1" goto dev
if "%choice%"=="2" goto build
if "%choice%"=="3" goto preview
if "%choice%"=="4" goto exit
goto invalid

:dev
echo.
echo [INFO] Starting development server...
echo.
echo   App will open at: http://localhost:3000
echo   Press Ctrl+C to stop the server
echo.
call npm run dev
goto end

:build
echo.
echo [INFO] Building for production...
echo.
call npm run build
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Build failed!
    pause
    exit /b 1
)
echo.
echo [OK] Build completed!
echo     Output folder: dist/
echo.
echo To deploy to GitHub Pages:
echo   1. Push your code to GitHub
echo   2. Enable GitHub Pages in repository settings
echo   3. Select "GitHub Actions" as source
echo.
echo See DEPLOYMENT.md for detailed instructions.
goto end

:preview
echo.
echo [INFO] Starting preview server...
echo.
call npm run preview
goto end

:invalid
echo.
echo [ERROR] Invalid choice!
goto end

:exit
echo.
echo Goodbye!
goto end

:end
pause
