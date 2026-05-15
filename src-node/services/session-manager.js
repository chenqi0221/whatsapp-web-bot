const fs = require('fs');
const path = require('path');
const config = require('../config/default');
const logger = require('../utils/logger');
const { listAccounts } = require('./account-store');

function getAuthPath() {
    return path.resolve(config.whatsapp.authPath);
}

function listSavedSessions() {
    const accounts = listAccounts();
    return accounts.map((acc) => ({
        id: acc.id,
        name: acc.name,
        lastUsed: acc.lastUsed,
        createdAt: acc.createdAt,
    }));
}

function clearAllSessions() {
    const authPath = getAuthPath();
    if (fs.existsSync(authPath)) {
        try {
            // 只删除 session- 开头的目录，保留 accounts.json
            const entries = fs.readdirSync(authPath, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory() && entry.name.startsWith('session')) {
                    fs.rmSync(path.join(authPath, entry.name), {
                        recursive: true,
                        force: true,
                    });
                }
            }
            logger.info('All session directories cleared');
        } catch (e) {
            logger.error('Error clearing sessions:', { error: e.message });
        }
    }
}

function clearSession(sessionId) {
    const authPath = getAuthPath();
    const sessionPath = path.join(authPath, sessionId);
    if (fs.existsSync(sessionPath)) {
        try {
            fs.rmSync(sessionPath, { recursive: true, force: true });
            logger.info(`Session ${sessionId} cleared`);
            return true;
        } catch (e) {
            logger.error('Error clearing session:', { error: e.message });
            return false;
        }
    }
    return false;
}

module.exports = { listSavedSessions, clearAllSessions, clearSession };
