import { app, 
        BrowserWindow, 
        ipcMain } from 'electron';

import { createRecording,
        processLinks, 
        killAProcess, 
        killAllProcesses,
        addNewModelfromUrl,
        updateLinksStatus
      }
       from './script.mjs';

import { getAllLinks,
        initializeDatabase,
        setAllOffline, 
        removeLinkFromName,
        getInfosFromTableWithUrlConstraint,
        updateColumn,
      } 
       from './serveur.mjs';
import cron from 'node-cron';
import path from 'node:path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { RecordingStatus } from '../common/common.mjs';

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
        sandbox: false,
        preload: path.join(fileURLToPath(new URL('preload.mjs', import.meta.url)))
      }
    })
  
    window.loadFile('./html/index.html')
}

function initApplication()
{
  createWindow()
  // À l'initialisation, parcourt la base de données pour lancer les enregistrements par défaut
  //updateLinksStatus();
  processLinks();

  // Crée une tâche de fond pour vérifier et lancer les enregistrements par défaut de manière régulière (ici toutes les minutes)
  cron.schedule('*/1 * * * *', () => {
    const statusUpdated = updateLinksStatus();
    statusUpdated.forEach((keys, values) => updateModelStatus(keys, values));
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
      return updateColumn(name, 'Record', status);
    });
    ipcMain.handle('removeARowFromName', (event, name) => {
      return removeLinkFromName(name);
    });
    ipcMain.handle('addNewModel', async (event, modelUrl) => {
      addNewModelfromUrl(modelUrl);
      const model = await getModel(modelUrl);
      return model;
    });

    initApplication();

    ipcMain.on('Ready', async () => {
      const statusUpdated = await updateLinksStatus();
      statusUpdated.forEach((values, keys) => updateModelStatus(keys, values));
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) initApplication()
    })
})

export function updateCurrentRecordingModel(recordingModel, action)
{
  window.webContents.send('updateCurrentRecordingModel', recordingModel, action);
}

export function updateModelStatus(modelName, recordingStatus)
{
  window.webContents.send('updateModelStatus', modelName, recordingStatus);
}

export async function getModel(modelUrl)
{
  return getInfosFromTableWithUrlConstraint('links', ['*'], modelUrl);
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})
