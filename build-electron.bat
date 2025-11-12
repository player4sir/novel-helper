@echo off
echo ====================================
echo 小说创作助手 - 打包中...
echo ====================================
echo.

echo [1/5] 清理旧构建...
if exist "dist" rmdir /s /q dist
if exist "release" rmdir /s /q release
echo ✓ 清理完成
echo.

echo [2/5] 检查环境...
if not exist ".env" (
    echo [警告] .env 文件不存在，应用可能无法正常运行
    echo 请确保 .env 文件包含必要的配置（DATABASE_URL 等）
    pause
)
if not exist "node_modules" (
    echo [错误] node_modules 不存在，请先运行 npm install
    pause
    exit /b 1
)
echo ✓ 环境检查通过
echo.

echo [3/5] 构建前端和后端 (Electron 专用)...
call npm run build:electron
if errorlevel 1 (
    echo [错误] 构建失败
    pause
    exit /b 1
)

echo.
echo [4/5] 验证构建输出...
if not exist "dist\index.js" (
    echo [错误] 服务器构建失败 - dist\index.js 未找到
    pause
    exit /b 1
)
if not exist "dist\public\index.html" (
    echo [错误] 客户端构建失败 - dist\public\index.html 未找到
    pause
    exit /b 1
)
if not exist "dist\package.json" (
    echo [错误] dist\package.json 未找到
    pause
    exit /b 1
)
echo ✓ 构建验证通过
echo.
echo 运行诊断...
call npm run diagnose
echo.

echo [5/5] 打包 Electron 应用...
call npm run electron:build:win
if errorlevel 1 (
    echo [错误] Electron 打包失败
    pause
    exit /b 1
)

echo.
echo ====================================
echo ✓ 打包完成！
echo ====================================
echo.
echo 安装包位置: release\
dir /b release\*.exe
echo.
echo 提示：首次运行时请确保：
echo 1. .env 文件已正确配置
echo 2. 数据库连接可用
echo 3. 端口 5000 未被占用
echo ====================================
pause
echo 安装包位置: release\小说创作助手-1.0.0-Setup.exe
echo.

pause
