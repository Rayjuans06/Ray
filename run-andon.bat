@echo off
@echo off
title Andon Lauak Mexico
setlocal EnableDelayedExpansion

REM ------------------------
REM CONFIGURACIÓN DE ANIMACIÓN
REM ------------------------
set "PLANE=__|__   -o-(_)-o-   \_/"
set "MAX_STEPS=30"
set "DELAY=100"    REM milisegundos por frame

REM Bucle de animación: el avión "vuela" de izquierda a derecha
for /L %%i in (0,1,%MAX_STEPS%) do (
    cls
    set "spaces="
    for /L %%j in (1,1,%%i) do set "spaces=!spaces! "
    echo !spaces!!PLANE!
    ping -n 1 -w %DELAY% 127.0.0.1 >nul
)

cls
echo.
echo Animación completa. Levantando servicios...
echo.

REM ------------------------
REM ARRANQUE DEL BACKEND
REM ------------------------
start "Backend" cmd /k "cd /d "%~dp0backend" && node server.js"

REM Dale unos segundos al backend
timeout /t 3 >nul

REM ------------------------
REM ARRANQUE DEL FRONTEND
REM ------------------------
start "Frontend" cmd /k "cd /d "%~dp0" && npm start axion --host 10.31.40.12x   "

exit /b 0
