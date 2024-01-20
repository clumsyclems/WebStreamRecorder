// serveur.cjs
const sqlite3 = require('sqlite3');
const path = require('path');
const fs = require('fs');

let db; // La connexion à la base de données sera stockée ici

// Fonction pour initialiser la base de données et créer la table si elle n'existe pas
function initializeDatabase(app) {
  const dbPath = path.join(app.getAppPath(), 'myDatabase.db');
  db = new sqlite3.Database(dbPath);

  db.serialize(() => {
    // Ajoutez la nouvelle colonne "Website" à la table links s'il n'existe pas déjà
    db.run(`ALTER TABLE links ADD COLUMN IF NOT EXISTS Website TEXT`);
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS links (
      Name TEXT PRIMARY KEY,
      Url TEXT NOT NULL,
      Online BOOLEAN DEFAULT FALSE,
      Record BOOLEAN DEFAULT FALSE,
      Website TEXT,
      Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Retourner la connexion à la base de données pour pouvoir l'utiliser dans ce fichier
  return db;
}

// Fonction pour insérer des valeurs dans la table links
function insertInLinksTable(name, url, website = null, online = false, record = false) {
  // Vérifier si la base de données est initialisée
  if (!db) {
    console.error('Erreur: La base de données n\'est pas initialisée.');
    return;
  }

  // Insérer les valeurs dans la table
  db.run('INSERT INTO links (Name, Url, Online, Record, Website) VALUES (?, ?, ?, ?, ?)', [name, url, online, record, website], (err) => {
    if (err) {
      console.error('Erreur lors de l\'insertion dans la table links:', err);
    } else {
      console.log('Insertion réussie dans la table links.');
    }
  });
}

// Fonction pour mettre à jour la valeur "Online" d'un élément dans la table links
function updateOnline(name, online) {
    // Vérifier si la base de données est initialisée
    if (!db) {
      console.error('Erreur: La base de données n\'est pas initialisée.');
      return;
    }
  
    // Mettre à jour la valeur "Online" pour l'élément avec le nom spécifié
    db.run('UPDATE links SET Online = ? WHERE Name = ?', [online, name], (err) => {
      if (err) {
        console.error('Erreur lors de la mise à jour de "Online" dans la table links:', err);
      } else {
        console.log('Mise à jour de "Online" réussie dans la table links.');
      }
    });
}

// Fonction pour mettre à 'false' la valeur "Online" de tous les éléments dans la table links
function setAllOffline() {
    // Vérifier si la base de données est initialisée
    if (!db) {
      console.error('Erreur: La base de données n\'est pas initialisée.');
      return;
    }
  
    // Mettre à 'false' la valeur "Online" pour tous les éléments
    db.run('UPDATE links SET Online = ?', [false], (err) => {
      if (err) {
        console.error('Erreur lors de la mise à "Offline" pour tous les éléments dans la table links:', err);
      } else {
        console.log('Mise à "Offline" réussie pour tous les éléments dans la table links.');
      }
    });
}

// Fonction pour mettre à jour la valeur "Record" d'un élément dans la table links
function updateRecord(name, record) {
// Vérifier si la base de données est initialisée
if (!db) {
    console.error('Erreur: La base de données n\'est pas initialisée.');
    return;
}

// Mettre à jour la valeur "Record" pour l'élément avec le nom spécifié
db.run('UPDATE links SET Record = ? WHERE Name = ?', [record, name], (err) => {
    if (err) {
    console.error('Erreur lors de la mise à jour de "Record" dans la table links:', err);
    } else {
    console.log('Mise à jour de "Record" réussie dans la table links.');
    }
});
}

// Fonction pour mettre à jour la valeur "Online" d'un élément dans la table links
function updateWebsite(name, website) {
    // Vérifier si la base de données est initialisée
    if (!db) {
      console.error('Erreur: La base de données n\'est pas initialisée.');
      return;
    }
  
    // Mettre à jour la valeur "Online" pour l'élément avec le nom spécifié
    db.run('UPDATE links SET Website = ? WHERE Name = ?', [website, name], (err) => {
      if (err) {
        console.error('Erreur lors de la mise à jour de "Online" dans la table links:', err);
      } else {
        console.log('Mise à jour de "Online" réussie dans la table links.');
      }
    });
}


// Exporter les fonctions pour qu'elles puissent être utilisées dans d'autres fichiers
module.exports = {
  initializeDatabase,
  insertInLinksTable,
  updateOnline,
  setAllOffline,
  updateRecord,
  updateWebsite,
  getDatabase: () => db,
};
