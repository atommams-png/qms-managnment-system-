@echo off
REM Code Exam Guard - Quick Start Script for Windows

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║     🚀 Code Exam Guard - MySQL Edition                   ║
echo ║     Quick Start Script                                    ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

setlocal enabledelayedexpansion

REM Colors (using echo with labels for simplicity)
echo 📋 Checking MySQL server...

mysql -h localhost -u root -p12345 -e "SELECT 1" >nul 2>&1
if errorlevel 1 (
    echo.
    echo ⚠️  MySQL server is not running!
    echo Please start MySQL service:
    echo   1. Windows Services: Search "Services" in Start Menu
    echo   2. Find "MySQL80" (or your MySQL version)
    echo   3. Right-click and select "Start"
    echo.
    pause
    exit /b 1
)

echo ✓ MySQL is running
echo.

REM Step 1: Initialize database
echo 📌 Step 1: Initializing database...
cd backend
call npm run init:db
if errorlevel 1 (
    echo.
    echo ⚠️  Database initialization failed!
    echo Check MySQL credentials and try again
    cd ..
    pause
    exit /b 1
)
echo.

REM Step 2: Start backend
echo 📌 Step 2: Starting backend server...
start "Backend - Code Exam Guard" npm run dev
echo ✓ Backend starting on port 5000
timeout /t 2 /nobreak
cd ..
echo.

REM Step 3: Start frontend
echo 📌 Step 3: Starting frontend application...
start "Frontend - Code Exam Guard" npm run dev
echo ✓ Frontend starting on port 5173
echo.

REM Show information
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║      ✅ Application Started Successfully!                 ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo 📱 Frontend:   http://localhost:5173
echo 🔌 Backend API: http://localhost:5000/api
echo 📊 Database:   localhost:3306/code_exam_guard
echo.
echo 📝 Admin Login:
echo    Username: admin
echo    Password: admin123
echo.
echo ℹ️  Two new terminal windows should have opened.
echo    Close them to stop the servers.
echo.
pause
