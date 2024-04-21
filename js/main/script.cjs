// script.cjs
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const dayjs = require('dayjs');
const { getDatabase, updateOnline, getWebsite, insertOrUpdateInLinksTable, getInfosFromTable} = require('./serveur.cjs');
const { Website, RecordingStatus } = require('../common/common.js');
const puppeteer = require('puppeteer');
const processes = new Map();
  
let browser;
let page;

// Fonction pour effectuer l'enregistrement
async function createRecording(url, name, website) {
    try {
        let m3u8Url = null;
        const response = await axios.get(url.replace(/\\u002D/g, '-'));

        const correctedResponse = response.data.replace(/\\u002D/g, '-');

        switch (website) {
            case 'stripchat':
                m3u8Url = striptchatUrl(name, correctedResponse);
                if(m3u8Url != null) {
                    ffmpegRecordRequest(m3u8Url, name)
                }
                break;
            case 'chaturbate':
                m3u8Url = chaturbateUrl(name, correctedResponse);
                if(m3u8Url != null)
                {
                    ffmpegRecordRequest(m3u8Url, name);
                }
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
        else if (error.response && error.response.status === 403)
        {
            console.error('Erreur lors de la récupération de la page: Error 403 Forbidden pour ', name);
        }
        else if (error.response && error.response.status === 404)
        {
            console.error('Erreur lors de la récupération de la page: Error 404 Access Denied pour ', name);
        }
        else if (error.response && error.response.status === 429) {
            console.error('Erreur lors de la récupération de la page: Error 429 Too many requests');
            await new Promise(resolve => setTimeout(resolve, 30000));
            await createRecording(url, name, website);
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
        /*
        processes.set(name , ffmpeg(m3u8Url).output(outputPath)
                                            .native()
                                            .outputOptions('-c copy')
                                            .on('exit', () => {
                                                updateOnline(name, false);
                                                console.log('Video recorder exited for: ', name)
                                            })
                                            .on('close',  () => {
                                                updateOnline(name, false);
                                                console.log('Video recorder closed for: ', name)
                                            })
                                            .on('end', () => {
                                                updateOnline(name, false);
                                                console.log('Video recorder ended for: ', name);
                                            })
                                            .on('error', () => {
                                                updateOnline(name, false);
                                                console.error('Video recorder error for: ', name);
                                            }));
        processes.get(name).run();
        */
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
function processLinks() {
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
                const { Name, Url, Record, Website } = row;
                if (Record) {
                    createRecording(Url, Name, Website);
                }
            });
        }
    });

    //console.log("Tout les lignes on été traitées");
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
                    callback(m3u8Url, name);
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

function striptchatUrl(name, data)
{
    // Pour extraire la sous-chaîne entre \"streamName\":\" et \"
    const streamNameMatch = data.match(/\"streamName\":\"(.*?)\"/);
    const streamName = streamNameMatch ? streamNameMatch[1] : null;

    // Pour extraire la sous-chaîne entre \"domain\":\" et \"
    const domainMatch = data.match(/\"domain\":\"(.*?)\"/);
    const domain = domainMatch ? domainMatch[1] : null;

    if(domain === '' || streamName === '' || domain == null || streamName == null)
    {
        return null;
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
        return m3u8Urls[0];
    } else {
        console.error('Aucune URL m3u8 trouvée pour : ', name);
        return null;
    }

}

function chaturbateUrl(name, data)
{
    const correctedResponse = data.replace(/\\u002D|\\u0022/g, (match) => {
        switch (match) {
            case '\\u002D':
                return '-';
            case '\\u0022':
                return '"';
            default:
                return match;
        }
    });

    /** 
     * @todo using the following comment code to get the chaturbate model status : private, public, offline
     */
    /*
    const streamNameMatch = correctedResponse.match(/room_status\": \"(.*?)\", \"num_viewer/);
    const streamName = streamNameMatch ? streamNameMatch[1] : null;
    */

    const m3u8Urls = correctedResponse.match(/https?:\/\/[^"]*\.m3u8/g);

    if (m3u8Urls && m3u8Urls.length >= 1) {
        return m3u8Urls[0];
    } else {
        return null;
    }
}

function killAProcess(name)
{
    // Obtenir un processus associé à une clé qui n'existe pas
    const process = processes.get(name);

    console.log("Type of process :" + typeof process );

    // Vérifier si la valeur existe
    /*if (process !== undefined) {
        // Appeler la méthode kill sur le processus
        process.reject();
    } */
    // else : Nothing to do
}

function killAllProcesses()
{
    processes.forEach((process) => {
        process.reject();
        console.log("Type of process :" + typeof process );
    })
}

function addNewModelfromUrl(modelUrl)
{
    const matchResult = modelUrl.match(/\.com\/(.*?)\/?$/);
    const website = modelUrl.match(/:\/\/(?:www\.)?(?:[a-zA-Z]+\.)?([a-zA-Z0-9_-]+)\.com\//);

    if (matchResult && matchResult.length >= 2) {
      const sousChaineExtraite = matchResult[1];
      return insertOrUpdateInLinksTable(sousChaineExtraite, modelUrl, website[1]);
    }
}

function updateStatus()
{
    const nameAndUrl = getInfosFromTable("links", ["Name", "Url", "Website"]);
    nameAndUrl.forEach((row) => {
        const data = findPageInfo(row.Url);
        switch (row.Website)
        {
            case Website.chaturbate:
            {
                const correctedResponse = data.replace(/\\u002D|\\u0022/g, (match) => {
                    switch (match) {
                        case '\\u002D':
                            return '-';
                        case '\\u0022':
                            return '"';
                        default:
                            return match;
                    }
                });

                const streamNameMatch = correctedResponse.match(/room_status\": \"(.*?)\", \"num_viewer/);
                const streamName = streamNameMatch ? streamNameMatch[1] : null;
                switch (streamName) {
                    case RecordingStatus.offline:
                    case RecordingStatus.private:
                    {
                        updateOnline(row.Name, false);
                    }
                    case RecordingStatus.public:
                    {
                        updateOnline(row.Name, true);
                    }
                    default:
                    {
                        break;
                    }
                }
                break;
            }
            default:
            {
                break;
            }
        }
    });
}

async function findPageInfo(url)
{
    const response = await axios.get(url.replace(/\\u002D/g, '-'));

    const correctedResponse = response.data.replace(/\\u002D/g, '-');

    return correctedResponse;

}
  
// Exportez les fonctions pour qu'elles puissent être utilisées dans d'autres fichiers
module.exports = {
    createRecording,
    processLinks,
    killAProcess,
    killAllProcesses,
    addNewModelfromUrl,
};
