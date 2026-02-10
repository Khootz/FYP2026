# Quick Build & Open Android Studio
# This script builds your React app and opens it in Android Studio

$ErrorActionPreference = "Stop"

Write-Host "📱 Building & Opening Android Studio..." -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (!(Test-Path "package.json")) {
    Write-Host "❌ Error: Not in FYP-Mobile_App directory!" -ForegroundColor Red
    Write-Host "   Please run this from: FYP-Mobile_App/" -ForegroundColor Yellow
    exit 1
}

# Check if node_modules exists
if (!(Test-Path "node_modules")) {
    Write-Host "⚠️  node_modules not found. Installing dependencies..." -ForegroundColor Yellow
    npm install
}

# Step 1: Build React app
Write-Host "🔨 Step 1: Building React app..." -ForegroundColor Green
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build successful!" -ForegroundColor Green
Write-Host ""

# Step 2: Sync with Capacitor
Write-Host "🔄 Step 2: Syncing with Capacitor..." -ForegroundColor Green
npx cap sync android

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Sync failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Sync successful!" -ForegroundColor Green
Write-Host ""

# Step 3: Open Android Studio
Write-Host "🚀 Step 3: Opening Android Studio..." -ForegroundColor Green
Write-Host ""
Write-Host "=" * 70 -ForegroundColor Yellow
Write-Host "📱 Android Studio will open shortly..." -ForegroundColor Yellow
Write-Host "=" * 70 -ForegroundColor Yellow
Write-Host ""
Write-Host "Next steps in Android Studio:" -ForegroundColor White
Write-Host "  1. Wait for Gradle sync to complete" -ForegroundColor Gray
Write-Host "  2. Select your device/emulator from dropdown" -ForegroundColor Gray
Write-Host "  3. Click the green Run button (▶️) or Shift+F10" -ForegroundColor Gray
Write-Host ""
Write-Host "💡 Tips:" -ForegroundColor Cyan
Write-Host "  - Make sure backend is running: .\start_all.ps1" -ForegroundColor Gray
Write-Host "  - Check BACKEND_URL uses network IP: http://192.168.68.112:4000" -ForegroundColor Gray
Write-Host "  - Phone must be on same WiFi as PC" -ForegroundColor Gray
Write-Host ""

npx cap open android

Write-Host ""
Write-Host "✅ Done! Android Studio should be open now." -ForegroundColor Green
Write-Host ""
