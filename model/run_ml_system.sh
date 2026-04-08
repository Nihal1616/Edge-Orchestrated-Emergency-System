#!/bin/bash
# ML Model Training and Server Startup Script for macOS/Linux

echo "========================================"
echo "🚑 Emergency Response ML System Startup"
echo "========================================"

echo ""
echo "[1/4] Checking Python installation..."
python3 --version
if [ $? -ne 0 ]; then
    echo "ERROR: Python 3 not found. Please install Python 3.8+"
    exit 1
fi

echo "✓ Python found"

echo ""
echo "[2/4] Installing dependencies..."
pip3 install -r requirements.txt --quiet
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to install dependencies"
    exit 1
fi
echo "✓ Dependencies installed"

echo ""
echo "[3/4] Training ML model..."
python3 train_model.py
if [ $? -ne 0 ]; then
    echo "ERROR: Model training failed"
    exit 1
fi
echo "✓ Model trained and saved"

echo ""
echo "[4/4] Starting FastAPI server..."
echo ""
echo "========================================"
echo "📡 FastAPI Server Starting..."
echo "========================================"
echo ""
echo "🌐 API Documentation: http://localhost:8000/docs"
echo "🌐 ReDoc: http://localhost:8000/redoc"
echo ""

uvicorn app:app --reload --port 8000
