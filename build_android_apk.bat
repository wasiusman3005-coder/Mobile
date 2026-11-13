@echo off
title Q-NEXUS Jarvis - PC to Android APK Builder
color 0b
echo ============================================================================
echo          Q-NEXUS MOBILE JARVIS OS - ANDROID .APK BUILD HELPER
echo ============================================================================
echo.

echo [1/5] Installing project packages...
call npm install
if errorlevel 1 goto :err

echo.
echo [2/5] Building production mobile bundle (dist/)...
call npm run build
if errorlevel 1 goto :err

echo.
echo [3/5] Installing Capacitor Android tools...
call npm install @capacitor/core @capacitor/cli @capacitor/android
if errorlevel 1 goto :err

if not exist "android" (
  echo.
  echo [4/5] Creating Android native project folder...
  call npx cap add android
  if errorlevel 1 goto :err
)

echo.
echo [5/5] Injecting Fingerprint, Notification, SMS, Call & Background Wake plugins...
call node scripts/configure_android_native.mjs
if errorlevel 1 goto :err

echo.
echo Syncing web build into Android project...
call npx cap sync android
if errorlevel 1 goto :err

echo.
echo ============================================================================
echo  SUCCESS! Full Native Android Project Ready (Biometric + Notifications + Wake Service)!
echo  Ab neeche do mein se koi ek step karein:
echo   A) Direct APK banaye:
echo      cd android ^&^& gradlew.bat assembleDebug
echo      APK location: android\app\build\outputs\apk\debug\app-debug.apk
echo.
echo   B) Ya Android Studio khol kar GUI se APK banaye:
echo      npx cap open android
echo      Android Studio mein: Build ^> Build Bundle(s) / APK(s) ^> Build APK(s)
echo ============================================================================
pause
exit /b 0

:err
echo.
echo [ERROR] Build failed! Ensure Node.js 18+ is installed on your PC.
pause
exit /b 1
