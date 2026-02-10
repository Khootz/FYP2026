# Quick Run with Live Reload
# This lets you develop with instant updates on your Android device

$ErrorActionPreference = "Stop"

Write-Host "🔥 Starting Live Reload Development..." -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (!(Test-Path "package.json")) {
    Write-Host "❌ Error: Not in FYP-Mobile_App directory!" -ForegroundColor Red
    Write-Host "   Please run this from: FYP-Mobile_App/" -ForegroundColor Yellow
    exit 1
}

# Get network IP
Write-Host "🌐 Detecting network IP..." -ForegroundColor Yellow
$networkIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -like "192.168.*"} | Select-Object -First 1).IPAddress

if ($networkIP) {
    Write-Host "✅ Network IP: $networkIP" -ForegroundColor Green
} else {
    Write-Host "⚠️  Could not detect network IP automatically" -ForegroundColor Yellow
    $networkIP = "192.168.68.112"
    Write-Host "   Using default: $networkIP" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=" * 70 -ForegroundColor Yellow
Write-Host "📱 LIVE RELOAD MODE" -ForegroundColor Yellow
Write-Host "=" * 70 -ForegroundColor Yellow
Write-Host ""
Write-Host "Your app will connect to: http://${networkIP}:5173" -ForegroundColor White
Write-Host ""
Write-Host "✨ Benefits:" -ForegroundColor Cyan
Write-Host "  - Instant code updates (no rebuild needed!)" -ForegroundColor Gray
Write-Host "  - Hot module replacement" -ForegroundColor Gray
Write-Host "  - Chrome DevTools debugging" -ForegroundColor Gray
Write-Host ""
Write-Host "⚠️  Requirements:" -ForegroundColor Yellow
Write-Host "  - Backend services running (start with: ..\start_all.ps1)" -ForegroundColor Gray
Write-Host "  - Phone on same WiFi as PC" -ForegroundColor Gray
Write-Host "  - Firewall allows port 5173" -ForegroundColor Gray
Write-Host ""
Write-Host "=" * 70 -ForegroundColor Yellow
Write-Host ""

Write-Host "🚀 Starting dev server and running on Android..." -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

# Start dev server and run with live reload
# Note: This will start dev server in background, then run on Android
npx cap run android -l --external

Write-Host ""
Write-Host "✅ Live reload session ended." -ForegroundColor Green
