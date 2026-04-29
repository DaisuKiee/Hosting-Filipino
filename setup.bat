@echo off
REM Discord Bot Panel - Setup Script for Windows
REM This script helps set up the project for first-time users

echo.
echo Discord Bot Panel - Setup Script
echo ====================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Node.js is installed
node -v
echo.

REM Check if npm is installed
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm is not installed!
    pause
    exit /b 1
)

echo [OK] npm is installed
npm -v
echo.

REM Create .env file if it doesn't exist
if not exist .env (
    echo Creating .env file...
    copy .env.example .env
    echo [OK] .env file created
    echo [WARNING] Please edit .env file with your MongoDB URI and other settings
    echo.
) else (
    echo [OK] .env file already exists
    echo.
)

REM Create bot-data directory if it doesn't exist
if not exist bot-data (
    echo Creating bot-data directory...
    mkdir bot-data
    echo [OK] bot-data directory created
    echo.
) else (
    echo [OK] bot-data directory already exists
    echo.
)

REM Install dependencies
echo Installing dependencies...
echo This may take a few minutes...
echo.

REM Install server dependencies
echo Installing server dependencies...
call npm install

REM Install client dependencies
echo Installing client dependencies...
cd client
call npm install
cd ..

echo.
echo [OK] All dependencies installed!
echo.

REM Check if MongoDB URI is set
findstr /C:"your_mongodb_connection_string" .env >nul
if %ERRORLEVEL% EQU 0 (
    echo [WARNING] MongoDB URI not configured!
    echo Please edit .env file and set your MONGODB_URI
    echo.
)

REM Check if JWT_SECRET is set
findstr /C:"your_super_secret_jwt_key_here" .env >nul
if %ERRORLEVEL% EQU 0 (
    echo [WARNING] JWT_SECRET not configured!
    echo Please edit .env file and set a secure JWT_SECRET
    echo.
)

echo Setup complete!
echo.
echo Next steps:
echo 1. Edit .env file with your configuration
echo 2. Run 'npm run dev' to start the application
echo 3. Open http://localhost:3000 in your browser
echo 4. Login with default credentials:
echo    Email: admin@panel.local
echo    Password: admin123
echo.
echo [WARNING] Remember to change the default password after first login!
echo.
pause
