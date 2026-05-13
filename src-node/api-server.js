const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const { createStatusRoutes } = require('./routes/status');
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

async function startApiServer(port) {
    const app = express();
    const server = http.createServer(app);
    const io = new Server(server, {
        cors: { origin: '*' }
    });

    app.use(cors());
    app.use(express.json({ limit: '50mb' }));

    const clientRef = getClientRef();
    const clientState = getClientState();

    // 注册所有路由
    createStatusRoutes(app, clientRef, clientState, io, logout, initClient);
    createContactsRoutes(app, clientRef, clientState);
    createBroadcastRoutes(app, clientRef, clientState, io);
    createAutoReplyRoutes(app, clientRef, clientState);
    createScheduleRoutes(app, clientRef, clientState);
    createGroupRoutes(app, clientRef, clientState);
    createChatManageRoutes(app, clientRef, clientState);
    createMediaRoutes(app, clientRef, clientState);
    createExtrasRoutes(app, clientRef, clientState);

    return new Promise((resolve, reject) => {
        server.listen(port, () => {
            resolve(server);
        });
        server.on('error', reject);
    });
}

module.exports = { startApiServer };
