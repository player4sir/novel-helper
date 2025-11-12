@echo off
echo ====================================
echo 测试构建输出
echo ====================================
echo.

if not exist "dist\index.js" (
    echo [错误] dist\index.js 不存在，请先运行构建
    echo 运行: npm run build:electron
    pause
    exit /b 1
)

echo [1/3] 检查构建文件...
echo ✓ dist\index.js 存在
if exist "dist\public\index.html" (
    echo ✓ dist\public\index.html 存在
) else (
    echo [错误] dist\public\index.html 不存在
    pause
    exit /b 1
)

echo.
echo [2/3] 测试服务器启动...
echo 注意：这将启动服务器，按 Ctrl+C 停止
echo.
timeout /t 3

set NODE_ENV=production
set PORT=5000

node dist\index.js

pause
