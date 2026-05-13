const fs = require('fs');
const path = require('path');
const config = require('../config/default');

const ACCOUNTS_FILE = 'accounts.json';

function getAccountsFilePath() {
    return path.resolve(config.whatsapp.authPath, ACCOUNTS_FILE);
}

function ensureAuthPath() {
    const authPath = path.resolve(config.whatsapp.authPath);
    if (!fs.existsSync(authPath)) {
        fs.mkdirSync(authPath, { recursive: true });
    }
}

function loadAccounts() {
    ensureAuthPath();
    const filePath = getAccountsFilePath();
    if (!fs.existsSync(filePath)) {
        return {};
    }
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error('Error loading accounts:', e.message);
        return {};
    }
}

function saveAccounts(accounts) {
    ensureAuthPath();
    const filePath = getAccountsFilePath();
    try {
        fs.writeFileSync(filePath, JSON.stringify(accounts, null, 2), 'utf8');
    } catch (e) {
        console.error('Error saving accounts:', e.message);
    }
}

function generateAccountId() {
    return (
        'acc_' +
        Date.now().toString(36) +
        '_' +
        Math.random().toString(36).substr(2, 5)
    );
}

function createAccount(name) {
    const accounts = loadAccounts();
    const id = generateAccountId();
    const now = new Date().toISOString();
    accounts[id] = {
        id,
        name: name || '未命名账号',
        createdAt: now,
        lastUsed: now,
    };
    saveAccounts(accounts);
    return accounts[id];
}

function getAccount(id) {
    const accounts = loadAccounts();
    return accounts[id] || null;
}

function listAccounts() {
    const accounts = loadAccounts();
    return Object.values(accounts).sort(
        (a, b) => new Date(b.lastUsed) - new Date(a.lastUsed),
    );
}

function updateAccountLastUsed(id) {
    const accounts = loadAccounts();
    if (accounts[id]) {
        accounts[id].lastUsed = new Date().toISOString();
        saveAccounts(accounts);
    }
}

function renameAccount(id, newName) {
    const accounts = loadAccounts();
    if (accounts[id]) {
        accounts[id].name = newName || accounts[id].name;
        saveAccounts(accounts);
        return true;
    }
    return false;
}

function deleteAccount(id) {
    const accounts = loadAccounts();
    if (accounts[id]) {
        delete accounts[id];
        saveAccounts(accounts);

        // 同时删除对应的 session 目录
        const { clearSession } = require('./session-manager');
        clearSession(`session-${id}`);
        return true;
    }
    return false;
}

function getSessionDirName(accountId) {
    return `session-${accountId}`;
}

module.exports = {
    createAccount,
    getAccount,
    listAccounts,
    updateAccountLastUsed,
    renameAccount,
    deleteAccount,
    getSessionDirName,
};
