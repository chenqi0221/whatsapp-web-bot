const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config/default');
const logger = require('../utils/logger');

let db = null;

function getDb() {
    if (db) return db;

    const dbPath = path.resolve(config.database.path);
    const dir = path.dirname(dbPath);

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schema);

    const migrations = [
        'ALTER TABLE accounts ADD COLUMN status TEXT DEFAULT \'offline\'',
        'ALTER TABLE accounts ADD COLUMN daily_limit INTEGER DEFAULT 30',
        'ALTER TABLE accounts ADD COLUMN total_sent INTEGER DEFAULT 0',
        'ALTER TABLE accounts ADD COLUMN total_failed INTEGER DEFAULT 0',
        'ALTER TABLE accounts ADD COLUMN last_active TEXT',
    ];
    for (const sql of migrations) {
        try { db.exec(sql); } catch (_) { /* column already exists */ }
    }

    logger.info(`Database connected: ${dbPath}`);
    return db;
}

function closeDb() {
    if (db) {
        db.close();
        db = null;
        logger.info('Database connection closed');
    }
}

module.exports = { getDb, closeDb };