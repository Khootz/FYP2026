# Start FastAPI Backend
# This starts the OpenRice scraper API on port 8000

Write-Host "🚀 Starting FastAPI Backend..." -ForegroundColor Green
Write-Host ""

# Check if Python is available
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✅ Python found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Python not found! Please install Python first." -ForegroundColor Red
    Write-Host "   Download from: https://www.python.org/downloads/" -ForegroundColor Yellow
    exit 1
}

# Check if requirements are installed
Write-Host "📦 Checking dependencies..." -ForegroundColor Cyan
$pipList = pip list 2>&1 | Out-String

if ($pipList -notmatch "fastapi") {
    Write-Host "❌ Dependencies not installed. Installing now..." -ForegroundColor Yellow
    pip install -r requirements.txt
    Write-Host "✅ Dependencies installed!" -ForegroundColor Green
} else {
    Write-Host "✅ Dependencies already installed" -ForegroundColor Green
}

# Check if Playwright browsers are installed
Write-Host "🌐 Checking Playwright browsers..." -ForegroundColor Cyan
$playwrightInstalled = python -c 'import playwright' 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Playwright browsers installed" -ForegroundColor Green
} else {
    Write-Host "❌ Playwright browsers not installed. Installing now..." -ForegroundColor Yellow
    playwright install chromium
    Write-Host "✅ Playwright browsers installed!" -ForegroundColor Green
}

Write-Host ""
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "🍽️  OpenRice FastAPI Backend" -ForegroundColor Green
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "📡 API will be available at: http://localhost:8000" -ForegroundColor White
Write-Host "📚 API documentation at: http://localhost:8000/docs" -ForegroundColor White
Write-Host "🔍 Health check: http://localhost:8000/health" -ForegroundColor White
Write-Host ""
Write-Host "💾 Cache: 7 days, file-based (cache/openrice/)" -ForegroundColor White
Write-Host "⚡ Performance: ~25s first search, ~0.03s cached (OPTIMIZED!)" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""

# Start the server
python -m uvicorn api:app --host 0.0.0.0 --port 8000 --reload
