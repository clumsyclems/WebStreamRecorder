// script.cjs
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const moment = require('moment');
const { getDatabase, updateOnline } = require('./serveur.cjs');

// Fonction pour effectuer l'enregistrement
async function createRecording(url, outputTitle, name = null) {
    try {
        console.log('Commencer l\'enregistrement pour URL :', url);

        const response = await axios.get(url.replace(/\\u002D/g, '-'));
        const correctedResponse = response.data.replace(/\\u002D/g, '-');

        // Ajout de l'affichage des URL avant le filtrage
        console.log('URLs trouvées avant le filtrage :', correctedResponse.match(/https?:\/\/[^"]*\.m3u8/g));

        const m3u8Urls = correctedResponse.match(/https?:\/\/[^"]*\.m3u8/g);

        if (m3u8Urls && m3u8Urls.length > 0) {
            const firstM3u8Url = m3u8Urls[0];
            if(name){updateOnline(name, true);}            
            const outputPath = `./${outputTitle}`;

            await new Promise((resolve, reject) => {
                ffmpeg(firstM3u8Url)
                    .output(outputPath)
                    .on('end', () => {
                        if(name){updateOnline(name, false);}
                        console.log('Enregistrement terminé avec succès pour :', outputTitle);
                        resolve();
                    })
                    .on('error', (err) => {
                        if(name){updateOnline(name, false);}
                        console.error('Erreur lors de l\'enregistrement pour :', outputTitle, err);
                        reject(err);
                    })
                    .run();
            });
        } else {
            console.error('Aucune URL .m3u8 trouvée sur la page pour :', outputTitle);
        }
    } catch (error) {
        if(error.response && error.response.status === 429)
        {
            console.error('Erreur lors de la récupération de la page: Error 429 Too many request', outputTitle, error);
        }
        else
        {
            console.error('Erreur lors de la récupération de la page HTML pour :', outputTitle, error);
        }
    }
}

// Fonction pour parcourir les éléments de la table links et appeler createRecording
async function processLinks() {

    //Récupère le chemin de la base de donnée dans serveur.cjs
    const db = getDatabase();

    // Vérifier si la base de données est initialisée
    if (!db) {
      console.error('Erreur: La base de données n\'est pas initialisée.');
      return;
    }
  
    // Récupérer tous les éléments de la table links
    db.all('SELECT * FROM links', (err, rows) => {
      if (err) {
        console.error('Erreur lors de la récupération des éléments de la table links:', err);
      } else {
        // Pour chaque élément, appeler createRecording
        rows.forEach((row) => {
          const { Name, Url, Online } = row;
          if(!Online)
          {
            const outputTitle = `./records/${Name}_${moment().format("YYYY_MM_DD_HH_mm_ss")}.mp4`;

            // Appeler la fonction createRecording avec les paramètres nécessaires
            createRecording(Url, outputTitle, Name);
          }
          
        });
      }
    });
  }
  

// Exportez la fonction pour qu'elle puisse être utilisée dans d'autres fichiers
module.exports = {
    createRecording,
    processLinks,
};
