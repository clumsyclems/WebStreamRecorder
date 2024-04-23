const { app, 
        BrowserWindow, 
        ipcMain } = require('electron');

const { createRecording,
        processLinks, 
        killAProcess, 
        killAllProcesses,
        addNewModelfromUrl,
        updateLinksStatus
      }
       = require('./script.cjs');

const { getAllLinks,
        initializeDatabase,
        setAllOffline, 
        removeLinkFromName,
        updateRecord,
        getInfosFromTableWithUrlConstraint,
      } 
      = require('./serveur.cjs');
const cron = require('node-cron');
const path = require('node:path');

// Initialise la base de données
initializeDatabase(app);

// Set Offline all the database table link
setAllOffline();

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

function initApplication()
{
  createWindow()
  // À l'initialisation, parcourt la base de données pour lancer les enregistrements par défaut
  updateLinksStatus();
  processLinks();

  // Crée une tâche de fond pour vérifier et lancer les enregistrements par défaut de manière régulière (ici toutes les minutes)
  cron.schedule('*/1 * * * *', () => {
    updateLinksStatus();
    processLinks();
  });
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
    ipcMain.handle('addNewModel', async (event, modelUrl) => {
      addNewModelfromUrl(modelUrl);
      const model = await getModel(modelUrl);
      //console.log(model);
      return model;
    });

    initApplication();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) initApplication()
    })
})

function updateCurrentRecordingModel(recordingModel, action)
{
  window.webContents.send('updateCurrentRecordingModel', recordingModel, action);
}

function updateModelStatus()
{
  window.webContents.send('updateCurrentRecordingModel', modelName, recordingStatus);
}

async function getModel(modelUrl)
{
  return getInfosFromTableWithUrlConstraint('links', ['*'], modelUrl);
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})

module.exports = {
  updateCurrentRecordingModel,
  updateModelStatus,
}