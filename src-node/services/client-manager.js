const { Client, LocalAuth } = require('whatsapp-web.js');
const config = require('../config/default');
const { injectAntiDetectionScripts } = require('./anti-detection');
const { clearSession } = require('./session-manager');
const { getAccount } = require('./account-store');
const puppeteer = require('puppeteer');
const path = require('path');
const logger = require('../utils/logger');

const clientRef = { client: null, currentClientId: null };
const clientState = {
    status: 'disconnected',
    qr: null,
    connectedAt: null,
};

let io = null;
let initRetryCount = 0;
const MAX_RETRY = 3;

// 每个账号独立的浏览器实例
let currentBrowser = null;
let currentAccountId = null;

function setIo(socketIo) {
    io = socketIo;
}

function getClientRef() {
    return clientRef;
}

function getClientState() {
    return clientState;
}

function buildPuppeteerOpts(userDataDir) {
    const args = [...(config.whatsapp.puppeteerArgs || [])];
    args.push('--disable-blink-features=AutomationControlled');
    return {
        headless: config.whatsapp.headless,
        args,
        timeout: config.whatsapp.timeout,
        userDataDir,
    };
}

function clearBrowserLock(userDataDir) {
    try {
        const fs = require('fs');
        const lockFile = path.join(userDataDir, 'SingletonLock');
        if (fs.existsSync(lockFile)) {
            fs.unlinkSync(lockFile);
            logger.info('Removed stale SingletonLock for:', { data: userDataDir });
        }
    } catch (e) {
        logger.error('Error clearing browser lock:', { data: e.message });
    }
}

async function closeCurrentBrowser() {
    if (currentBrowser) {
        try {
            await currentBrowser.close();
            logger.info('Current browser closed for account:', { data: currentAccountId });
        } catch (e) {
            logger.error('Error closing browser:', { data: e.message });
        }
        currentBrowser = null;
        currentAccountId = null;
    }
}

async function getOrCreateBrowser(clientId) {
    const userDataDir = path.join(config.whatsapp.authPath, `session-${clientId}`);

    if (currentBrowser && currentAccountId === clientId) {
        try {
            const isConnected = currentBrowser.isConnected?.();
            if (isConnected) {
                logger.info('Reusing existing browser for account:', { data: clientId });
                return { browser: currentBrowser, userDataDir, wsEndpoint: currentBrowser.wsEndpoint() };
            }
        } catch (e) {
            logger.info('Existing browser disconnected for account:', { data: clientId });
        }
    }

    if (currentBrowser && currentAccountId !== clientId) {
        logger.info('Switching accounts, closing browser for:', { data: [currentAccountId, '->', clientId] });
        await closeCurrentBrowser();
    }

    clearBrowserLock(userDataDir);

    const puppeteerOpts = buildPuppeteerOpts(userDataDir);

    currentBrowser = await puppeteer.launch(puppeteerOpts);
    currentAccountId = clientId;

    logger.info('New browser launched for account:', { data: clientId });

    currentBrowser.on('disconnected', () => {
        logger.info('Browser disconnected for account:', { data: clientId });
        if (currentAccountId === clientId) {
            currentBrowser = null;
            currentAccountId = null;
        }
    });

    return { browser: currentBrowser, userDataDir, wsEndpoint: currentBrowser.wsEndpoint() };
}

async function destroyClient(keepBrowser = true) {
    if (clientRef.client) {
        try {
            clientRef.client.removeAllListeners();
            await clientRef.client.destroy(keepBrowser);
            logger.info('Client destroyed (keepBrowser: true)');
        } catch (e) {
            logger.error('Error destroying client:', { data: e.message });
        }
        clientRef.client = null;
    }
}

async function initClient(socketIo, clientId = null, forceNew = false) {
    io = socketIo;

    const targetClientId = clientId || 'default';

    if (forceNew && targetClientId) {
        clearSession(`session-${targetClientId}`);
    }

    const userDataDir = path.join(config.whatsapp.authPath, `session-${targetClientId}`);

    if (forceNew) {
        try {
            const fs = require('fs');
            const sessionPath = path.join(userDataDir, 'Default');
            if (fs.existsSync(sessionPath)) {
                fs.rmSync(sessionPath, { recursive: true, force: true });
                logger.info('Cleared session data for account:', { data: targetClientId });
            }
        } catch (e) {
            logger.error('Error clearing session data:', { data: e.message });
        }
    }

    const { browser, wsEndpoint } = await getOrCreateBrowser(targetClientId);

    await destroyClient(true);

    const authStrategy = new LocalAuth({
        dataPath: config.whatsapp.authPath,
        clientId: targetClientId,
    });

    authStrategy.userDataDir = userDataDir;

    const currentClientConfig = {
        authStrategy,
        puppeteer: {
            headless: config.whatsapp.headless,
            args: config.whatsapp.puppeteerArgs,
            timeout: config.whatsapp.timeout,
            browserWSEndpoint: wsEndpoint,
        },
    };

    clientRef.client = new Client(currentClientConfig);
    clientRef.currentClientId = targetClientId;

    bindClientEvents(clientRef.client, io, clientState, targetClientId);

    initializeWithRetry();
}

function bindClientEvents(client, ioInstance, state, currentClientId) {
    client.on('qr', (qr) => {
        state.qr = qr;
        state.status = 'qr';
        initRetryCount = 0;
        logger.info('QR code received');
        if (ioInstance)
            ioInstance.emit('status', { status: 'qr', qr: state.qr });
    });

    client.on('authenticated', () => {
        state.status = 'authenticated';
        initRetryCount = 0;
        logger.info('Authenticated');

        // 检查是否是新账号（没有对应的 account-store 记录）
        const account = getAccount(currentClientId);
        if (!account && currentClientId !== 'default') {
            // 这是新账号，通知前端保存
            if (ioInstance) {
                ioInstance.emit('new_account_detected', {
                    clientId: currentClientId,
                    message: '检测到新登录的账号，请为此账号命名以便保存',
                });
            }
        }

        if (ioInstance)
            ioInstance.emit('status', { status: 'authenticated', qr: null });
    });

    client.on('ready', () => {
        state.status = 'ready';
        state.qr = null;
        state.connectedAt = Date.now();
        initRetryCount = 0;
        logger.info('\n\n===== WhatsApp Ready! =====\n');
        injectAntiDetectionScripts(client);
        if (ioInstance)
            ioInstance.emit('status', { status: 'ready', qr: null });
    });

    client.on('auth_failure', (msg) => {
        state.status = 'auth_failure';
        logger.info('Auth failure:', { data: msg });
        if (ioInstance)
            ioInstance.emit('status', {
                status: 'auth_failure',
                qr: null,
                error: msg,
            });
    });

    client.on('disconnected', (reason) => {
        state.status = 'disconnected';
        state.connectedAt = null;
        logger.info('Disconnected:', { data: reason });
        if (ioInstance)
            ioInstance.emit('status', { status: 'disconnected', qr: null });
    });
}

async function initializeWithRetry() {
    try {
        logger.info(
            `Initializing client (attempt ${initRetryCount + 1}/${MAX_RETRY})...`,
        );
        await clientRef.client.initialize();
        logger.info('Client initialization completed');
        initRetryCount = 0;
    } catch (error) {
        logger.error('Error initializing client:', { data: error.message });

        if (initRetryCount < MAX_RETRY) {
            initRetryCount++;
            const delay = initRetryCount * 3000;
            logger.info(`Retrying in ${delay}ms...`);

            clientState.status = 'retrying';
            if (io)
                io.emit('status', {
                    status: 'retrying',
                    qr: null,
                    message: `初始化失败，${delay / 1000}秒后重试 (${initRetryCount}/${MAX_RETRY})...`,
                });

            setTimeout(() => {
                if (clientRef.client) {
                    initializeWithRetry();
                }
            }, delay);
        } else {
            logger.error('Max retries reached. Giving up.');
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
    await destroyClient(true);
    await closeCurrentBrowser();

    clientState.status = 'disconnected';
    clientState.qr = null;
    initRetryCount = 0;

    if (io) {
        io.emit('status', { status: 'disconnected', qr: null });
    }
}

module.exports = {
    initClient,
    logout,
    destroyClient,
    getClientRef,
    getClientState,
    setIo,
};