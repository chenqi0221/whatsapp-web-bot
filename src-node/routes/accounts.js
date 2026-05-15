const {
    listAccounts,
    searchAccounts,
    getAccount,
    getAccountByPhone,
    createAccount,
    renameAccount,
    updatePhone,
    updateAccountStatus,
    deleteAccount,
    batchDeleteAccounts,
    setAccountLevel,
    getAccountDailyStats,
    getAccountLoginHistory,
    addLoginRecord,
} = require('../services/account-store');
const logger = require('../utils/logger');

function createAccountRoutes(app, clientRef, clientState, logout) {

    app.get('/api/accounts', (_req, res) => {
        const accounts = listAccounts();
        res.json({ success: true, accounts, total: accounts.length });
    });

    app.get('/api/accounts/search', (req, res) => {
        const { q } = req.query;
        if (!q) {
            return res.json({ success: false, error: 'Missing search query' });
        }
        const accounts = searchAccounts(q);
        res.json({ success: true, accounts, total: accounts.length });
    });

    app.get('/api/accounts/:id', (req, res) => {
        const account = getAccount(req.params.id);
        if (!account) {
            return res.status(404).json({ success: false, error: 'Account not found' });
        }

        const stats = getAccountDailyStats(req.params.id);
        const history = getAccountLoginHistory(req.params.id, 10);

        res.json({
            success: true,
            account,
            stats,
            loginHistory: history,
        });
    });

    app.get('/api/accounts/:id/stats', (req, res) => {
        const stats = getAccountDailyStats(req.params.id);
        if (!stats) {
            return res.status(404).json({ success: false, error: 'Account not found' });
        }
        res.json({ success: true, stats });
    });

    app.get('/api/accounts/:id/history', (req, res) => {
        const limit = parseInt(req.query.limit, 10) || 20;
        const history = getAccountLoginHistory(req.params.id, limit);
        res.json({ success: true, history });
    });

    app.post('/api/accounts', (req, res) => {
        const { name, phone } = req.body || {};
        if (!name) {
            return res.json({ success: false, error: 'Missing account name' });
        }
        const account = createAccount(name, phone || null);
        res.json({ success: true, account, accounts: listAccounts() });
    });

    app.put('/api/accounts/:id', (req, res) => {
        const { name, phone, level } = req.body || {};
        const account = getAccount(req.params.id);
        if (!account) {
            return res.status(404).json({ success: false, error: 'Account not found' });
        }

        if (name) renameAccount(req.params.id, name);
        if (phone !== undefined) updatePhone(req.params.id, phone);
        if (level) {
            if (!setAccountLevel(req.params.id, level)) {
                return res.json({ success: false, error: 'Invalid level' });
            }
        }

        const updated = getAccount(req.params.id);
        res.json({ success: true, account: updated });
    });

    app.put('/api/accounts/:id/level', (req, res) => {
        const { level } = req.body || {};
        if (!level) {
            return res.json({ success: false, error: 'Missing level' });
        }
        const ok = setAccountLevel(req.params.id, level);
        if (!ok) {
            return res.json({ success: false, error: 'Invalid level. Use NEW_ACCOUNT, ESTABLISHED_ACCOUNT, or MATURE_ACCOUNT' });
        }
        const account = getAccount(req.params.id);
        res.json({ success: true, account });
    });

    app.put('/api/accounts/:id/status', (req, res) => {
        const { status } = req.body || {};
        if (!status) {
            return res.json({ success: false, error: 'Missing status' });
        }
        updateAccountStatus(req.params.id, status);
        res.json({ success: true, status });
    });

    app.delete('/api/accounts/:id', async (req, res) => {
        const account = getAccount(req.params.id);
        if (!account) {
            return res.status(404).json({ success: false, error: 'Account not found' });
        }

        if (clientRef.currentClientId === req.params.id && clientState.status === 'ready') {
            if (logout) await logout();
        }

        deleteAccount(req.params.id);
        res.json({ success: true, accounts: listAccounts() });
    });

    app.post('/api/accounts/batch-delete', async (req, res) => {
        const { ids } = req.body || {};
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.json({ success: false, error: 'Missing or invalid ids array' });
        }

        for (const id of ids) {
            if (clientRef.currentClientId === id && clientState.status === 'ready') {
                if (logout) await logout();
            }
        }

        const count = batchDeleteAccounts(ids);
        res.json({ success: true, deleted: count, accounts: listAccounts() });
    });

    app.post('/api/accounts/:id/login', (req, res) => {
        const { action, detail } = req.body || {};
        addLoginRecord(req.params.id, action || 'login', detail || null);
        res.json({ success: true });
    });
}

module.exports = { createAccountRoutes };