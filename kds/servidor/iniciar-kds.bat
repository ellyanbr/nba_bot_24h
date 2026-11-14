@echo off
title KDS - Cozinha (nao feche esta janela)
cd /d "%~dp0"
:loop
node server.js
echo.
echo O servidor parou. Reiniciando em 5 segundos... (feche a janela para encerrar)
timeout /t 5 >nul
goto loop
