const { app, BrowserWindow, Menu, utilityProcess } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;

const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    },
    icon: path.join(__dirname, '../attached_assets/icon.png'),
    show: false,
    backgroundColor: '#1a1a1a'
  });

  // 窗口准备好后再显示，避免闪烁
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  const startUrl = isDev
    ? 'http://localhost:5000'
    : `http://localhost:5000`;

  console.log(`Loading URL: ${startUrl}`);

  mainWindow.loadURL(startUrl).catch(err => {
    console.error('Failed to load URL:', err);
    // 如果加载失败，显示错误页面
    mainWindow.loadURL(`data:text/html,<html><body style="background:#1a1a1a;color:#fff;font-family:sans-serif;padding:40px;"><h1>启动失败</h1><p>无法连接到服务器，请检查日志。</p><p>错误: ${err.message}</p></body></html>`);
  });

  // 监听加载失败事件
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error(`Failed to load: ${errorCode} - ${errorDescription}`);
    if (errorCode !== -3) { // -3 是用户取消，可以忽略
      setTimeout(() => {
        console.log('Retrying to load...');
        mainWindow.loadURL(startUrl);
      }, 2000);
    }
  });

  // 开发模式打开 DevTools
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startServer() {
  return new Promise((resolve, reject) => {
    // 生产环境：从 app.asar 或 app.asar.unpacked 中获取路径
    let serverPath, workingDir, envPath;

    if (isDev) {
      serverPath = path.join(__dirname, '../server/index.ts');
      workingDir = path.join(__dirname, '..');
      envPath = path.join(workingDir, '.env');
    } else {
      // 在打包后，资源在 resources/app.asar 中
      // 但 node_modules 可能在 app.asar.unpacked 中
      const appPath = app.getAppPath();
      serverPath = path.join(appPath, 'dist', 'index.js');
      workingDir = appPath;

      // .env 文件在 extraResources 中，位于 resources 目录
      const possibleEnvPaths = [
        path.join(process.resourcesPath, '.env'),
        path.join(process.resourcesPath, 'app.asar', '.env'),
        path.join(appPath, '.env'),
      ];

      envPath = possibleEnvPaths.find(p => require('fs').existsSync(p)) || possibleEnvPaths[0];
    }

    console.log(`Server path: ${serverPath}`);
    console.log(`Working directory: ${workingDir}`);
    console.log(`App path: ${app.getAppPath()}`);
    console.log(`Resources path: ${process.resourcesPath}`);
    console.log(`Env file path: ${envPath}`);
    console.log(`Env file exists: ${require('fs').existsSync(envPath)}`);

    // 读取 .env 文件并合并到环境变量
    let envVars = { ...process.env };
    if (require('fs').existsSync(envPath)) {
      const envContent = require('fs').readFileSync(envPath, 'utf-8');
      envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            envVars[key.trim()] = valueParts.join('=').trim();
          }
        }
      });
      console.log('Loaded environment variables from .env file');
    } else {
      console.warn('Warning: .env file not found, using system environment variables');
    }

    // 开发环境和生产环境使用不同的启动方式
    if (isDev) {
      // 开发环境：使用 npx tsx
      const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      const args = ['tsx', serverPath];

      console.log(`Starting server (dev): ${command} ${args.join(' ')}`);

      serverProcess = spawn(command, args, {
        cwd: workingDir,
        env: {
          ...envVars,
          PORT: '5000',
          NODE_ENV: 'development'
        },
        stdio: 'pipe',
        shell: false,
        windowsHide: true
      });
    } else {
      // 生产环境：直接在主进程中加载服务器
      console.log(`Starting server (prod): loading in main process`);

      // 设置环境变量
      Object.assign(process.env, envVars, {
        PORT: '5000',
        NODE_ENV: 'production',
        ALLOW_INSECURE_COOKIES: 'true'
      });

      // 直接 require 服务器代码
      try {
        require(serverPath);
        console.log('Server loaded successfully');
        setTimeout(() => {
          resolve();
        }, 3000);
        return;
      } catch (err) {
        console.error('Failed to load server:', err);
        reject(err);
        return;
      }
    }

    let serverReady = false;

    // 监听输出
    if (serverProcess.stdout) {
      serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('[Server stdout]:', output);

        // 检测服务器启动成功的标志
        if (output.includes('serving on port') && !serverReady) {
          serverReady = true;
          console.log('Server is ready!');
          resolve();
        }
      });
    }

    if (serverProcess.stderr) {
      serverProcess.stderr.on('data', (data) => {
        const error = data.toString();
        console.error('[Server stderr]:', error);

        // 如果是严重错误，拒绝 Promise
        if (error.includes('Error:') || error.includes('Cannot find module')) {
          reject(new Error(error));
        }
      });
    }

    // utilityProcess 使用不同的事件
    if (isDev) {
      serverProcess.on('error', (err) => {
        console.error('Failed to start server:', err);
        reject(err);
      });

      serverProcess.on('exit', (code) => {
        console.log(`Server process exited with code ${code}`);
      });
    } else {
      // utilityProcess 的事件处理
      serverProcess.on('spawn', () => {
        console.log('Server process spawned');
      });

      serverProcess.on('exit', (code) => {
        console.log(`Server process exited with code ${code}`);
      });
    }

    // 超时保护
    setTimeout(() => {
      if (!serverReady) {
        console.log('Server startup timeout, opening window anyway...');
        resolve();
      }
    }, 10000);
  });
}

// 创建应用菜单
function createMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        { role: 'quit', label: '退出' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '刷新' },
        { role: 'forceReload', label: '强制刷新' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '重置缩放' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox({
              type: 'info',
              title: '关于',
              message: '小说创作助手',
              detail: 'AI 驱动的小说创作工具\n版本: 1.0.0'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// 检查端口是否被占用
function checkPort(port) {
  return new Promise((resolve) => {
    const net = require('net');
    const server = net.createServer();

    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      }
    });

    server.once('listening', () => {
      server.close();
      resolve(true);
    });

    server.listen(port);
  });
}

app.whenReady().then(async () => {
  createMenu();

  // 检查端口
  const portAvailable = await checkPort(5000);
  if (!portAvailable) {
    const { dialog } = require('electron');
    const result = await dialog.showMessageBox({
      type: 'warning',
      title: '端口被占用',
      message: '端口 5000 已被占用',
      detail: '可能是之前的进程未关闭。是否继续启动？',
      buttons: ['继续', '退出'],
      defaultId: 0
    });

    if (result.response === 1) {
      app.quit();
      return;
    }
    // 端口被占用，直接打开窗口（假设服务已在运行）
    createWindow();
  } else {
    // 启动服务器并等待就绪
    try {
      await startServer();
      console.log('Server is ready, creating window...');
      createWindow();
    } catch (err) {
      console.error('Failed to start server:', err);
      const { dialog } = require('electron');
      dialog.showErrorBox('启动失败', '服务器启动失败，请查看日志');
      app.quit();
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  app.quit();
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});
