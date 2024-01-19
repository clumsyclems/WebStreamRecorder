const { app, BrowserWindow, ipcMain} = require('electron');
const path = require('path');
const moment = require('moment');
const { createRecording, processLinks } = require('./script.cjs');
const { initializeDatabase, insertInLinksTable, setAllOffline } = require ('./serveur.cjs');
const cron = require('node-cron');

//Initialise la base de donnée
initializeDatabase(app);

//À l'init je parcours la base de donnée pour lancé les enregistrements par défauts
processLinks();

//Créer une tache de fonds pour pouvoir faire la vérification et lancer les enregistrements par défaut de manière régulière (ici toutes les minutes)
cron.schedule('* */10 * * * *', () => {
    processLinks();
  });

//L

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
            mainWindow.webContents.session.webRequest.onBeforeRequest(filter, callback => {
                // Continuer la requête normalement
                callback({});
            });

            // Charger la page
            mainWindow.webContents.loadURL(pageUrl);
        });
    });

    mainWindow.on('closed', function () {
        // Appeler setAllOffline lors de la fermeture de la fenêtre
        setAllOffline();
        mainWindow = null;
    });
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
    // Appeler setAllOffline lors de la fermeture de toutes les fenêtres
    setAllOffline();

    if (process.platform !== 'darwin') app.quit();
});

// Gestionnaire d'événement pour le signal de terminaison (Ctrl+C)
process.on('SIGINT', () => {
    // Appeler setAllOffline lors de la terminaison de l'application par Ctrl+C
    setAllOffline();
    app.quit();
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

            insertInLinksTable(sousChaineExtraite,url);

            // Utilisez sousChaineExtraite comme nécessaire pour renommer le fichier de sortie
            const outputTitle = `./records/${sousChaineExtraite}_${moment().format("YYYY_MM_DD_HH_mm_ss")}.mp4`;
            createRecording(url, outputTitle, sousChaineExtraite);
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