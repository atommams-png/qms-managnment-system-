@echo off
REM ============================================================
REM Code Exam Guard - MySQL Database Setup Script
REM ============================================================
REM This script automates the database setup for Windows
REM Prerequisites: MySQL server installed and running

setlocal enabledelayedexpansion

echo.
echo ============================================================
echo Code Exam Guard - MySQL Database Setup
echo ============================================================
echo.

REM Configuration
set DB_USER=root
set DB_PASSWORD=root
set DB_NAME=code_exam_guard
set DB_HOST=localhost

echo Configuring with:
echo - Username: %DB_USER%
echo - Password: %DB_PASSWORD%
echo - Database: %DB_NAME%
echo - Host: %DB_HOST%
echo.

REM Step 1: Check if MySQL is installed
echo [Step 1] Checking MySQL installation...
where mysql >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: MySQL command not found in PATH
    echo Please make sure MySQL is installed and added to PATH
    pause
    exit /b 1
)
echo ✓ MySQL found
echo.

REM Step 2: Try to connect to MySQL
echo [Step 2] Testing MySQL connection...
mysql -h %DB_HOST% -u %DB_USER% -p%DB_PASSWORD% -e "SELECT 1;" >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Cannot connect to MySQL
    echo Possible causes:
    echo - MySQL server is not running
    echo - Incorrect username or password
    echo - MySQL is not listening on localhost:3306
    echo.
    echo Try:
    echo 1. Start MySQL: net start MySQL80
    echo 2. Verify credentials are correct
    echo.
    pause
    exit /b 1
)
echo ✓ MySQL connection successful
echo.

REM Step 3: Create database
echo [Step 3] Creating database '%DB_NAME%'...
mysql -h %DB_HOST% -u %DB_USER% -p%DB_PASSWORD% -e "CREATE DATABASE IF NOT EXISTS %DB_NAME%;"
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to create database
    pause
    exit /b 1
)
echo ✓ Database created
echo.

REM Step 4: Load schema
echo [Step 4] Loading schema...
if not exist "database\schema.sql" (
    echo ERROR: schema.sql not found in database\ directory
    echo Make sure you're running this script from the project root directory
    pause
    exit /b 1
)

mysql -h %DB_HOST% -u %DB_USER% -p%DB_PASSWORD% %DB_NAME% < database\schema.sql
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to load schema
    pause
    exit /b 1
)
echo ✓ Schema loaded successfully
echo.

REM Step 5: Load sample data (optional)
echo [Step 5] Loading sample data (optional)...
if exist "database\seed-data.sql" (
    setlocal enabledelayedexpansion
    set /p LOAD_SAMPLE="Load sample data? (y/n): "
    if /i "!LOAD_SAMPLE!"=="y" (
        mysql -h %DB_HOST% -u %DB_USER% -p%DB_PASSWORD% %DB_NAME% < database\seed-data.sql
        if %ERRORLEVEL% NEQ 0 (
            echo WARNING: Failed to load sample data
        ) else (
            echo ✓ Sample data loaded
        )
    ) else (
        echo - Skipped sample data
    )
    endlocal
) else (
    echo WARNING: seed-data.sql not found
)
echo.

REM Step 6: Verify installation
echo [Step 6] Verifying installation...
mysql -h %DB_HOST% -u %DB_USER% -p%DB_PASSWORD% %DB_NAME% -e "SHOW TABLES;" >temp_tables.txt 2>&1

setlocal enabledelayedexpansion
set TABLES=0
for /f "skip=1" %%A in (temp_tables.txt) do (
    set /a TABLES+=1
)
del temp_tables.txt

if %TABLES% GEQ 6 (
    echo ✓ All tables created successfully (%TABLES% tables found)
) else (
    echo WARNING: Expected 6+ tables but found %TABLES%
)
echo.

REM Step 7: Show connection details
echo ============================================================
echo Setup Complete!
echo ============================================================
echo.
echo Connection Details:
echo - Host: %DB_HOST%
echo - Port: 3306
echo - User: %DB_USER%
echo - Password: %DB_PASSWORD%
echo - Database: %DB_NAME%
echo.
echo Default Admin User:
echo - Username: admin
echo - Password: admin123
echo.
echo Next Steps:
echo 1. Test connection with:
echo    mysql -u %DB_USER% -p%DB_PASSWORD% %DB_NAME% -e "SHOW TABLES;"
echo.
echo 2. Create your .env file with:
echo    DB_HOST=localhost
echo    DB_PORT=3306
echo    DB_USER=%DB_USER%
echo    DB_PASSWORD=%DB_PASSWORD%
echo    DB_NAME=%DB_NAME%
echo.
echo 3. Set up Node.js backend:
echo    npm install mysql2 express dotenv
echo    Copy database-api.js to your backend
echo.
echo ============================================================
echo.
pause
