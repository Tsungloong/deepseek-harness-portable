@echo off
setlocal

set "ROOT=%~dp0.."
set "DSH_PORTABLE_RESET_ROOT=%ROOT%"
powershell.exe -NoProfile -Command "$p=Join-Path $env:DSH_PORTABLE_RESET_ROOT 'state\running.json'; if (Test-Path $p) { $id=(Get-Content -Raw $p | ConvertFrom-Json).pid; if (Get-Process -Id $id -ErrorAction SilentlyContinue) { exit 1 } }; if (Test-Path (Join-Path $env:DSH_PORTABLE_RESET_ROOT 'state\.setup-lock')) { exit 1 }"
if errorlevel 1 (
  echo [portable] Stop the workbench or setup process before resetting.
  exit /b 1
)

echo [portable] DeepSeek Harness Portable reset
echo [portable] Location: %ROOT%
echo.
echo [portable] Will delete:
for %%d in (data runtimes packages logs state temp) do (
  if exist "%ROOT%\%%d" echo   %%d\
)
echo.
echo [portable] Will keep:
echo   models\
for %%f in (windows.bat linux.sh mac.sh README.txt README.md README.en.md LICENSE NOTICE.md .gitignore) do (
  if exist "%ROOT%\%%f" echo   %%f
)
echo   scripts\
echo.

set "confirm="
set /p "confirm=[portable] Confirm delete? This cannot be undone [y/N] "
if /i not "%confirm%"=="y" (
  echo [portable] Cancelled
  exit /b 0
)

for %%d in (data runtimes packages logs state temp) do (
  if exist "%ROOT%\%%d" (
    rmdir /s /q "%ROOT%\%%d"
    echo [portable] Deleted: %%d\
  )
)

echo.
echo [portable] Reset complete
echo [portable] Run setup to reinstall: windows.bat setup

exit /b 0
