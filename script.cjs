// script.cjs
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const dayjs = require('dayjs');
const { getDatabase, updateOnline, getWebsite } = require('./serveur.cjs');
const fs = require('fs-extra').promises;
const flatted = require('flatted');
const puppeteer = require('puppeteer');
const Queue = require('p-queue');
const cam4Queue = new Queue({ concurrency: 1 }); // Un seul élément peut être traité à la fois
const othersQueue = new Queue({ concurrency: 3}); // trois élément à la fois peuvent être traité
  
let browser;
let page;

// Fonction pour effectuer l'enregistrement
async function createRecording(url, name, website) {
    try {
        console.log('Commencer l\'enregistrement pour URL :', url);

        const response = await axios.get(url.replace(/\\u002D/g, '-'));

        const correctedResponse = response.data.replace(/\\u002D/g, '-');

        switch (website) {
            case 'stripchat':
                striptchatUrl(name, correctedResponse, (m3u8Url) => {
                    if(m3u8Url)
                    {
                        ffmpegRecordRequest(m3u8Url, name);
                    }
                    else{
                        console.log('None m3u8 url found');
                    }
                });
                break;
            case 'chaturbate':
                chaturbateUrl(name, correctedResponse, (m3u8Url) => {
                    if(m3u8Url)
                    {
                        ffmpegRecordRequest(m3u8Url, name);
                    }
                    else{
                        console.log('None m3u8 url found');
                    }
                });
                break;
            case 'cam4':
                //if(name === 'lucie_mehott')
                // Utiliser la file d'attente uniquement pour Cam4
                /*await cam4Queue.add(() => cam4Url(name, url, (m3u8Url) => {
                    if (m3u8Url) {
                        console.log("Cam4 flux request");
                        ffmpegRecordRequest(m3u8Url, name);
                    }
                }));*/
                break;   
            default:
                break;
        }
    }
    catch (error) {
        if (error.code === 'ECONNRESET' || error.code === 'ECONNABORTED') {
            console.error('Erreur lors de la récupération de la page: ECONNRESET ou ECONNABORTED pour ', name);
        }
        else if (error.response && error.response.status === 429) {
            console.error('Erreur lors de la récupération de la page: Error 429 Too many requests');
            await new Promise(resolve => setTimeout(resolve, 30000));
            await createRecording(url, name, website);
        }
        else if (error.response && error.response.status === 404)
        {
            console.error('Erreur lors de la récupération de la page: Error 404 Access Denied pour ', name);
        }
        else if (error.response && error.response.status === 502)
        {
            console.error('Erreur lors de la récupération de la page: Error 502 Bad Gateway pour ', name);
        }
        else {
            console.error('Erreur lors de la récupération de la page HTML pour :', name, error);
        }
    }
}

async function ffmpegRecordRequest(m3u8Url, name )
{
    try {
        const outputPath = `./records/${name}_${dayjs().format("YYYY_MM_DD_HH_mm_ss")}.mkv`;

        if(m3u8Url == null || m3u8Url === '' || m3u8Url.includes("/_auto"))
        {
            return;
        }

        if (name) {
            updateOnline(name, true);
        }

        await new Promise((resolve, reject) => {
            ffmpeg(m3u8Url)
                .output(outputPath)
                .outputOptions('-c copy')
                .on('end', () => {
                    if (name) {
                        updateOnline(name, false);
                    }
                    console.log('Enregistrement terminé avec succès pour :', name);
                    resolve();
                })
                .on('error', (err) => {
                    if (name) {
                        updateOnline(name, false);
                    }
                    console.error('Erreur lors de l\'enregistrement pour :', name);
                    //reject(err);
                })
                .run();
        });
    }
    catch (error) {
        if (error.response && error.response.status === 403)
        {
            console.error('Erreur lors de la récupération de la page: Error 403 Forbidden access pour :', name);
        }
        else if (error.response && error.response.status === 404)
        {
            console.error('Erreur lors de la récupération de la page: Error 404 Access Denied pour :', name);
        }
        else if (error.response && error.response.status === 429) {
            console.error('Erreur lors de la récupération de la page: Error 429 Too many requests pour :', name);
            await new Promise(resolve => setTimeout(resolve, 30000));
            await createRecording(url, name, website);
        }
        else if (error.response && error.response.status === 502)
        {
            console.error('Erreur lors de la récupération de la page: Error 502 Bad Gateway pour :', name);
        }
        else {
            console.error('Erreur lors de la récupération de la page HTML pour :', name, error);
        }
    }
}

// Fonction pour parcourir les éléments de la table links et appeler createRecording
async function processLinks() {
    const db = getDatabase();

    if (!db) {
        console.error('Erreur: La base de données n\'est pas initialisée.');
        return;
    }

    db.all('SELECT * FROM links', (err, rows) => {
        if (err) {
            console.error('Erreur lors de la récupération des éléments de la table links:', err);
        } else {
            rows.forEach((row) => {
                const { Name, Url, Online, Website } = row;
                if (!Online) {
                    othersQueue.add(() => createRecording(Url, Name, Website));
                }
            });
        }
    });

    await othersQueue.onIdle();
    console.log("Tout les lignes on été traitées");
}

async function cam4Url(name, url, callback) {
    try{
        browser = await puppeteer.launch({
            args: ['--disable-gpu']
          });
        page = await browser.newPage();

        // Activer l'interception des requêtes réseau
        await page.setRequestInterception(true);

        let m3u8Url; // Variable pour stocker l'URL m3u8 détectée

        // Écoutez les événements de requête
        page.on('request', (request) => {
            if (/m3u8/.test(request.url())) {
                // Afficher l'URL de la requête
                console.log('Detected m3u8 request:', request.url());
                // Enregistrer l'URL détectée
                if(!m3u8Url)
                {
                    m3u8Url = request.url();
                    callback(m3u8Url);
                    browser.close();
                }
                // Ne fermez pas la page immédiatement
            }
            request.continue();
        });

        // Écoutez l'événement de fin de chargement de la page
        page.on('load', () => {
            console.log('Page loaded : ',url );
        });

        console.log("Ouverture de la page");
        // Navigate to the URL
        await page.goto(url);

        // Attendre que la balise avec l'ID spécifié soit présente dans la page
        const verificationButtonId = 'ssdq12FB_disclaimerWithAgeVerification_badge-agreeBtn';
        const verificationButtonSelector = `#${verificationButtonId}`;
        await page.waitForSelector(verificationButtonSelector);

        // Cliquez sur la balise avec l'ID spécifié
        await page.click(verificationButtonSelector);

        // Attendre que la navigation soit terminée après le clic
        await page.waitForNavigation({ timeout: 3000 });
    }
    catch(error)
    {
        console.log("Too long time and page close for : ", name);
        const isConnected = await browser.isConnected();
        if(isConnected)
        {
            browser.close();
        }
        callback(null);
    }
}


function striptchatUrl(name, data, callback)
{
    // Pour extraire la sous-chaîne entre \"streamName\":\" et \"
    const streamNameMatch = data.match(/\"streamName\":\"(.*?)\"/);
    const streamName = streamNameMatch ? streamNameMatch[1] : null;

    // Pour extraire la sous-chaîne entre \"domain\":\" et \"
    const domainMatch = data.match(/\"domain\":\"(.*?)\"/);
    const domain = domainMatch ? domainMatch[1] : null;

    if(domain === '' || streamName === '' || domain == null || streamName == null)
    {
        callback(null);
    }

    const correctedResponse = data.replace(/\\u002D|\\u002F|{streamName}|{cdnHost}|{suffix}/g, (match) => {
        switch (match) {
            case '\\u002D':
                return '-';
            case '\\u002F':
                return '/';
            case '{streamName}':
                return streamName;
            case '{cdnHost}':
                return domain;
            case '{suffix}':
                return '_auto';
            default:
                return match;
        }
    });

    const m3u8Urls = correctedResponse.match(/https?:\/\/[^"]*\.m3u8/g);

    if (m3u8Urls && m3u8Urls.length >= 1) {
        callback(m3u8Urls[0]);
    } else {
        console.error('Aucune URL m3u8 trouvée pour : ', name);
    }

}

async function chaturbateUrl(name, data, callback)
{
    const correctedResponse = data.replace(/\\u002D/g, "-");
    const m3u8Urls = correctedResponse.match(/https?:\/\/[^"]*\.m3u8/g);

    if (m3u8Urls && m3u8Urls.length >= 1) {
        callback(m3u8Urls[0]);
    } else {
        console.error('Aucune URL m3u8 trouvée pour : ', name);
    }
}
  
// Exportez les fonctions pour qu'elles puissent être utilisées dans d'autres fichiers
module.exports = {
    createRecording,
    processLinks,
};
