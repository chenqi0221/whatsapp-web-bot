const {
    getDailyStats,
    setAccountLevel,
} = require('../../services/rate-limiter');
const {
    createAccount,
    listAccounts,
    updateAccountLastUsed,
    renameAccount,
    deleteAccount,
    getAccount,
} = require('../../services/account-store');

function createStatusRoutes(
    app,
    clientRef,
    clientState,
    io,
    logout,
    initClient,
) {
    app.get('/api/status', (req, res) => {
        res.json({ status: clientState.status, qr: clientState.qr });
    });

    app.get('/api/sessions', (req, res) => {
        const sessions = listAccounts();
        res.json({ sessions });
    });

    app.post('/api/connect', async (req, res) => {
        try {
            const { forceNew, clientId, accountName } = req.body || {};

            // 如果要求全新登录且没有 clientId，创建新账号
            let targetClientId = clientId;
            if (forceNew && !targetClientId) {
                const newAccount = createAccount(accountName || '新账号');
                targetClientId = newAccount.id;
            }

            // 如果切换已有账号，更新最后使用时间
            if (targetClientId && !forceNew) {
                updateAccountLastUsed(targetClientId);
            }

            // 重置状态
            clientState.status = 'disconnected';
            clientState.qr = null;

            // 重新初始化客户端
            if (initClient && io) {
                initClient(io, targetClientId, forceNew === true);
                res.json({
                    success: true,
                    message: 'Reinitializing client, please wait for QR code',
                    clientId: targetClientId,
                });
            } else {
                res.json({
                    success: false,
                    error: 'Init function not available',
                });
            }
        } catch (e) {
            console.error('Connect error:', e);
            res.json({ success: false, error: e.message });
        }
    });

    app.post('/api/logout', async (req, res) => {
        try {
            await logout();
            res.json({ success: true, message: 'Logged out successfully' });
        } catch (e) {
            res.json({ success: false, error: e.message });
        }
    });

    app.post('/api/account/rename', (req, res) => {
        const { id, name } = req.body || {};
        if (!id || !name) {
            return res.json({ success: false, error: 'Missing id or name' });
        }
        const success = renameAccount(id, name);
        res.json({ success, sessions: listAccounts() });
    });

    app.post('/api/account/delete', async (req, res) => {
        const { id } = req.body || {};
        if (!id) {
            return res.json({ success: false, error: 'Missing id' });
        }
        // 如果删除的是当前登录的账号，先退出
        if (
            clientRef.currentClientId === id &&
            clientState.status === 'ready'
        ) {
            if (logout) await logout();
        }
        const success = deleteAccount(id);
        res.json({ success, sessions: listAccounts() });
    });

    app.post('/api/account/save', (req, res) => {
        const { clientId, name } = req.body || {};
        if (!clientId || !name) {
            return res.json({
                success: false,
                error: 'Missing clientId or name',
            });
        }

        // 检查是否已存在
        const existing = getAccount(clientId);
        if (existing) {
            // 已存在，更新名称
            renameAccount(clientId, name);
            return res.json({
                success: true,
                message: 'Account renamed',
                sessions: listAccounts(),
            });
        }

        // 创建新账号记录
        const account = createAccount(name);
        res.json({ success: true, account, sessions: listAccounts() });
    });

    app.get('/api/daily-stats', (req, res) => {
        res.json(getDailyStats());
    });

    app.post('/api/set-account-level', (req, res) => {
        const { level } = req.body;
        setAccountLevel(level);
        res.json({ success: true, level });
    });

    if (io) {
        io.on('connection', (socket) => {
            socket.emit('status', {
                status: clientState.status,
                qr: clientState.qr,
            });
        });
    }
}

module.exports = { createStatusRoutes };
