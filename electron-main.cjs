const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Vocalis - Choir Voice Mixer",
    backgroundColor: "#05070a",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    icon: path.join(__dirname, "public", "favicon.ico"), // standard icon format
  });

  // Build a minimal menu
  Menu.setApplicationMenu(null);

  // Load the built SPA
  const indexPath = path.join(__dirname, "dist", "index.html");
  win.loadFile(indexPath).catch((err) => {
    console.error("Failed to load index.html:", err);
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
