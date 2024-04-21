const { app, 
        BrowserWindow, 
        ipcMain } = require('electron');

const { createRecording,
        processLinks, 
        killAProcess, 
        killAllProcesses 
      }
       = require('./script.cjs');

const { getAllLinks,
        initializeDatabase, 
        insertOrUpdateInLinksTable,
        setAllOffline, 
        removeLinkFromName,
        updateRecord,
      } 
      = require('./serveur.cjs');
const cron = require('node-cron');
const path = require('node:path')

const createWindow = () => {
    const win = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
      }
    })
  
    win.loadFile('./html/index.html')
}

app.whenReady().then(() => {
    ipcMain.handle('ping', () => 'pong')
    ipcMain.handle('fillRecordingArray', () => {
      const links = getAllLinks();
      return links;
    })
    ipcMain.handle('changeRecordingStatus', (event, args) => {
      const {name, status} = args;
      return updateRecord(name, status);
    });
    ipcMain.handle('removeARowFromName', (event, name) => {
      return removeLinkFromName(name);
    });
    createWindow()
  
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})

