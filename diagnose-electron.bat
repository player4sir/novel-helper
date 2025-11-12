@echo off
echo ========================================
echo Electron App Diagnostics
echo ========================================
echo.

echo Checking build files...
echo.

if exist "dist" (
    echo ✓ dist folder exists
    if exist "dist\index.js" (
        echo   ✓ dist\index.js exists
    ) else (
        echo   ✗ dist\index.js MISSING
    )
    if exist "dist\public" (
        echo   ✓ dist\public folder exists
        if exist "dist\public\index.html" (
            echo     ✓ dist\public\index.html exists
        ) else (
            echo     ✗ dist\public\index.html MISSING
        )
        if exist "dist\public\assets" (
            echo     ✓ dist\public\assets folder exists
        ) else (
            echo     ✗ dist\public\assets MISSING
        )
    ) else (
        echo   ✗ dist\public folder MISSING
    )
) else (
    echo ✗ dist folder MISSING - Run: npm run build
)

echo.
echo Checking Electron files...
if exist "electron\main.js" (
    echo ✓ electron\main.js exists
) else (
    echo ✗ electron\main.js MISSING
)

echo.
echo Checking package files...
if exist "package.json" (
    echo ✓ package.json exists
) else (
    echo ✗ package.json MISSING
)

if exist "electron-builder.json" (
    echo ✓ electron-builder.json exists
) else (
    echo ✗ electron-builder.json MISSING
)

echo.
echo Checking release folder...
if exist "release" (
    echo ✓ release folder exists
    dir /b release\*.exe 2>nul
    if errorlevel 1 (
        echo   No .exe files found
    )
) else (
    echo ✗ release folder does not exist
)

echo.
echo ========================================
echo.
pause
