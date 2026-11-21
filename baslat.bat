@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ==================================================
echo   DeutschKarte yerel sunucusu baslatiliyor...
echo   Tarayici adresi: http://localhost:8000
echo   Kapatmak icin bu pencerede Ctrl+C tuslayin.
echo ==================================================
echo.

python -c "import http.server" >nul 2>nul
if %errorlevel%==0 (
  start "" /min cmd /c "timeout /t 1 /nobreak >nul & start http://localhost:8000"
  python -m http.server 8000
  goto :end
)

py -c "import http.server" >nul 2>nul
if %errorlevel%==0 (
  start "" /min cmd /c "timeout /t 1 /nobreak >nul & start http://localhost:8000"
  py -m http.server 8000
  goto :end
)

echo Hata: Sistemde calisan bir Python 3 kurulumu bulunamadi.
echo Lutfen Python 3 yukleyin ve tekrar deneyin.
pause

:end
