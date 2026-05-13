const config = require('./config/default');
const { createApp } = require('./src/server/app');
const {
    initClient,
    logout,
    getClientRef,
    getClientState,
} = require('./src/services/client-manager');
const { listSavedSessions } = require('./src/services/session-manager');

const clientRef = getClientRef();
const clientState = getClientState();

const {
    // eslint-disable-next-line no-unused-vars
    app,
    server,
    io: socketIo,
} = createApp(clientRef, clientState, logout, initClient);

// 启动时不自动清理所有 session
initClient(socketIo);

module.exports = { logout, initClient, listSavedSessions, clientRef };

server.listen(config.server.port, () => {
    console.log(
        `Web interface running at http://localhost:${config.server.port}`,
    );
});
