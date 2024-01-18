const { app, BrowserWindow, ipcMain, session } = require('electron');
const axios = require('axios');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');

let mainWindow;
let isRecordingStarted = false;

function createWindow() {
  mainWindow = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
          preload: path.join(__dirname, 'preload.js'),
      },
  });

  mainWindow.loadFile('index.html');

  mainWindow.webContents.on('did-finish-load', () => {
    const pageUrl = mainWindow.webContents.getURL();

    mainWindow.webContents.send('html-ready');

    // Désactiver le cache pour éviter le rafraîchissement constant
    mainWindow.webContents.session.clearCache(() => {
        mainWindow.webContents.session.webRequest.onBeforeRequest(filter, (details, callback) => {
            // Vérifier si l'URL correspond à vos critères et si l'enregistrement n'a pas encore commencé
            if (!isRecordingStarted && details.url.includes('.m3u8') && details.url.includes('chunklist')) {
                console.log('URL trouvée :', details.url);

                // Démarrer l'enregistrement pour cette URL
                createRecording(details.url);
                isRecordingStarted = true; // Marquer que l'enregistrement a commencé
            }

            // Continuer la requête normalement
            callback({});
        });

        // Charger la page
        mainWindow.webContents.loadURL(pageUrl);
    });
  });

  mainWindow.on('closed', function () {
      mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
    if (mainWindow === null) createWindow();
});

ipcMain.on('startRecording', async (event, url) => {
    try {
        console.log('Demande de démarrage d\'enregistrement pour URL :', url);
        await createRecording(url);
    } catch (error) {
        console.error('Erreur lors de la demande d\'enregistrement :', error);
    }
});

ipcMain.on('html-ready', () => {
    console.log('La fenêtre HTML est prête.');
});

// Fonction pour effectuer l'enregistrement
async function createRecording(url) {
  try {
    const response = await axios.get(url.replace(/\\u002D/g, '-'));

    // Appliquer le remplacement sur la chaîne de caractères
    const correctedResponse = response.data.replace(/\\u002D/g, '-');

    // Ajout de l'affichage des URL avant le filtrage

    console.log('URLs trouvées avant le filtrage :', correctedResponse.match(/https?:\/\/[^"]*\.m3u8/g));

    const m3u8Urls = correctedResponse.match(/https?:\/\/[^"]*\.m3u8/g);

    if (m3u8Urls && m3u8Urls.length > 0) {
        const firstM3u8Url = m3u8Urls[0];
        const outputPath = './output2.mp4';

        await new Promise((resolve, reject) => {
            ffmpeg(firstM3u8Url)
                .output(outputPath)
                .on('end', () => {
                    console.log('Enregistrement terminé avec succès.');
                    resolve();
                })
                .on('error', (err) => {
                    console.error('Erreur lors de l\'enregistrement :', err);
                    reject(err);
                })
                .run();
        });
    } else {
        console.error('Aucune URL .m3u8 trouvée sur la page.');
    }
} catch (error) {
    console.error('Erreur lors de la récupération de la page HTML :', error);
}
}
