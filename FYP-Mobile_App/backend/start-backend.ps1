# Start Node.js Backend
# This starts the Node.js backend server on port 4000

Write-Host "🚀 Starting Node.js Backend..." -ForegroundColor Green
Write-Host ""

# Check if Node.js is available
try {
    $nodeVersion = node --version 2>&1
    Write-Host "✅ Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found! Please install Node.js first." -ForegroundColor Red
    Write-Host "   Download from: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Check if node_modules exists
if (!(Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    npm install
    Write-Host "✅ Dependencies installed!" -ForegroundColor Green
} else {
    Write-Host "✅ Dependencies already installed" -ForegroundColor Green
}

Write-Host ""
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "🌐 Node.js Backend Server" -ForegroundColor Green
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "📡 API will be available at: http://localhost:4000" -ForegroundColor White
Write-Host "🔗 Connects to FastAPI at: http://localhost:8000" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  Make sure FastAPI is running first!" -ForegroundColor Yellow
Write-Host "   Run: cd ..\..\..\Restaurant; .\start_api.ps1" -ForegroundColor Gray
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""

# Start the server
npm run dev
