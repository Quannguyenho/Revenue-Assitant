@echo off
cd /d "%~dp0"
if "%API_TOKEN%"=="" set API_TOKEN=test-token
if "%PORT%"=="" set PORT=8790
if "%ALLOWED_ORIGINS%"=="" set ALLOWED_ORIGINS=http://127.0.0.1:8790,chrome-extension://*
echo Starting RevenueFlow Cloud Sync...
echo Keep this window open while using RevenueFlow Assistant Cloud Sync.
echo Health:  http://127.0.0.1:%PORT%/health
echo Sources: http://127.0.0.1:%PORT%/v1/sources
echo.
node src\server.js
echo.
echo Cloud Sync stopped. Check the message above if there was an error.
pause
