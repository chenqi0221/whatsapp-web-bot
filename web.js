const { Client, LocalAuth } = require('./index');
const config = require('./config/default');
const { createApp } = require('./src/server/app');
const { injectAntiDetectionScripts } = require('./src/services/anti-detection');

let client = null;
const clientState = {
    status: 'disconnected',
    qr: null,
};

const clientConfig = {
    authStrategy: new LocalAuth({ dataPath: config.whatsapp.authPath }),
    puppeteer: {
        headless: config.whatsapp.headless,
        args: config.whatsapp.puppeteerArgs,
        timeout: config.whatsapp.timeout,
    },
};

let io = null;
let initRetryCount = 0;
const MAX_RETRY = 3;

function initClient(socketIo) {
    io = socketIo;
    if (client) {
        try {
            client.destroy();
        } catch (e) {
            // ignore
        }
        client = null;
    }

    client = new Client(clientConfig);

    client.on('qr', (qr) => {
        clientState.qr = qr;
        clientState.status = 'qr';
        initRetryCount = 0;
        console.log('QR code received');
        if (io) io.emit('status', { status: 'qr', qr: clientState.qr });
    });

    client.on('authenticated', () => {
        clientState.status = 'authenticated';
        initRetryCount = 0;
        console.log('Authenticated');
        if (io) io.emit('status', { status: 'authenticated', qr: null });
    });

    client.on('ready', () => {
        clientState.status = 'ready';
        clientState.qr = null;
        initRetryCount = 0;
        console.log('\n\n===== WhatsApp Ready! =====\n');
        injectAntiDetectionScripts(client);
        if (io) io.emit('status', { status: 'ready', qr: null });
    });

    client.on('auth_failure', (msg) => {
        clientState.status = 'auth_failure';
        console.log('Auth failure:', msg);
        if (io)
            io.emit('status', {
                status: 'auth_failure',
                qr: null,
                error: msg,
            });
    });

    client.on('disconnected', (reason) => {
        clientState.status = 'disconnected';
        console.log('Disconnected:', reason);
        if (io) io.emit('status', { status: 'disconnected', qr: null });
    });

    initializeWithRetry();
}

async function initializeWithRetry() {
    try {
        console.log(
            `Initializing client (attempt ${initRetryCount + 1}/${MAX_RETRY})...`,
        );
        await client.initialize();
        console.log('Client initialization completed');
        initRetryCount = 0;
    } catch (error) {
        console.error('Error initializing client:', error.message);

        if (initRetryCount < MAX_RETRY) {
            initRetryCount++;
            const delay = initRetryCount * 3000;
            console.log(`Retrying in ${delay}ms...`);

            clientState.status = 'retrying';
            if (io)
                io.emit('status', {
                    status: 'retrying',
                    qr: null,
                    message: `初始化失败，${delay / 1000}秒后重试 (${initRetryCount}/${MAX_RETRY})...`,
                });

            setTimeout(() => {
                if (client) {
                    initializeWithRetry();
                }
            }, delay);
        } else {
            console.error('Max retries reached. Giving up.');
            clientState.status = 'auth_failure';
            if (io)
                io.emit('status', {
                    status: 'auth_failure',
                    qr: null,
                    error: '初始化失败次数过多，请检查网络连接或点击"连接 WhatsApp"重试',
                });
        }
    }
}

async function logout() {
    if (client) {
        try {
            await client.destroy();
            console.log('Client destroyed');
        } catch (e) {
            console.error('Error destroying client:', e);
        }
        client = null;
    }

    clientState.status = 'disconnected';
    clientState.qr = null;
    initRetryCount = 0;

    const fs = require('fs');
    const path = require('path');
    const authPath = path.resolve(config.whatsapp.authPath);

    if (fs.existsSync(authPath)) {
        try {
            fs.rmSync(authPath, { recursive: true, force: true });
            console.log('Auth data cleared');
        } catch (e) {
            console.error('Error clearing auth data:', e);
        }
    }

    if (io) {
        io.emit('status', { status: 'disconnected', qr: null });
    }
}

const {
    // eslint-disable-next-line no-unused-vars
    app,
    server,
    io: socketIo,
} = createApp(client, clientState, logout, initClient);

initClient(socketIo);

module.exports = { logout, initClient };

server.listen(config.server.port, () => {
    console.log(
        `Web interface running at http://localhost:${config.server.port}`,
    );
});
