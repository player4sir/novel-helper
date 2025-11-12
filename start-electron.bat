@echo off
echo ====================================
echo 小说创作助手 - 启动中...
echo ====================================
echo.

REM 检查 node_modules 是否存在
if not exist "node_modules\" (
    echo [错误] 未找到依赖，正在安装...
    call npm install
    if errorlevel 1 (
        echo [错误] 依赖安装失败
        pause
        exit /b 1
    )
)

echo [1/2] 启动后端服务器...
echo [2/2] 启动 Electron 窗口...
echo.

npm run electron:dev

pause
