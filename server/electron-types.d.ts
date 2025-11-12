// Type declarations for Electron-specific Node.js process properties
declare namespace NodeJS {
  interface Process {
    resourcesPath?: string;
  }
}

export {};
