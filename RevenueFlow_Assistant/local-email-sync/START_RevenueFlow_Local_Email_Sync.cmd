@echo off
cd /d "%~dp0"
echo Starting RevenueFlow Local Email Sync...
echo Keep this window open while using RevenueFlow Assistant.
echo Setup:        http://127.0.0.1:8787/setup
echo Health check: http://127.0.0.1:8787/health
echo Diagnostics:  http://127.0.0.1:8787/diagnostics
echo.
node src\server.js
echo.
echo Service stopped. Check the message above if there was an error.
pause
