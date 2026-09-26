@echo off
setlocal
echo ==============================================
echo   Push Interactive Grunge Reveal Hero to GitHub
echo ==============================================
echo.

set /p REPO_URL="Enter your GitHub Repository URL (e.g., https://github.com/username/grunge-reveal-hero.git): "

if "%REPO_URL%"=="" (
    echo Error: No repository URL provided.
    pause
    exit /b 1
)

echo.
echo Setting up remote origin...
git remote remove origin 2>nul
git remote add origin %REPO_URL%
git branch -M main

echo.
echo Pushing to GitHub...
git push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ==============================================
    echo   SUCCESS! Project uploaded to GitHub.
    echo ==============================================
) else (
    echo.
    echo Failed to push. Please verify the URL and your GitHub permissions.
)

pause
