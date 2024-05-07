// script.js
import axios from 'axios';
import ffmpeg from 'fluent-ffmpeg';
import dayjs from 'dayjs';
import { getDatabase, 
         insertOrUpdateInLinksTable, 
         getInfosFromTable, 
         updateColumn, 
         getInfosFromTableWithNameConstraint,
        } from './serveur.mjs';
import { Website, RecordingStatus, Action} from '../common/common.mjs';
import puppeteer from 'puppeteer';
import pathToFfmpeg from 'ffmpeg-static';
import path from 'node:path';
import {fileURLToPath} from 'url';
ffmpeg.setFfmpegPath(pathToFfmpeg);
let processes = new Map();
let browser;
let page;

// Fonction pour effectuer l'enregistrement
export async function createRecording(url, name, website) {
    try {
        let m3u8Url = null;
        const response = await axios.get(url.replace(/\\u002D/g, '-'));

        const correctedResponse = response.data.replace(/\\u002D/g, '-');

        switch (website) {
            case 'stripchat':
                m3u8Url = striptchatUrl(name, correctedResponse);
                break;
            case 'chaturbate':
                m3u8Url = chaturbateUrl(name, correctedResponse);
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

        if(m3u8Url != null) {
            ffmpegRecordRequest(m3u8Url, name)
        }
    }
    catch (error) {
        if (error.code === 'ECONNRESET' || error.code === 'ECONNABORTED') {
            console.error('Erreur lors de la recuperation de la page: ECONNRESET ou ECONNABORTED pour ', name);
        }
        else if (error.response && error.response.status === 403)
        {
            console.error('Erreur lors de la recuperation de la page: Error 403 Forbidden pour ', name);
        }
        else if (error.response && error.response.status === 404)
        {
            console.error('Erreur lors de la recuperation de la page: Error 404 Access Denied pour ', name);
        }
        else if (error.response && error.response.status === 429) {
            console.error('Erreur lors de la recuperation de la page: Error 429 Too many requests pour ', name);
            await new Promise(resolve => setTimeout(resolve, 30000));
            await createRecording(url, name, website);
        }
        else if (error.response && error.response.status === 502)
        {
            console.error('Erreur lors de la recuperation de la page: Error 502 Bad Gateway pour ', name);
        }
        else {
            console.error('Erreur lors de la recuperation de la page HTML pour :', name, error);
        }
    }
}

export async function ffmpegRecordRequest(m3u8Url, name )
{
    try {
        //Start from thr current file directory to go inside the 
        const grandParentDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'records');

        const outputPath = path.join(grandParentDirectory, `${name}_${dayjs().format("YYYY_MM_DD_HH_mm_ss")}.mkv`);

        if(m3u8Url == null || m3u8Url === '' || m3u8Url.includes("/_auto"))
        {
            return;
        }

        if (processes.get(name) != null)
        {
            processes.get(name).kill();

        }

        processes.set(name , ffmpeg(m3u8Url).output(outputPath)
                                            .native()
                                            .outputOptions('-c copy')
                                            .on('exit', () => {
                                                updateColumn(name, 'Online',false);
                                                console.log('Video recorder exited for: ', name)
                                            })
                                            .on('close',  () => {
                                                updateColumn(name, 'Online', false);
                                                console.log('Video recorder closed for: ', name)
                                            })
                                            .on('end', () => {
                                                updateColumn(name, 'Online', false);
                                                console.log('Video recorder ended for: ', name);
                                            })
                                            .on('error', (error) => {
                                                updateColumn(name, 'Online', false);
                                                console.error('Video recorder error for: ', name);
                                                console.error(error.message);
                                            }));
        processes.get(name).run();
    }
    catch (error) {
        if (error.response && error.response.status === 403)
        {
            console.error('Erreur lors de la recuperation de la page: Error 403 Forbidden access pour :', name);
        }
        else if (error.response && error.response.status === 404)
        {
            console.error('Erreur lors de la recuperation de la page: Error 404 Access Denied pour :', name);
        }
        else if (error.response && error.response.status === 429) {
            console.error('Erreur lors de la recuperation de la page: Error 429 Too many requests pour :', name);
            await new Promise(resolve => setTimeout(resolve, 30000));
            await createRecording(url, name, website);
        }
        else if (error.response && error.response.status === 502)
        {
            console.error('Erreur lors de la recuperation de la page: Error 502 Bad Gateway pour :', name);
        }
        else {
            console.error('Erreur lors de la recuperation de la page HTML pour :', name, error);
        }
    }
}

// Fonction pour parcourir les éléments de la table links et appeler createRecording
export function processLinks() {
    const db = getDatabase();

    if (!db) {
        console.error('Erreur: La base de données n\'est pas initialisée.');
        return;
    }

    db.all('SELECT * FROM links WHERE Online = 1 AND Record = 1', (err, rows) => {
        if (err) {
            console.error('Erreur lors de la recuperation des éléments de la table links:', err);
        } else {
            rows.forEach((row) => {
                const { Name, Url, Website} = row;
                if (processes.get(Name) === undefined) {
                    createRecording(Url, Name, Website);
                }
            });
        }
    });

    //console.log("Tout les lignes on été traitées");
}

export async function cam4Url(name, url, callback) {
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

export function striptchatUrl(name, data)
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

export function chaturbateUrl(name, data)
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

    const m3u8Urls = correctedResponse.match(/https?:\/\/[^"]*\.m3u8/g);

    if (m3u8Urls && m3u8Urls.length >= 1) {
        return m3u8Urls[0];
    } else {
        console.error('Aucune URL m3u8 trouvée pour : ', name);
        return null;
    }
}

export function killAProcess(name)
{
    if(processes.has(name)) {
        processes.get(name).kill();
        processes.delete(name);
    }
}

export function killAllProcesses()
{
    for (let key of processes.keys()) 
    {
        processes.get(key).kill();
        processes.delete(key);
    }
}

export function addNewModelfromUrl(modelUrl)
{
    const matchResult = modelUrl.match(/\.com\/(.*?)\/?$/);
    const website = modelUrl.match(/:\/\/(?:www\.)?(?:[a-zA-Z]+\.)?([a-zA-Z0-9_-]+)\.com\//);

    if (matchResult && matchResult.length >= 2) {
      const sousChaineExtraite = matchResult[1];
      return insertOrUpdateInLinksTable(sousChaineExtraite, modelUrl, website[1]);
    }
}

export async function updateLinksStatus()
{
    let nameStatusMap = new Map();
    const request = await getInfosFromTable("links", ["Name", "Url", "Website"]);
    const promises = request.map(async (row) => {
        nameStatusMap.set(...(await updateLinkStatus(row)));
    });

    await Promise.all(promises);
    return nameStatusMap;
}

export async function updateLinkStatus(row)
{
    const data = await findPageInfo(row.Url);
    try{
        switch (row.Website)
        {
            case Website.chaturbate:
            {
                let correctedResponse = data.replace(/\\u002D|\\u0022/g, (match) => {
                    switch (match) {
                        case '\\u002D':
                            return '-';
                        case '\\u0022':
                            return '"';
                        default:
                            return match;
                    }
                });
                const streamNameMatch = correctedResponse.match(/"room_status": "(.*?)"/);
                const streamName = streamNameMatch ? streamNameMatch[1] : null;
                let recordingStatus = RecordingStatus.offline;
                if (streamName === RecordingStatus.public) {
                    recordingStatus = RecordingStatus.public;
                } else if (streamName === RecordingStatus.offline || streamName === RecordingStatus.private) {
                    recordingStatus = streamName;
                }
                updateColumn(row.Name, 'Online', recordingStatus === RecordingStatus.public);
                return [row.Name, recordingStatus];
            }
            case Website.stripchat:
            {
                let correctedResponse = data.replace(/\\u002D|\\u002F|\\u0022/g, (match) => {
                    switch (match) {
                        case '\\u002D':
                            return '-';
                        case '\\u002F':
                            return '/';
                        case '\\u0022':
                            return '"';
                        default:
                            return match;
                    }
                });
                const streamOnlineMatch = correctedResponse.match(/"isOnline":(.*?),"/);
                
                if(streamOnlineMatch[1] === "true")
                {
                    updateColumn(row.Name, 'Online', true);
                    return [row.Name, RecordingStatus.public];
                }
                else
                {
                    updateColumn(row.Name, 'Online', false);
                    return [row.Name, RecordingStatus.offline];
                }               
            }
            case Website.cam4:
            {
                return [row.Name, RecordingStatus.offline];
            }
            default:
            {
                console.error("Website given does not supported : ", row.Website)
                return [row.Name, RecordingStatus.offline];
            }
        }
    }
    catch(error)
    {
        console.error(error.message);
        console.error(`Error might come from the row value : \n${row.Name}`);
        //console.error(`Error might come from the data value : \n${data}`);
        return [row.Name, RecordingStatus.offline];
    }
}

export async function findPageInfo(url)
{
    try{

        const response = await axios.get(url.replace(/\\u002D/g, '-'));
    
        const correctedResponse = response.data.replace(/\\u002D/g, '-');
    
        return correctedResponse;
    }
    catch(error)
    {
        if (error.response && error.response.status === 429) {
            console.error(`Erreur lors de la recuperation de la page: Error 429 Too many requests for the url :\n${url}`);
            await new Promise(resolve => setTimeout(resolve, 30000));
            await findPageInfo(url);
        }
    }

}

export async function startRecording(modelName)
{
    const modelRow = await getInfosFromTableWithNameConstraint('links', ['*'], modelName);
    try {
        const [name, status] = await updateLinkStatus(modelRow[0]);
        if(status == RecordingStatus.public)
        {
            createRecording(modelRow[0].Url, modelRow[0].Name, modelRow[0].Website);
        }            
        return status;
    } catch (error) {
        console.error(error.message);
        return RecordingStatus.offline;
    }
}
