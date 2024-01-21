// serveur.cjs
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let db; // La connexion à la base de données sera stockée ici

// Fonction pour initialiser la base de données et créer la table si elle n'existe pas
function initializeDatabase(app) {
  const dbPath = path.join(app.getAppPath(), 'myDatabase.db');
  db = new sqlite3.Database(dbPath);

  db.run(`
    CREATE TABLE IF NOT EXISTS links (
      Name TEXT PRIMARY KEY,
      Url TEXT NOT NULL,
      Online BOOLEAN DEFAULT FALSE,
      Record BOOLEAN DEFAULT FALSE,
      Website TEXT NOT NULL,
      Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  return db; // Retourner la connexion à la base de données pour pouvoir l'utiliser dans ce fichier
}

// Fonction générique pour exécuter une requête SQL avec des paramètres
function runQuery(query, params = [], callback = () => {}) {
  if (!db) {
    console.error('Erreur: La base de données n\'est pas initialisée.');
    return;
  }

  db.run(query, params, (err) => {
    if (err) {
      console.error('Erreur lors de l\'exécution de la requête:', err);
    } else {
      callback();
    }
  });
}

// Fonction pour insérer ou mettre à jour des valeurs dans la table links
function insertOrUpdateInLinksTable(name, url, website, online = false, record = false) {
  const query = `
    INSERT INTO links (Name, Url, Online, Record, Website)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(Name) DO UPDATE SET
      Url = excluded.Url,
      Online = excluded.Online,
      Record = excluded.Record,
      Website = excluded.Website
  `;

  runQuery(query, [name, url, online, record, website]);
}

// Fonction générique pour mettre à jour une colonne d'un élément dans la table links
function updateColumn(name, columnName, columnValue) {
  const query = `UPDATE links SET ${columnName} = ? WHERE Name = ?`;

  runQuery(query, [columnValue, name]);
}

// Fonction pour récupérer la valeur "Website" d'un élément dans la table links
function getWebsite(name, callback) {
  const query = 'SELECT Website FROM links WHERE Name = ?';

  db.get(query, [name], (err, row) => {
    const website = row ? row.Website : null;
    callback(website);
  });
}

// Fonction pour mettre à 'false' la valeur "Online" de tous les éléments dans la table links
function setAllOffline() {
  const query = 'UPDATE links SET Online = ?';
  runQuery(query, [false]);
}

// Exporter les fonctions pour qu'elles puissent être utilisées dans d'autres fichiers
module.exports = {
  initializeDatabase,
  insertOrUpdateInLinksTable,
  updateColumn,
  updateOnline: (name, online) => updateColumn(name, 'Online', online),
  updateRecord: (name, record) => updateColumn(name, 'Record', record),
  updateWebsite: (name, website) => updateColumn(name, 'Website', website),
  getWebsite,
  setAllOffline,
  getDatabase: () => db,
};
