@echo off
setlocal
echo ==============================================
echo   Push Interactive Grunge Reveal Hero to GitHub
echo ==============================================
echo Target: https://github.com/mollasurjo-creator/grunge-reveal-hero.git
echo.

git branch -M main
git remote set-url origin https://github.com/mollasurjo-creator/grunge-reveal-hero.git 2>nul || git remote add origin https://github.com/mollasurjo-creator/grunge-reveal-hero.git

echo Pushing to GitHub main branch...
git push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ==============================================
    echo   SUCCESS! Uploaded to GitHub!
    echo ==============================================
    echo Your repository: https://github.com/mollasurjo-creator/grunge-reveal-hero
    echo.
    echo To enable GitHub Pages:
    echo 1. Go to https://github.com/mollasurjo-creator/grunge-reveal-hero/settings/pages
    echo 2. Under 'Branch', select 'main' and save.
    echo 3. Your site will be live at:
    echo    https://mollasurjo-creator.github.io/grunge-reveal-hero/
) else (
    echo.
    echo If push failed, make sure you created the empty repository on GitHub first:
    echo https://github.com/new
)

pause
