const logger = require('../utils/logger');
const repo = require('../db/repositories/account-repository');

function createAccount(name, phone = null) {
    const id = 'acc_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
    const row = repo.create(id, name || '未命名账号', 'NEW_ACCOUNT', phone);
    logger.info(`Account created: ${id}`);
    return formatAccount(row);
}

function getAccount(id) {
    const row = repo.findById(id);
    if (!row) return null;
    return formatAccount(row);
}

function getAccountByPhone(phone) {
    const row = repo.findByPhone(phone);
    if (!row) return null;
    return formatAccount(row);
}

function listAccounts() {
    return repo.findAll().map(formatAccount);
}

function searchAccounts(query) {
    return repo.searchAccounts(query).map(formatAccount);
}

function updateAccountLastUsed(id) {
    repo.updateStatus(id, 'online');
}

function renameAccount(id, newName) {
    if (!newName) return false;
    repo.update(id, { name: newName });
    return true;
}

function updatePhone(id, phone) {
    repo.update(id, { phone });
    return true;
}

function updateAccountStatus(id, status) {
    repo.updateStatus(id, status);
}

function deleteAccount(id) {
    repo.remove(id);
    const { clearSession } = require('./session-manager');
    clearSession(`session-${id}`);
    return true;
}

function batchDeleteAccounts(ids) {
    const count = repo.batchDelete(ids);
    const { clearSession } = require('./session-manager');
    for (const id of ids) {
        clearSession(`session-${id}`);
    }
    return count;
}

function setAccountLevel(id, level) {
    const validLevels = ['NEW_ACCOUNT', 'ESTABLISHED_ACCOUNT', 'MATURE_ACCOUNT'];
    if (!validLevels.includes(level)) return false;
    repo.setLevel(id, level);
    return true;
}

function getAccountDailyStats(id) {
    return repo.getDailyStats(id);
}

function getAccountLoginHistory(id, limit = 20) {
    return repo.getLoginHistory(id, limit);
}

function addLoginRecord(accountId, action, detail = null) {
    repo.addLoginHistory(accountId, action, detail);
}

function resetAllDailyCounts() {
    repo.resetDailyCounts();
}

function getSessionDirName(accountId) {
    return `session-${accountId}`;
}

function formatAccount(row) {
    return {
        id: row.id,
        name: row.name,
        phone: row.phone || '',
        level: row.level,
        status: row.status || 'offline',
        dailySent: row.daily_sent || 0,
        dailyLimit: Math.max(row.daily_limit || 30, row.daily_sent || 0),
        totalSent: row.total_sent || 0,
        totalFailed: row.total_failed || 0,
        lastActive: row.last_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

module.exports = {
    createAccount,
    getAccount,
    getAccountByPhone,
    listAccounts,
    searchAccounts,
    updateAccountLastUsed,
    renameAccount,
    updatePhone,
    updateAccountStatus,
    deleteAccount,
    batchDeleteAccounts,
    setAccountLevel,
    getAccountDailyStats,
    getAccountLoginHistory,
    addLoginRecord,
    resetAllDailyCounts,
    getSessionDirName,
};