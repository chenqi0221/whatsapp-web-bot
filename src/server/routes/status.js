const {
    getDailyStats,
    setAccountLevel,
} = require('../../services/rate-limiter');

function createStatusRoutes(app, client, clientStatus, qrCode, io) {
    app.get('/api/status', (req, res) => {
        res.json({ status: clientStatus, qr: qrCode });
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
            socket.emit('status', { status: clientStatus, qr: qrCode });
        });
    }
}

module.exports = { createStatusRoutes };
