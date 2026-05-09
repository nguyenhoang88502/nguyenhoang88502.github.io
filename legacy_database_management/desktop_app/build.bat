@echo off
echo ================================
echo  BOM Dataset Indexer - Build
echo ================================
echo.

REM Check for Python
python --version >nul 2>&1
if errorlevel 1 (
    echo Python is not installed or not in PATH.
    pause
    exit /b 1
)

echo Installing dependencies...
pip install -r requirements.txt

echo.
echo Building executable with PyInstaller...
pyinstaller --onefile --windowed --name "BOM Dataset Indexer" --clean app.py

if errorlevel 1 (
    echo.
    echo Build failed. Check the error messages above.
) else (
    echo.
    echo Build successful! Executable is in the "dist" folder.
    echo You can run: dist\BOM Dataset Indexer.exe
)

pause