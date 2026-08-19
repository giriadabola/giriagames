@echo off
title Servidor de Imagens - GiriaGames
echo ===================================================
echo   GiriaGames - Servidor de Download de Faces
echo ===================================================
echo.
cd /d "%~dp0"
node face-download-server.cjs
pause
