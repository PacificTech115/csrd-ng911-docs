@echo off
echo ==========================================
echo CSRD NG911 Web App Deployment Sync
echo ==========================================
echo Mirroring GitHub Repository to IIS wwwroot...
echo.

:: WARNING: Update SOURCE to wherever you clone the repo on the GIS server via GitHub Desktop!
set SOURCE="C:\Staging\csrd-ng911-docs\Web App"

:: WARNING: Update DEST to the target IIS web directory
set DEST="C:\inetpub\wwwroot\ng911"

:: Run Robocopy Mirror
robocopy %SOURCE% %DEST% /MIR /MT:8 /NP /NDL /NFL

if %ERRORLEVEL% LEQ 7 (
    echo.
    echo Deployment Successful!
    echo Code from GitHub Desktop is now live on the CSRD IIS Server.
) else (
    echo.
    echo ERROR: Robocopy failed! 
    echo Did you right-click and "Run as Administrator"? Permissions might be blocked.
)
echo.
pause
