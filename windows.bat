@echo off
setlocal
if /i "%~1"=="reset" (
  call "%~dp0scripts\reset.bat"
  exit /b
)
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\portable.ps1" %*
exit /b %ERRORLEVEL%
