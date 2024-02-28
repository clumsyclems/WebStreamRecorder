process.setMaxListeners(15);

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { createRecording, processLinks } = require('./script.cjs');
const { initializeDatabase, insertOrUpdateInLinksTable, setAllOffline } = require('./serveur.cjs');
const cron = require('node-cron');

let mainWindow = null;

// Initialise la base de données
initializeDatabase(app);

// Set Offline all the database table link
setAllOffline();

// À l'initialisation, parcourt la base de données pour lancer les enregistrements par défaut
processLinks();

// Crée une tâche de fond pour vérifier et lancer les enregistrements par défaut de manière régulière (ici toutes les minutes)
cron.schedule('*/10 * * * *', processLinks);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      cache: false, // Désactiver le cache (à ajuster selon vos besoins)
    },
  });

  mainWindow.loadFile('index.html');
  mainWindow.webContents.on('did-finish-load', () => mainWindow.webContents.send('html-ready'));
  mainWindow.on('closed', () => closeWindow());
}

function closeWindow() {
  setAllOffline();
  mainWindow = null;
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  setAllOffline();
  if (process.platform !== 'darwin') app.quit();
});

process.on('SIGINT', () => {
  setAllOffline();
  app.quit();
});

app.on('activate', () => mainWindow || createWindow());

ipcMain.on('startRecording', async (event, url) => {
  try {
    console.log('Demande de démarrage d\'enregistrement pour URL :', url);

    const matchResult = url.match(/\.com\/(.*?)\/?$/);
    const website = url.match(/:\/\/(?:www\.)?(?:[a-zA-Z]+\.)?([a-zA-Z]+)\.com\//);

    if (matchResult && matchResult.length >= 2) {
      const sousChaineExtraite = matchResult[1];
      insertOrUpdateInLinksTable(sousChaineExtraite, url, website[1]);
      createRecording(url, sousChaineExtraite);
    } else {
      console.log("Aucune correspondance trouvée.");
    }

  } catch (error) {
    console.error('Erreur lors de la demande d\'enregistrement :', error);
  }
});

ipcMain.on('html-ready', () => console.log('La fenêtre HTML est prête.'));
