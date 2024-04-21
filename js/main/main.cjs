const { app, 
        BrowserWindow, 
        ipcMain } = require('electron');

const { createRecording,
        processLinks, 
        killAProcess, 
        killAllProcesses,
        addNewModelfromUrl
      }
       = require('./script.cjs');

const { getAllLinks,
        initializeDatabase,
        setAllOffline, 
        removeLinkFromName,
        updateRecord,
      } 
      = require('./serveur.cjs');
const cron = require('node-cron');
const path = require('node:path');

// Initialise la base de données
initializeDatabase(app);

// Set Offline all the database table link
setAllOffline();

// À l'initialisation, parcourt la base de données pour lancer les enregistrements par défaut
processLinks();

// Crée une tâche de fond pour vérifier et lancer les enregistrements par défaut de manière régulière (ici toutes les minutes)
cron.schedule('*/10 * * * *', () => {
  processLinks();
});

let window = null;

const createWindow = () => {
    window = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
      }
    })
  
    window.loadFile('./html/index.html')
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
    ipcMain.handle('addNewModel', (event, modelUrl) => {
      return addNewModelfromUrl(modelUrl);
    });

    createWindow()
  
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

function updateCurrentRecordingModel(recordingModel, action)
{
  window.webContents.send('updateCurrentRecordingModel', recordingModel, action);
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})

