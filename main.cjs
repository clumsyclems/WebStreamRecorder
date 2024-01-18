const { app, BrowserWindow, ipcMain, session } = require('electron');
const axios = require('axios');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const moment = require('moment');
const sqlite3 = require('sqlite3');

// Chemin de la base de données SQLite dans le dossier de l'application
const dbPath = path.join(app.getAppPath(), 'myDatabase.db');

// Vérifier si la base de données existe déjà
const dbExists = fs.existsSync(dbPath);

// Créer une connexion à la base de données SQLite
const db = new sqlite3.Database(dbPath);

// Si la base de données n'existe pas, créer la table
if (!dbExists) {
  db.run(`
      CREATE TABLE IF NOT EXISTS links (
          Name TEXT PRIMARY KEY,
          Url TEXT NOT NULL,
          Online BOOLEAN DEFAULT TRUE,
          Record BOOLEAN DEFAULT FALSE,
          Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
  `);
}

let mainWindow;

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

        // Démarrer l'enregistrement pour cette URL avec un titre unique

        // Utilisez une expression régulière pour extraire la sous-chaîne
  
        const matchResult = url.match(/\.com\/(.*?)\//);

        // Vérifiez si la correspondance a été trouvée
        if (matchResult && matchResult.length >= 2) {
            const sousChaineExtraite = matchResult[1];
            console.log("Sous-chaîne extraite :", sousChaineExtraite);

            // Utilisez sousChaineExtraite comme nécessaire pour renommer le fichier de sortie
            const outputTitle = `./records/${sousChaineExtraite}_${moment().format("YYYY_MM_DD_HH_mm_ss")}.mp4`;
            createRecording(url, outputTitle);
        } else {
            console.log("Aucune correspondance trouvée.");
        }

    } catch (error) {
        console.error('Erreur lors de la demande d\'enregistrement :', error);
    }
});

ipcMain.on('html-ready', () => {
    console.log('La fenêtre HTML est prête.');
});

// Fonction pour effectuer l'enregistrement
async function createRecording(url, outputTitle) {
    try {
        console.log('Commencer l\'enregistrement pour URL :', url);

        const response = await axios.get(url.replace(/\\u002D/g, '-'));
        const correctedResponse = response.data.replace(/\\u002D/g, '-');

        // Ajout de l'affichage des URL avant le filtrage
        console.log('URLs trouvées avant le filtrage :', correctedResponse.match(/https?:\/\/[^"]*\.m3u8/g));

        const m3u8Urls = correctedResponse.match(/https?:\/\/[^"]*\.m3u8/g);

        if (m3u8Urls && m3u8Urls.length > 0) {
            const firstM3u8Url = m3u8Urls[0];
            const outputPath = `./${outputTitle}`;

            await new Promise((resolve, reject) => {
                ffmpeg(firstM3u8Url)
                    .output(outputPath)
                    .on('end', () => {
                        console.log('Enregistrement terminé avec succès pour :', outputTitle);
                        resolve();
                    })
                    .on('error', (err) => {
                        console.error('Erreur lors de l\'enregistrement pour :', outputTitle, err);
                        reject(err);
                    })
                    .run();
            });
        } else {
            console.error('Aucune URL .m3u8 trouvée sur la page pour :', outputTitle);
        }
    } catch (error) {
        console.error('Erreur lors de la récupération de la page HTML pour :', outputTitle, error);
    }
}
