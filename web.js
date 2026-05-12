const { Client, LocalAuth } = require('./index');
const config = require('./config/default');
const { createApp } = require('./src/server/app');
const { injectAntiDetectionScripts } = require('./src/services/anti-detection');

let client = null;
let clientStatus = 'disconnected';
let qrCode = null;

const clientConfig = {
    authStrategy: new LocalAuth({ dataPath: config.whatsapp.authPath }),
    puppeteer: {
        headless: config.whatsapp.headless,
        args: config.whatsapp.puppeteerArgs,
        timeout: config.whatsapp.timeout,
    },
};

let io = null;

function initClient(socketIo) {
    io = socketIo;
    if (client) {
        try {
            client.destroy();
        } catch (e) {
            // ignore
        }
    }

    client = new Client(clientConfig);

    client.on('qr', (qr) => {
        qrCode = qr;
        clientStatus = 'qr';
        console.log('QR code received');
        if (io) io.emit('status', { status: 'qr', qr: qrCode });
    });

    client.on('authenticated', () => {
        clientStatus = 'authenticated';
        console.log('Authenticated');
        if (io) io.emit('status', { status: 'authenticated', qr: null });
    });

    client.on('ready', () => {
        clientStatus = 'ready';
        qrCode = null;
        console.log('\n\n===== WhatsApp Ready! =====\n');
        injectAntiDetectionScripts(client);
        if (io) io.emit('status', { status: 'ready', qr: null });
    });

    client.on('auth_failure', (msg) => {
        clientStatus = 'auth_failure';
        console.log('Auth failure:', msg);
        if (io)
            io.emit('status', { status: 'auth_failure', qr: null, error: msg });
    });

    client.on('disconnected', (reason) => {
        clientStatus = 'disconnected';
        console.log('Disconnected:', reason);
        if (io) io.emit('status', { status: 'disconnected', qr: null });
    });

    client
        .initialize()
        .then(() => {
            console.log('Client initialization completed');
        })
        .catch((error) => {
            console.error('Error initializing client:', error);
            clientStatus = 'auth_failure';
            if (io)
                io.emit('status', {
                    status: 'auth_failure',
                    qr: null,
                    error: error.message,
                });
        });
}

// eslint-disable-next-line no-unused-vars
const { app, server, io: socketIo } = createApp(client, clientStatus, qrCode);

initClient(socketIo);

server.listen(config.server.port, () => {
    console.log(
        `Web interface running at http://localhost:${config.server.port}`,
    );
});
