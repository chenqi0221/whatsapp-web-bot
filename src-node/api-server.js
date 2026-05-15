const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');

const { createStatusRoutes } = require('./routes/status');
const { createAccountRoutes } = require('./routes/accounts');
const { createContactsRoutes } = require('./routes/contacts');
const { createBroadcastRoutes } = require('./routes/broadcast');
const { createAutoReplyRoutes } = require('./routes/autoreply');
const { createScheduleRoutes } = require('./routes/schedule');
const { createGroupRoutes } = require('./routes/groups');
const { createChatManageRoutes } = require('./routes/chatmanage');
const { createMediaRoutes } = require('./routes/media');
const { createExtrasRoutes } = require('./routes/extras');
const { getClientRef, getClientState } = require('./services/client-manager');
const { logout, initClient } = require('./services/client-manager');

const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests, please try again later.' },
});

function jsonResponse(res, statusCode, data) {
    return res.status(statusCode).json({
        success: statusCode < 400,
        ...data,
        timestamp: new Date().toISOString(),
    });
}

function errorHandler(err, req, res, _next) {
    const statusCode = err.statusCode || 500;
    const message = err.expose ? err.message : 'Internal Server Error';

    logger.error(`[${req.method}] ${req.path} - ${message}`, {
        error: err.message,
        stack: err.stack,
        statusCode,
    });

    jsonResponse(res, statusCode, { error: message });
}

async function startApiServer(port) {
    const app = express();
    const server = http.createServer(app);

    app.use(cors({
        origin: ['http://localhost:1420', 'http://127.0.0.1:1420', 'http://localhost:5173', 'tauri://localhost'],
        credentials: true,
    }));

    app.use('/api/', apiLimiter);
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    app.get('/health', (_req, res) => {
        jsonResponse(res, 200, { status: 'ok', uptime: process.uptime() });
    });

    const io = new Server(server, {
        cors: {
            origin: ['http://localhost:1420', 'http://127.0.0.1:1420', 'http://localhost:5173', 'tauri://localhost'],
            methods: ['GET', 'POST'],
        },
    });

    const clientRef = getClientRef();
    const clientState = getClientState();

    createStatusRoutes(app, clientRef, clientState, io, logout, initClient);
    createAccountRoutes(app, clientRef, clientState, logout);
    createContactsRoutes(app, clientRef, clientState);
    createBroadcastRoutes(app, clientRef, clientState, io);
    createAutoReplyRoutes(app, clientRef, clientState);
    createScheduleRoutes(app, clientRef, clientState);
    createGroupRoutes(app, clientRef, clientState);
    createChatManageRoutes(app, clientRef, clientState);
    createMediaRoutes(app, clientRef, clientState);
    createExtrasRoutes(app, clientRef, clientState);

    app.use(errorHandler);

    return new Promise((resolve, reject) => {
        server.listen(port, '127.0.0.1', () => {
            logger.info(`Secure API server listening on http://127.0.0.1:${port}`);
            resolve(server);
        });
        server.on('error', reject);
    });
}

module.exports = { startApiServer, jsonResponse };