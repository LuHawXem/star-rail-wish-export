import { app, BrowserWindow, shell, ipcMain } from "electron";
import { release } from "node:os";
import { join } from "node:path";
import { initWindow } from "../electron/utils";
import "../electron/handler";

const isDev = !app.isPackaged;

if (release().startsWith("6.1")) {
  app.disableHardwareAcceleration();
}

if (process.platform === "win32") {
  app.setAppUserModelId(app.getName());
}

const url = process.env.VITE_DEV_SERVER_URL;
const indexHtml = "dist/index.html";

let win = null;

async function createWindow() {
  win = initWindow();
  win.setMenuBarVisibility(false);
  if (isDev) {
    win.setIcon(join(__dirname, "../../build/icon.ico"));
    win.loadURL(url);
    win.webContents.openDevTools({ mode: "undocked", activate: true });
  } else {
    win.loadFile(indexHtml);
  }

  // win.webContents.setWindowOpenHandler(({ url }) => {
  //   if (url.startsWith("https:")) {
  //     shell.openExternal(url);
  //   }
  //   return {
  //     action: "deny",
  //   };
  // });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

app.on("second-instance", () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  win = null;
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle("RELAUNCH", async () => {
  app.relaunch();
  app.exit(0);
});

// app.on("will-quit", (e) => {
//   if (proxyStatus.started) {
//     disableProxy();
//   }
//   if (getUpdateInfo().status === 'moving') {
//     e.preventDefault()
//     setTimeout(() => {
//       app.quit()
//     }, 3000)
//   }
// });

// app.on("quit", () => {
//   if (proxyStatus.started) {
//     disableProxy();
//   }
// });
