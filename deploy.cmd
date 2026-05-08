@echo off
REM ============================================================
REM  Anchor Enterprise - Cloudflare Pages deploy
REM  Reads the API token from "..\API Keys\Cloudflare.txt"
REM  Run by double-clicking, or from a terminal in this folder.
REM ============================================================

setlocal enabledelayedexpansion

echo.
echo Deploying anchor-enterprise to Cloudflare Pages...
echo.

REM Move into the script's own directory so the deploy uploads
REM the contents of the website root, not whatever the user's cwd is.
cd /d "%~dp0"

REM Locate the API key (one folder up, in "API Keys\Cloudflare.txt")
set "KEYFILE=%~dp0..\API Keys\Cloudflare.txt"

if not exist "%KEYFILE%" (
    echo [ERROR] Could not find API key at:
    echo   %KEYFILE%
    echo.
    pause
    exit /b 1
)

REM Read the token (first non-empty line, trimmed)
for /f "usebackq delims=" %%T in ("%KEYFILE%") do (
    if not defined CLOUDFLARE_API_TOKEN set "CLOUDFLARE_API_TOKEN=%%T"
)

set "CLOUDFLARE_ACCOUNT_ID=82461f39a4e7617c8b1f6f9d488ccd68"

REM Run wrangler. Using npx so a global install is not required.
call npx --yes wrangler@latest pages deploy . --project-name anchor-enterprise --commit-dirty=true

echo.
echo ============================================================
echo Done. Live at https://anchor-enterprise.com
echo ============================================================
echo.
pause
