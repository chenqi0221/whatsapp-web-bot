const { Client, LocalAuth } = require('../../index');
const config = require('../../config/default');
const { injectAntiDetectionScripts } = require('./anti-detection');
const { clearSession } = require('./session-manager');
const { getAccount } = require('./account-store');
const puppeteer = require('puppeteer');
const path = require('path');

const clientRef = { client: null, currentClientId: null };
const clientState = {
    status: 'disconnected',
    qr: null,
};

let io = null;
let initRetryCount = 0;
const MAX_RETRY = 3;

// 全局浏览器实例，用于复用
let sharedBrowser = null;

function setIo(socketIo) {
    io = socketIo;
}

function getClientRef() {
    return clientRef;
}

function getClientState() {
    return clientState;
}

async function getSharedBrowser(userDataDir) {
    // 如果已有共享浏览器且在运行，复用它
    if (sharedBrowser) {
        try {
            const isConnected = sharedBrowser.isConnected?.();
            if (isConnected) {
                console.log('Reusing existing browser instance');
                return sharedBrowser;
            }
        } catch (e) {
            console.log('Existing browser disconnected, launching new one');
        }
    }

    // 启动新浏览器
    const puppeteerOpts = {
        headless: config.whatsapp.headless,
        args: config.whatsapp.puppeteerArgs,
        timeout: config.whatsapp.timeout,
        userDataDir: userDataDir,
    };

    const browserArgs = [...(puppeteerOpts.args || [])];
    browserArgs.push('--disable-blink-features=AutomationControlled');

    sharedBrowser = await puppeteer.launch({
        ...puppeteerOpts,
        args: browserArgs,
    });

    console.log('New browser instance launched');

    // 监听浏览器断开连接
    sharedBrowser.on('disconnected', () => {
        console.log('Browser disconnected');
        sharedBrowser = null;
    });

    return sharedBrowser;
}

async function destroyClient(keepBrowser = true) {
    if (clientRef.client) {
        try {
            // 移除所有事件监听器，防止旧事件触发
            clientRef.client.removeAllListeners();
            // 如果 keepBrowser 为 true，只关闭页面不关闭浏览器
            await clientRef.client.destroy(keepBrowser);
            console.log('Client destroyed (keepBrowser:', keepBrowser, ')');
        } catch (e) {
            console.error('Error destroying client:', e.message);
        }
        clientRef.client = null;
    }
}

async function initClient(socketIo, clientId = null, forceNew = false) {
    io = socketIo;

    if (forceNew && clientId) {
        clearSession(`session-${clientId}`);
    }

    const currentClientId = clientId || 'default';

    // 使用固定的 userDataDir，让所有账号共享同一个浏览器 profile
    // 这样切换账号时不会重启浏览器
    const fixedUserDataDir = path.join(
        config.whatsapp.authPath,
        'shared-session',
    );

    // 如果需要全新登录，清除 shared session 中的数据
    if (forceNew) {
        // 清除浏览器数据，强制重新登录
        try {
            const fs = require('fs');
            const sessionPath = path.join(fixedUserDataDir, 'Default');
            if (fs.existsSync(sessionPath)) {
                fs.rmSync(sessionPath, { recursive: true, force: true });
                console.log('Cleared shared session data for fresh login');
            }
        } catch (e) {
            console.error('Error clearing session data:', e.message);
        }
    }

    // 获取或创建共享浏览器实例
    const browser = await getSharedBrowser(fixedUserDataDir);

    // 销毁旧客户端（只关闭页面，不关闭浏览器）
    await destroyClient(true);

    // 创建新的 LocalAuth，但使用固定的 userDataDir
    const authStrategy = new LocalAuth({
        dataPath: config.whatsapp.authPath,
        clientId: 'shared', // 使用固定的 clientId，因为 userDataDir 已经固定了
    });

    // 手动覆盖 authStrategy 的 userDataDir 为固定路径
    authStrategy.userDataDir = fixedUserDataDir;
    authStrategy.clientId = currentClientId; // 但保留原始 clientId 用于其他用途

    const currentClientConfig = {
        authStrategy,
        puppeteer: {
            headless: config.whatsapp.headless,
            args: config.whatsapp.puppeteerArgs,
            timeout: config.whatsapp.timeout,
            // 提供 browserWSEndpoint 让 Client 连接到已有浏览器
            browserWSEndpoint: browser.wsEndpoint(),
        },
    };

    clientRef.client = new Client(currentClientConfig);
    clientRef.currentClientId = currentClientId;

    // 绑定事件
    bindClientEvents(clientRef.client, io, clientState, currentClientId);

    // 开始初始化
    initializeWithRetry();
}

function bindClientEvents(client, ioInstance, state, currentClientId) {
    client.on('qr', (qr) => {
        state.qr = qr;
        state.status = 'qr';
        initRetryCount = 0;
        console.log('QR code received');
        if (ioInstance)
            ioInstance.emit('status', { status: 'qr', qr: state.qr });
    });

    client.on('authenticated', () => {
        state.status = 'authenticated';
        initRetryCount = 0;
        console.log('Authenticated');

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
        initRetryCount = 0;
        console.log('\n\n===== WhatsApp Ready! =====\n');
        injectAntiDetectionScripts(client);
        if (ioInstance)
            ioInstance.emit('status', { status: 'ready', qr: null });
    });

    client.on('auth_failure', (msg) => {
        state.status = 'auth_failure';
        console.log('Auth failure:', msg);
        if (ioInstance)
            ioInstance.emit('status', {
                status: 'auth_failure',
                qr: null,
                error: msg,
            });
    });

    client.on('disconnected', (reason) => {
        state.status = 'disconnected';
        console.log('Disconnected:', reason);
        if (ioInstance)
            ioInstance.emit('status', { status: 'disconnected', qr: null });
    });
}

async function initializeWithRetry() {
    try {
        console.log(
            `Initializing client (attempt ${initRetryCount + 1}/${MAX_RETRY})...`,
        );
        await clientRef.client.initialize();
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
                if (clientRef.client) {
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
    // 完全退出，关闭浏览器
    await destroyClient(false);

    // 关闭共享浏览器
    if (sharedBrowser) {
        try {
            await sharedBrowser.close();
        } catch (e) {
            console.error('Error closing browser:', e.message);
        }
        sharedBrowser = null;
    }

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
