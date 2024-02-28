// script.cjs
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const dayjs = require('dayjs');
const { getDatabase, updateOnline } = require('./serveur.cjs');

// Fonction pour effectuer l'enregistrement
async function createRecording(url, name) {
    try {
        console.log('Commencer l\'enregistrement pour URL :', url);

        const response = await axios.get(url.replace(/\\u002D/g, '-'));

        // Pour extraire la sous-chaîne entre \"streamName\":\" et \"
        const streamNameMatch = response.data.match(/\"streamName\":\"(.*?)\"/);
        const streamName = streamNameMatch ? streamNameMatch[1] : null;

        // Pour extraire la sous-chaîne entre \"domain\":\" et \"
        const domainMatch = response.data.match(/\"domain\":\"(.*?)\"/);
        const domain = domainMatch ? domainMatch[1] : null;

        const correctedResponse = response.data.replace(/\\u002D|\\u002F|{streamName}|{cdnHost}|{suffix}/g, (match) => {
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

        console.log('URLs trouvées avant le filtrage :', correctedResponse.match(/https?:\/\/[^"]*\.m3u8/g));

        const m3u8Urls = correctedResponse.match(/https?:\/\/[^"]*\.m3u8/g);

        if (m3u8Urls && m3u8Urls.length > 0) {
            const firstM3u8Url = m3u8Urls[0];
            if (name) {
                updateOnline(name, true);
            }
            const outputPath = `./records/${name}_${dayjs().format("YYYY_MM_DD_HH_mm_ss")}.mkv`;

            await new Promise((resolve, reject) => {
                ffmpeg(firstM3u8Url)
                    .output(outputPath)
                    .outputOptions('-c copy') // Allow to avoid the re-encoding video
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
        } else {
            console.error('Aucune URL .m3u8 trouvée sur la page pour :', name);
        }
    } catch (error) {
        if (error.response && error.response.status === 429) {
            console.error('Erreur lors de la récupération de la page: Error 429 Too many requests');
            await new Promise(resolve => setTimeout(resolve, 30000));
            await createRecording(url, name);
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
                const { Name, Url, Online } = row;
                if (!Online) {
                    createRecording(Url, Name);
                }
            });
        }
    });
}

// Exportez les fonctions pour qu'elles puissent être utilisées dans d'autres fichiers
module.exports = {
    createRecording,
    processLinks,
};
