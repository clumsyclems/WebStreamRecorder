import { app, 
        BrowserWindow, 
        ipcMain } from 'electron';

import { createRecording,
        processLinks, 
        killAProcess, 
        killAllProcesses,
        addNewModelfromUrl,
        updateLinksStatus,
        updateLinkStatus,
        startRecording
      }
       from './script.mjs';

import { getAllLinks,
        initializeDatabase,
        setAllOffline, 
        removeLinkFromName,
        getInfosFromTableWithUrlConstraint,
        getInfosFromTableWithNameConstraint,
        updateColumn,
      } 
       from './serveur.mjs';
import cron from 'node-cron';
import path, { resolve } from 'node:path';
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
  updateLinksStatus();
  processLinks();

  // Crée une tâche de fond pour vérifier et lancer les enregistrements par défaut de manière régulière (ici toutes les minutes)
  cron.schedule('*/10 * * * *', async () => {
    const statusUpdated = await updateLinksStatus();
    statusUpdated.forEach((value, keys) => {
      //console.log(`the name : ${keys} and the value : ${value}`)
      updateModelStatus(keys, value);
    });
    processLinks();
  });
}

app.whenReady().then(() => {
    ipcMain.handle('ping', () => 'pong')
    ipcMain.handle('fillRecordingArray', () => {
      const links = getAllLinks();
      return links;
    })
    ipcMain.handle('changeRecordingStatus', async (event, args) => {
      const {name, status} = args;
      if(status == true)
      {
        const recordingstatus = await startRecording(name);
        updateModelStatus(name, recordingstatus);
      }
      else
      {
        killAProcess(name);
      }
      return updateColumn(name, 'Record', status);
    });
    ipcMain.handle('removeARowFromName', (event, name) => {
      return removeLinkFromName(name);
    });
    ipcMain.handle('addNewModel', async (event, modelUrl) => {
      addNewModelfromUrl(modelUrl);
      const model = await getModelFromUrl(modelUrl);
      return model;
    });

    ipcMain.on('updateModelOnlineStatus', async (event, model) => {
      const modelRow = await getModelFromUrl(model.modelUrl);
      const [name, status] = await updateLinkStatus(modelRow[0]);
      if(name == null || status == null)
      {
        console.error(`Couldn\'t find one value between name : ${name} and status : ${status} \nFrom model : ${model} and modelRow : ${modelRow}`);
        return;
      }
      else
      {
        updateModelStatus(name, status);
      }
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

function updateCurrentRecordingModel(recordingModel, action)
{
  window.webContents.send('updateCurrentRecordingModel', recordingModel, action);
}

function updateModelStatus(modelName, recordingStatus)
{
  window.webContents.send('updateModelStatus', modelName, recordingStatus);
}

async function getModelFromUrl(modelUrl)
{
  return await getInfosFromTableWithUrlConstraint('links', ['*'], modelUrl);
}

async function getModelFromName(modelName)
{
  return await getInfosFromTableWithNameConstraint('links', ['*'], modelName);
}

app.on('window-all-closed', () => {
  killAllProcesses();
  if (process.platform !== 'darwin') app.quit()
})
