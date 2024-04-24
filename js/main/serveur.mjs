// serveur.js
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

let db; // La connexion à la base de données sera stockée ici

// Fonction pour initialiser la base de données et créer la table si elle n'existe pas
export function initializeDatabase(app) {
  const dbPath = path.join(dirname(fileURLToPath(import.meta.url)), '../../database/myDatabase.db');
  db = new sqlite3.Database(dbPath);

  db.run(`CREATE TABLE IF NOT EXISTS links (
    Name TEXT,
    Url TEXT,
    Online BOOLEAN DEFAULT FALSE,
    Record BOOLEAN DEFAULT FALSE,
    Website TEXT NOT NULL,
    Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (Name, Url)
    )`
  );
  
  return db; // Retourner la connexion à la base de données pour pouvoir l'utiliser dans ce fichier
}

// Fonction générique pour exécuter une requête SQL avec des paramètres
export async function runQuery(query, params = []) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Erreur: La base de données n\'est pas initialisée.'));
      console.error("The Database is not initialized");
      return;
    }

    db.run(query, params, function(err) {
      if (err) {
        reject(new Error('Erreur lors de l\'exécution de la requête:', err));
      } else {
        resolve({ message: 'Requête exécutée avec succès' });
      }
    });
  });
}


// Fonction pour insérer ou mettre à jour des valeurs dans la table links
export async function insertOrUpdateInLinksTable(name, url, website, online = false, record = false) {
  const query = `
    INSERT INTO links (Name, Url, Online, Record, Website)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(Name, Url) DO UPDATE SET
      Online = excluded.Online,
      Record = excluded.Record,
      Website = excluded.Website
  `;

  try {
    const success = await runQuery(query, [name, url, online, record, website]);
    return success;
  } catch (error) {
    return false;
  }
}

// Fonction générique pour mettre à jour une colonne d'un élément dans la table links
export async function updateColumn(name, columnName, columnValue) {
  const query = `UPDATE links SET ${columnName} = ? WHERE Name = ?`;

  try {
    const success = await runQuery(query, [columnValue, name]);
    return success;
  } catch (error) {
    return false;
  }
}

// Fonction pour récupérer la valeur "Website" d'un élément dans la table links
export function getWebsite(name, callback) {
  const query = 'SELECT Website FROM links WHERE Name = ?';

  db.get(query, [name], (err, row) => {
    const website = row ? row.Website : null;
    callback(website);
  });

}

// Fonction pour mettre à 'false' la valeur "Online" de tous les éléments dans la table links
export async function setAllOffline() {
  const query = 'UPDATE links SET Online = ?';
  try {
    const success = await runQuery(query, [false]);
    return success;
  } catch (error) {
    return false;
  }
}

// Fonction pour supprimer une ligne de la table links
export async function removeLinkFromName(name){
  const query = 'DELETE FROM links WHERE Name = ?';
  try {
    const success = await runQuery(query, [name]);
    return success;
  } catch (error) {
    return false;
  }
}

//fonction pour récupérer tout la table links
export function getAllLinks() { 
  return new Promise((resolve, reject) => {
    // Récupérer plusieurs éléments de la table
    db.all('SELECT * FROM links ORDER BY Name', (err, rows) => {
      if (err) {
        reject(err); // Rejeter la promesse en cas d'erreur
        return;
      }

      resolve(rows); // Résoudre la promesse avec les éléments récupérés
    });
  });
}

export function getInfosFromTable(table, params = []){
  const query = `SELECT  ${params.join(', ')} FROM ${table}`;
  return new Promise((resolve, reject) => {
    db.all(query, (err, rows) => {
      if(err) {
        reject(err);
        return;
      }

      resolve(rows);
    });
  });
}

export function getInfosFromTableWithNameConstraint(table, params = [], name){
  const query = `SELECT  ${params.join(', ')} FROM ${table} WHERE Name = '${name}'`;
  return new Promise((resolve, reject) => {
    db.all(query, (err, rows) => {
      if(err) {
        reject(err);
        return;
      }

      resolve(rows);
    });
  });
}

export function getInfosFromTableWithUrlConstraint(table, params = [], url){
  return new Promise((resolve, reject) => {
    db.all(`SELECT ${params.join(', ')} FROM ${table} WHERE Url = '${url}'`, (err, rows) => {
      if(err) {
        reject(err);
        return;
      }

      resolve(rows);
    });
  });
}

export function getDatabase()
{
  return db;
}
