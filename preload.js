const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopConsole", {
  openProgram: (command) => ipcRenderer.invoke("open-program", command)
});
