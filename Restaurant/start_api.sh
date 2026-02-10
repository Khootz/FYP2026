#!/bin/bash
# Start FastAPI Backend
# This starts the OpenRice scraper API on port 8000

echo "🚀 Starting FastAPI Backend..."
echo ""

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python not found! Please install Python first."
    echo "   Visit: https://www.python.org/downloads/"
    exit 1
fi

PYTHON_VERSION=$(python3 --version)
echo "✅ Python found: $PYTHON_VERSION"

# Check if requirements are installed
echo "📦 Checking dependencies..."
if ! python3 -c "import fastapi" &> /dev/null; then
    echo "❌ Dependencies not installed. Installing now..."
    pip3 install -r requirements.txt
    echo "✅ Dependencies installed!"
else
    echo "✅ Dependencies already installed"
fi

# Check if Playwright browsers are installed
echo "🌐 Checking Playwright browsers..."
if ! python3 -c "from playwright.sync_api import sync_playwright; sync_playwright().start()" &> /dev/null; then
    echo "❌ Playwright browsers not installed. Installing now..."
    playwright install chromium
    echo "✅ Playwright browsers installed!"
else
    echo "✅ Playwright browsers installed"
fi

echo ""
echo "======================================================================"
echo "🍽️  OpenRice FastAPI Backend"
echo "======================================================================"
echo "📡 API will be available at: http://localhost:8000"
echo "📚 API documentation at: http://localhost:8000/docs"
echo "🔍 Health check: http://localhost:8000/health"
echo ""
echo "💾 Cache: 7 days, file-based (cache/openrice/)"
echo "⚡ Performance: ~15-20s first search, ~0.08s cached"
echo ""
echo "Press Ctrl+C to stop the server"
echo "======================================================================"
echo ""

# Start the server
python3 -m uvicorn api:app --host 0.0.0.0 --port 8000 --reload
