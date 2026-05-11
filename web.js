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

function initClient() {
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
    });

    client.on('authenticated', () => {
        clientStatus = 'authenticated';
        console.log('Authenticated');
    });

    client.on('ready', () => {
        clientStatus = 'ready';
        qrCode = null;
        console.log('\n\n===== WhatsApp Ready! =====\n');
        injectAntiDetectionScripts(client);
    });

    client.on('auth_failure', (msg) => {
        clientStatus = 'auth_failure';
        console.log('Auth failure:', msg);
    });

    client.on('disconnected', (reason) => {
        clientStatus = 'disconnected';
        console.log('Disconnected:', reason);
    });

    client
        .initialize()
        .then(() => {
            console.log('Client initialization completed');
        })
        .catch((error) => {
            console.error('Error initializing client:', error);
            clientStatus = 'auth_failure';
        });
}

initClient();

// eslint-disable-next-line no-unused-vars
const { app, server } = createApp(client, clientStatus, qrCode);

server.listen(config.server.port, () => {
    console.log(
        `Web interface running at http://localhost:${config.server.port}`,
    );
});
