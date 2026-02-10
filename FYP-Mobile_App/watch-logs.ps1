# Monitor Android App Logs in Real-Time
# This filters for important Capacitor and app-specific logs

Write-Host "📱 Monitoring Android App Logs..." -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""
Write-Host "Watching for:" -ForegroundColor Yellow
Write-Host "  - Capacitor logs (plugin activity)" -ForegroundColor Gray
Write-Host "  - Console messages (your console.logs)" -ForegroundColor Gray
Write-Host "  - Network errors" -ForegroundColor Gray
Write-Host "  - OpenRice/Restaurant searches" -ForegroundColor Gray
Write-Host ""
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""

# Check if device is connected
$devices = adb devices
if ($devices -notmatch "device$") {
    Write-Host "❌ No Android device detected!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Solutions:" -ForegroundColor Yellow
    Write-Host "  1. Connect device via USB" -ForegroundColor Gray
    Write-Host "  2. Enable USB debugging on device" -ForegroundColor Gray
    Write-Host "  3. Run: adb devices" -ForegroundColor Gray
    exit 1
}

Write-Host "✅ Device connected" -ForegroundColor Green
Write-Host ""

# Clear old logs
adb logcat -c

# Start monitoring with filters
# This captures: Capacitor, Console, chromium (WebView), and our search keywords
adb logcat | Select-String -Pattern "Capacitor|Console|chromium|openrice|restaurant|ERROR|WARN|fetch|network" -CaseSensitive:$false
