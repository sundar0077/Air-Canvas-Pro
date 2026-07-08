@echo off
echo ===============================================
echo     AirCanvas Pro - Starting Backend Server
echo ===============================================

:: Activate virtual environment if exists, or create one
if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
)

call venv\Scripts\activate.bat

:: Install dependencies
echo Installing dependencies...
python -m pip install flask flask-cors pillow

:: Start the server
echo.
echo Server starting on http://localhost:5000
echo Press Ctrl+C to stop
echo.

python app.py

pause