# Start All Services (FastAPI + Node.js + Frontend)
# This script starts everything in separate windows for development

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting FYP Mobile App - All Services" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""

# Get absolute paths
$RestaurantDir = "C:\Users\User\Desktop\FYP\Restaurant"
$BackendDir = "C:\Users\User\Desktop\FYP\FYP-Mobile_App\backend"
$FrontendDir = "C:\Users\User\Desktop\FYP\FYP-Mobile_App"

# Check directories exist
if (!(Test-Path $RestaurantDir)) {
    Write-Host "❌ Restaurant directory not found!" -ForegroundColor Red
    exit 1
}

if (!(Test-Path $BackendDir)) {
    Write-Host "❌ Backend directory not found!" -ForegroundColor Red
    exit 1
}

if (!(Test-Path $FrontendDir)) {
    Write-Host "❌ Frontend directory not found!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ All directories found" -ForegroundColor Green
Write-Host ""

# Function to start service in new window
function Start-Service {
    param(
        [string]$Title,
        [string]$Command,
        [string]$WorkingDir,
        [string]$Color
    )
    
    Write-Host "🔄 Starting $Title..." -ForegroundColor $Color
    
    $ps = Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "cd '$WorkingDir'; Write-Host '🚀 $Title' -ForegroundColor $Color; Write-Host ''; $Command"
    ) -PassThru -WindowStyle Normal
    
    Write-Host "   Process ID: $($ps.Id)" -ForegroundColor Gray
    Start-Sleep -Milliseconds 500
}

# Start FastAPI Backend
Write-Host ""
Write-Host "=" * 70 -ForegroundColor Yellow
Write-Host "① Starting FastAPI Backend (Python)" -ForegroundColor Yellow
Write-Host "=" * 70 -ForegroundColor Yellow
Start-Service -Title "FastAPI Backend :8000" `
              -Command "python -m uvicorn api:app --host 0.0.0.0 --port 8000 --reload" `
              -WorkingDir $RestaurantDir `
              -Color "Magenta"

Write-Host "⏳ Waiting for FastAPI to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Start Node.js Backend
Write-Host ""
Write-Host "=" * 70 -ForegroundColor Green
Write-Host "② Starting Node.js Backend" -ForegroundColor Green
Write-Host "=" * 70 -ForegroundColor Green
Start-Service -Title "Node.js Backend :4000" `
              -Command "npm run dev" `
              -WorkingDir $BackendDir `
              -Color "Green"

Write-Host "⏳ Waiting for Node.js to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Start Frontend
Write-Host ""
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "③ Starting Mobile App Frontend" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan
Start-Service -Title "Mobile App Frontend :5173" `
              -Command "npm run dev" `
              -WorkingDir $FrontendDir `
              -Color "Cyan"

Write-Host ""
Write-Host "=" * 70 -ForegroundColor Green
Write-Host "✅ All Services Started!" -ForegroundColor Green
Write-Host "=" * 70 -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Access your app:" -ForegroundColor White
Write-Host "   Frontend:  http://localhost:5173" -ForegroundColor Cyan
Write-Host "   Backend:   http://localhost:4000" -ForegroundColor Green
Write-Host "   FastAPI:   http://localhost:8000" -ForegroundColor Magenta
Write-Host "   API Docs:  http://localhost:8000/docs" -ForegroundColor Yellow
Write-Host ""
Write-Host "📱 Mobile (Android):" -ForegroundColor White
Write-Host "   Use: http://192.168.68.112:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "🧪 Test Integration:" -ForegroundColor White
Write-Host "   curl http://localhost:4000/api/openrice/search/KFC" -ForegroundColor Gray
Write-Host ""
Write-Host "🛑 To stop all services:" -ForegroundColor Red
Write-Host "   Close all PowerShell windows" -ForegroundColor Red
Write-Host ""
Write-Host "=" * 70 -ForegroundColor Green
Write-Host ""
Write-Host "Press any key to exit this window (services will keep running)..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
