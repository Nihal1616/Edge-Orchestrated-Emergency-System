@echo off
REM ML Model Training and Server Startup Script for Windows

echo ========================================
echo 🚑 Emergency Response ML System Startup
echo ========================================

echo.
echo [1/4] Checking Python installation...
python --version
if errorlevel 1 (
    echo ERROR: Python not found. Please install Python 3.8+
    exit /b 1
)

echo ✓ Python found

echo.
echo [2/4] Installing dependencies...
pip install -r requirements.txt --quiet
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    exit /b 1
)
echo ✓ Dependencies installed

echo.
echo [3/4] Training ML model...
python train_model.py
if errorlevel 1 (
    echo ERROR: Model training failed
    exit /b 1
)
echo ✓ Model trained and saved

echo.
echo [4/4] Starting FastAPI server...
echo.
echo ========================================
echo 📡 FastAPI Server Starting...
echo ========================================
echo.
echo 🌐 API Documentation: http://localhost:8000/docs
echo 🌐 ReDoc: http://localhost:8000/redoc
echo.

uvicorn app:app --reload --port 8000

pause
