const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client, LocalAuth, MessageMedia } = require('./index');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

let client = null;
let clientStatus = 'disconnected';
let qrCode = null;
let broadcastProgress = { running: false, current: 0, total: 0, results: [] };

let contactTestLoop = {
    running: false,
    attempts: 0,
    maxAttempts: 100,
    interval: 3000,
    lastResult: null,
    stopOnSuccess: true,
};

let autoReplyRules = [];
let scheduledTasks = [];

// ========== 防限制统计和控制 ==========
let dailySendStats = {
    date: new Date().toDateString(),
    sent: 0,
    failed: 0,
    paused: 0,
};

// 安全阈值配置（基于社区测试数据）
const SAFE_LIMITS = {
    NEW_ACCOUNT: {
        // 注册 < 30 天
        dailyMax: 30, // 每天最多 30 条
        hourlyMax: 5, // 每小时最多 5 条
        minInterval: 60000, // 最小间隔 60 秒
        batchSize: 5, // 每批 5 条
        batchPause: 180000, // 每批后暂停 3 分钟
    },
    ESTABLISHED_ACCOUNT: {
        // 注册 30-90 天
        dailyMax: 80,
        hourlyMax: 10,
        minInterval: 30000, // 最小间隔 30 秒
        batchSize: 10,
        batchPause: 120000, // 2 分钟
    },
    MATURE_ACCOUNT: {
        // 注册 > 90 天
        dailyMax: 150,
        hourlyMax: 20,
        minInterval: 20000, // 最小间隔 20 秒
        batchSize: 15,
        batchPause: 60000, // 1 分钟
    },
};

// 当前使用的限制级别（可动态调整）
let currentLimitLevel = SAFE_LIMITS.NEW_ACCOUNT;

// 重置每日统计（每天自动调用）
function resetDailyStatsIfNewDay() {
    const today = new Date().toDateString();
    if (dailySendStats.date !== today) {
        console.log('New day detected, resetting daily stats...');
        dailySendStats = {
            date: today,
            sent: 0,
            failed: 0,
            paused: 0,
        };
    }
}

// 检查是否可以发送
function canSend() {
    resetDailyStatsIfNewDay();

    const limit = currentLimitLevel;

    // 检查每日上限
    if (dailySendStats.sent >= limit.dailyMax) {
        console.log(
            `Daily limit reached (${limit.dailyMax}). Waiting for next day.`,
        );
        return { allowed: false, reason: 'daily_limit', remaining: 0 };
    }

    // 检查每日剩余配额
    const remaining = limit.dailyMax - dailySendStats.sent;

    return {
        allowed: true,
        remaining: remaining,
        dailyMax: limit.dailyMax,
        sent: dailySendStats.sent,
    };
}

// 记录发送成功
function recordSend(success = true) {
    resetDailyStatsIfNewDay();
    if (success) {
        dailySendStats.sent++;
    } else {
        dailySendStats.failed++;
    }
}

// 获取当前统计
function getDailyStats() {
    resetDailyStatsIfNewDay();
    return { ...dailySendStats, limit: currentLimitLevel };
}

// 设置账户级别（根据账号年龄）
function setAccountLevel(level) {
    if (level === 'new') {
        currentLimitLevel = SAFE_LIMITS.NEW_ACCOUNT;
    } else if (level === 'established') {
        currentLimitLevel = SAFE_LIMITS.ESTABLISHED_ACCOUNT;
    } else if (level === 'mature') {
        currentLimitLevel = SAFE_LIMITS.MATURE_ACCOUNT;
    }
    console.log(
        `Account level set to: ${level}, daily max: ${currentLimitLevel.dailyMax}`,
    );
}

const clientConfig = {
    authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth_v2' }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-blink-features=AutomationControlled',
            '--lang=en-US,en',
            '--window-size=1920,1080',
        ],
        timeout: 120000,
    },
};

// ========== 人类行为模拟函数 ==========

/**
 * 模拟人类打字 - 在WhatsApp Web输入框中逐字输入
 * @param {object} page - Puppeteer page对象
 * @param {string} text - 要输入的文本
 * @param {object} options - 配置选项
 */
async function simulateHumanTyping(page, text, options = {}) {
    if (!page || !text) return;

    const {
        minDelay = 50, // 最小按键延迟(ms)
        maxDelay = 200, // 最大按键延迟(ms)
        typoChance = 0.03, // 打错字概率 3%
        pauseChance = 0.15, // 暂停概率 15%
        pauseMin = 300, // 最短暂停(ms)
        pauseMax = 800, // 最长暂停(ms)
    } = options;

    console.log(`Simulating human typing (${text.length} chars)...`);

    // 聚焦到输入框 - WhatsApp Web的文本输入区域
    try {
        // 尝试找到输入框并聚焦
        await page.evaluate(() => {
            const input =
                document.querySelector(
                    'div[contenteditable="true"][data-tab="1"]',
                ) ||
                document.querySelector('div[contenteditable="true"]') ||
                document.querySelector(
                    '[data-testid="conversation-compose-box-input"]',
                );
            if (input) {
                input.focus();
                input.click();
            }
        });

        await new Promise((r) => setTimeout(r, 100 + Math.random() * 200));

        // 清空现有内容
        await page.keyboard.press('Control+a');
        await new Promise((r) => setTimeout(r, 50 + Math.random() * 100));
        await page.keyboard.press('Delete');
        await new Promise((r) => setTimeout(r, 50 + Math.random() * 100));

        // 逐字输入
        for (let i = 0; i < text.length; i++) {
            const char = text[i];

            // 随机暂停（模拟思考）
            if (Math.random() < pauseChance && i > 0 && i < text.length - 1) {
                const pauseTime =
                    pauseMin + Math.random() * (pauseMax - pauseMin);
                console.log(`Typing pause: ${Math.round(pauseTime)}ms`);
                await new Promise((r) => setTimeout(r, pauseTime));
            }

            // 模拟打错字（3%概率）
            if (Math.random() < typoChance && /[a-zA-Z]/.test(char)) {
                const nearbyKeys = {
                    a: 's',
                    s: 'a',
                    d: 's',
                    f: 'd',
                    g: 'f',
                    h: 'g',
                    j: 'h',
                    k: 'j',
                    l: 'k',
                    q: 'w',
                    w: 'q',
                    e: 'w',
                    r: 'e',
                    t: 'r',
                    y: 't',
                    u: 'y',
                    i: 'u',
                    o: 'i',
                    p: 'o',
                };
                const typoChar = nearbyKeys[char.toLowerCase()];
                if (typoChar) {
                    // 输入错误字符
                    await page.keyboard.type(typoChar, {
                        delay: minDelay + Math.random() * (maxDelay - minDelay),
                    });
                    await new Promise((r) =>
                        setTimeout(r, 100 + Math.random() * 200),
                    );
                    // 删除错误字符
                    await page.keyboard.press('Backspace');
                    await new Promise((r) =>
                        setTimeout(r, 80 + Math.random() * 150),
                    );
                }
            }

            // 输入当前字符
            const delay = minDelay + Math.random() * (maxDelay - minDelay);
            await page.keyboard.type(char, { delay });
        }

        console.log('Human typing simulation complete');
    } catch (e) {
        console.error('Error during human typing simulation:', e.message);
    }
}

/**
 * 模拟人类鼠标移动 - 使用贝塞尔曲线
 * @param {object} page - Puppeteer page对象
 * @param {number} targetX - 目标X坐标
 * @param {number} targetY - 目标Y坐标
 */
async function simulateHumanMouseMove(page, targetX, targetY) {
    if (!page) return;

    try {
        // 获取当前鼠标位置
        const currentPos = await page.evaluate(() => ({
            x: window.mouseX || 0,
            y: window.mouseY || 0,
        }));

        const startX = currentPos.x || Math.random() * 500;
        const startY = currentPos.y || Math.random() * 500;

        // 贝塞尔曲线控制点（添加随机偏移模拟人类不精确性）
        const cp1x =
            startX + (targetX - startX) * 0.3 + (Math.random() - 0.5) * 100;
        const cp1y =
            startY + (targetY - startY) * 0.3 + (Math.random() - 0.5) * 100;
        const cp2x =
            startX + (targetX - startX) * 0.7 + (Math.random() - 0.5) * 100;
        const cp2y =
            startY + (targetY - startY) * 0.7 + (Math.random() - 0.5) * 100;

        const steps = 15 + Math.floor(Math.random() * 20); // 15-35步

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            // 三次贝塞尔曲线
            const x =
                Math.pow(1 - t, 3) * startX +
                3 * Math.pow(1 - t, 2) * t * cp1x +
                3 * (1 - t) * Math.pow(t, 2) * cp2x +
                Math.pow(t, 3) * targetX;
            const y =
                Math.pow(1 - t, 3) * startY +
                3 * Math.pow(1 - t, 2) * t * cp1y +
                3 * (1 - t) * Math.pow(t, 2) * cp2y +
                Math.pow(t, 3) * targetY;

            await page.mouse.move(x, y);
            await new Promise((r) => setTimeout(r, 3 + Math.random() * 8));
        }
    } catch (e) {
        console.error('Error during mouse move simulation:', e.message);
    }
}

/**
 * 模拟人类滚动行为
 * @param {object} page - Puppeteer page对象
 */
async function simulateHumanScroll(page) {
    if (!page) return;

    try {
        const scrollAmount = 100 + Math.floor(Math.random() * 300);
        const direction = Math.random() < 0.7 ? -1 : 1; // 70%向上滚动

        await page.evaluate(
            (amount, dir) => {
                window.scrollBy({
                    top: amount * dir,
                    behavior: 'smooth',
                });
            },
            scrollAmount,
            direction,
        );

        await new Promise((r) => setTimeout(r, 200 + Math.random() * 500));
    } catch (e) {
        console.error('Error during scroll simulation:', e.message);
    }
}

/**
 * 模拟发送前的完整人类行为链
 * @param {object} client - WhatsApp client实例
 * @param {string} chatId - 聊天ID
 * @param {string} message - 消息内容
 * @param {boolean} enableTyping - 是否启用打字模拟
 */
async function simulatePreSendBehavior(
    client,
    chatId,
    message,
    enableTyping = true,
) {
    if (!client || !client.pupPage) return;
    const page = client.pupPage;

    try {
        console.log('Starting pre-send human behavior simulation...');

        // 1. 随机鼠标移动（模拟浏览）
        if (Math.random() < 0.4) {
            const viewport = await page.viewport();
            if (viewport) {
                await simulateHumanMouseMove(
                    page,
                    Math.random() * viewport.width,
                    Math.random() * viewport.height,
                );
                await new Promise((r) =>
                    setTimeout(r, 100 + Math.random() * 300),
                );
            }
        }

        // 2. 打开聊天窗口
        await client.interface.openChatWindow(chatId);
        await new Promise((r) => setTimeout(r, 300 + Math.random() * 500));

        // 3. 随机滚动（模拟阅读历史消息）
        if (Math.random() < 0.3) {
            await simulateHumanScroll(page);
        }

        // 4. 模拟打字（如果启用且消息较长）
        if (enableTyping && message && message.length > 5) {
            await simulateHumanTyping(page, message);
        }

        // 5. 发送前短暂停顿（模拟检查消息）
        await new Promise((r) => setTimeout(r, 200 + Math.random() * 600));

        console.log('Pre-send behavior simulation complete');
    } catch (e) {
        console.error('Error in pre-send behavior simulation:', e.message);
    }
}

/**
 * 注入反检测脚本 - 覆盖浏览器指纹特征
 */
async function injectAntiDetectionScripts() {
    if (!client || !client.pupPage) return;

    try {
        console.log('Injecting anti-detection scripts...');

        await client.pupPage.evaluateOnNewDocument(() => {
            // 1. 移除 webdriver 标志
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
                configurable: true,
            });

            // 2. 模拟真实插件列表
            Object.defineProperty(navigator, 'plugins', {
                get: () => [
                    {
                        name: 'Chrome PDF Viewer',
                        filename: 'internal-pdf-viewer',
                        description: 'Portable Document Format',
                    },
                    {
                        name: 'Chromium PDF Viewer',
                        filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
                        description: 'Portable Document Format',
                    },
                    {
                        name: 'Native Client',
                        filename: 'internal-nacl-plugin',
                        description: 'Native Client module',
                    },
                ],
                configurable: true,
            });

            // 3. 覆盖语言设置
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en'],
                configurable: true,
            });

            // 4. 伪装硬件并发数
            Object.defineProperty(navigator, 'hardwareConcurrency', {
                get: () => 4,
                configurable: true,
            });

            // 5. 伪装设备内存
            Object.defineProperty(navigator, 'deviceMemory', {
                get: () => 8,
                configurable: true,
            });

            // 6. 覆盖 Chrome 对象
            if (!window.chrome) {
                window.chrome = {
                    runtime: {},
                    app: { isInstalled: false },
                };
            }

            // 7. 删除 automation 标志
            delete navigator.__proto__.webdriver;

            // 8. 模拟 notification 权限
            if (window.Notification) {
                Object.defineProperty(Notification, 'permission', {
                    get: () => 'default',
                    configurable: true,
                });
            }

            // 9. 覆盖 permissions API
            if (navigator.permissions) {
                const originalQuery = navigator.permissions.query;
                navigator.permissions.query = function (parameters) {
                    if (parameters.name === 'notifications') {
                        return Promise.resolve({
                            state: 'default',
                            onchange: null,
                        });
                    }
                    return originalQuery.call(this, parameters);
                };
            }

            // 10. 模拟鼠标位置追踪
            window.mouseX = 0;
            window.mouseY = 0;
            document.addEventListener('mousemove', (e) => {
                window.mouseX = e.clientX;
                window.mouseY = e.clientY;
            });
        });

        console.log('Anti-detection scripts injected successfully');
    } catch (e) {
        console.error('Failed to inject anti-detection scripts:', e.message);
    }
}

function initClient() {
    if (client) {
        try {
            client.destroy();
            // eslint-disable-next-line no-empty
        } catch (e) {}
    }

    client = new Client(clientConfig);

    client.on('qr', (qr) => {
        qrCode = qr;
        clientStatus = 'qr';
        io.emit('status', { status: 'qr', qr });
        console.log('QR code received');
    });

    client.on('loading_screen', (percent, message) => {
        console.log(`Loading: ${percent}% - ${message}`);
    });

    client.on('authenticated', () => {
        clientStatus = 'authenticated';
        io.emit('status', { status: 'authenticated' });
        console.log('Authenticated');
    });

    client.on('ready', () => {
        clientStatus = 'ready';
        qrCode = null;
        io.emit('status', { status: 'ready' });
        startScheduledTasks();
        console.log('\n\n===== WhatsApp Ready! =====\n');

        // 页面加载完成后注入反检测脚本
        injectAntiDetectionScripts();
    });

    client.on('auth_failure', (msg) => {
        clientStatus = 'auth_failure';
        io.emit('status', { status: 'auth_failure', message: msg });
        console.log('Auth failure:', msg);
    });

    client.on('disconnected', (reason) => {
        clientStatus = 'disconnected';
        io.emit('status', { status: 'disconnected', reason });
        console.log('Disconnected:', reason);
    });

    // 添加更多调试事件
    client.on('change_state', (state) => {
        console.log('State changed:', state);
    });

    client.on('change_battery', (batteryInfo) => {
        console.log('Battery:', batteryInfo);
    });

    client.on('message', (msg) => {
        io.emit('message', {
            body: msg.body,
            from: msg.from,
            name: msg.notifyName,
            type: msg.type,
            timestamp: msg.timestamp,
        });

        handleAutoReply(msg);
    });

    client
        .initialize()
        .then(() => {
            console.log('Client initialization completed');
        })
        .catch((error) => {
            console.error('Error initializing client:', error);
            clientStatus = 'auth_failure';
            io.emit('status', {
                status: 'auth_failure',
                message: error.message,
            });
        });
}

async function runContactTest() {
    if (!client || clientStatus !== 'ready') {
        console.log('Client not ready for contact test');
        return;
    }

    contactTestLoop.attempts++;
    console.log(
        `\n========== Contact Test Attempt #${contactTestLoop.attempts} ==========`,
    );

    try {
        const contactsData = await client.pupPage.evaluate(async () => {
            let contacts = [];
            const allMethods = [];
            const logs = [];

            function log(msg) {
                console.log(msg);
                logs.push(msg);
            }

            // eslint-disable-next-line no-unused-vars
            async function waitAndRetry(fn, maxRetries = 3, delay = 2000) {
                for (let i = 0; i < maxRetries; i++) {
                    try {
                        const result = await fn();
                        if (result && result.length > 0) return result;
                        // eslint-disable-next-line no-empty
                    } catch (e) {}
                    await new Promise((r) => setTimeout(r, delay));
                }
                return null;
            }

            log('===== Checking available window objects =====');
            log('window.Store: ' + typeof window.Store);
            log('window.WA: ' + typeof window.WA);
            log('window.WAPI: ' + typeof window.WAPI);
            log('window.require: ' + typeof window.require);

            // Method 1: Try window.require('WAWebCollections')
            try {
                if (window.require) {
                    log(
                        '\n===== Method 1: window.require(WAWebCollections) =====',
                    );
                    try {
                        const Collections = window.require('WAWebCollections');
                        log('WAWebCollections: ' + typeof Collections);

                        if (Collections && Collections.Contact) {
                            log('WAWebCollections.Contact found!');

                            // Try .models first
                            if (
                                Collections.Contact.models &&
                                Collections.Contact.models.length > 0
                            ) {
                                contacts = Collections.Contact.models;
                                log('Models found: ' + contacts.length);
                            }

                            // Try findAll
                            if (
                                (!contacts || contacts.length === 0) &&
                                Collections.Contact.findAll
                            ) {
                                log('Trying findAll()...');
                                contacts = await Collections.Contact.findAll();
                                log(
                                    'findAll result: ' +
                                        (contacts?.length || 0),
                                );
                            }

                            // Try _index
                            if (
                                (!contacts || contacts.length === 0) &&
                                Collections.Contact._index
                            ) {
                                log('Trying _index...');
                                contacts = Object.values(
                                    Collections.Contact._index,
                                );
                                log(
                                    '_index result: ' + (contacts?.length || 0),
                                );
                            }

                            // Try .then() if it's a promise
                            if (
                                (!contacts || contacts.length === 0) &&
                                typeof Collections.Contact.then === 'function'
                            ) {
                                log('Contact is a Promise, awaiting...');
                                const resolved = await Collections.Contact;
                                if (
                                    resolved &&
                                    resolved.models &&
                                    resolved.models.length > 0
                                ) {
                                    contacts = resolved.models;
                                    log('Resolved models: ' + contacts.length);
                                }
                            }
                        }
                    } catch (e) {
                        log('Error with WAWebCollections: ' + e.message);
                        allMethods.push({
                            name: 'WAWebCollections',
                            error: e.message,
                        });
                    }
                }
            } catch (e) {
                log('require check error: ' + e.message);
            }

            // Method 2: Try window.Store (older API)
            if (!contacts || contacts.length === 0) {
                try {
                    log('\n===== Method 2: window.Store.Contact =====');
                    if (window.Store && window.Store.Contact) {
                        log('window.Store.Contact found!');
                        if (
                            window.Store.Contact.models &&
                            window.Store.Contact.models.length > 0
                        ) {
                            contacts = window.Store.Contact.models;
                            log('Store models: ' + contacts.length);
                        }
                        if (
                            (!contacts || contacts.length === 0) &&
                            window.Store.Contact.findAll
                        ) {
                            contacts = await window.Store.Contact.findAll();
                            log('findAll result: ' + (contacts?.length || 0));
                        }
                        if (
                            (!contacts || contacts.length === 0) &&
                            window.Store.Contact.filter
                        ) {
                            contacts = window.Store.Contact.filter(() => true);
                            log('filter result: ' + (contacts?.length || 0));
                        }
                    } else {
                        log('window.Store.Contact NOT FOUND');
                    }
                } catch (e) {
                    log('Error Store.Contact: ' + e.message);
                    allMethods.push({
                        name: 'Store.Contact',
                        error: e.message,
                    });
                }
            }

            // Method 3: Try WAPI
            if (!contacts || contacts.length === 0) {
                try {
                    log('\n===== Method 3: WAPI.getAllContacts =====');
                    if (window.WAPI && window.WAPI.getAllContacts) {
                        contacts = await window.WAPI.getAllContacts();
                        log('WAPI result: ' + (contacts?.length || 0));
                    } else {
                        log('WAPI.getAllContacts NOT FOUND');
                    }
                } catch (e) {
                    log('Error WAPI: ' + e.message);
                    allMethods.push({ name: 'WAPI', error: e.message });
                }
            }

            // Method 4: Try triggering contact load by opening a chat
            if (!contacts || contacts.length === 0) {
                log('\n===== Method 4: Try to find from WidFactory =====');
                try {
                    if (window.require) {
                        const WidFactory = window.require('WAWebWidFactory');
                        log('WidFactory: ' + typeof WidFactory);
                    }
                } catch (e) {
                    log('Error WidFactory: ' + e.message);
                }
            }

            // Method 5: Get from chat list - fallback
            if (!contacts || contacts.length === 0) {
                log(
                    '\n===== Method 5: Get from Chat collection (fallback) =====',
                );
                try {
                    if (window.require) {
                        const Collections = window.require('WAWebCollections');
                        if (Collections && Collections.Chat) {
                            log('Chat collection found!');
                            const chats = Collections.Chat.models || [];
                            log('Chats: ' + chats.length);

                            // Extract contacts from chats
                            const seenNumbers = new Set();
                            for (const chat of chats) {
                                try {
                                    const contact = chat.attributes || chat;
                                    const number =
                                        contact.id?.user ||
                                        contact.id?._serialized?.split('@')[0];
                                    if (
                                        number &&
                                        !seenNumbers.has(number) &&
                                        number.length > 5
                                    ) {
                                        seenNumbers.add(number);
                                        contacts.push({
                                            attributes: {
                                                phone: number,
                                                displayName:
                                                    contact.name ||
                                                    contact.rawName ||
                                                    number,
                                                isMe: false,
                                            },
                                        });
                                    }
                                    // eslint-disable-next-line no-empty
                                } catch (e) {}
                            }
                            log(
                                'Extracted contacts from chats: ' +
                                    contacts.length,
                            );
                        }
                    }
                } catch (e) {
                    log('Error getting from Chat: ' + e.message);
                }
            }

            if (!contacts || contacts.length === 0) {
                log('\n===== All methods failed, listing window keys =====');
                const keys = Object.keys(window).filter(
                    (k) =>
                        k.toLowerCase().includes('wa') ||
                        k.toLowerCase().includes('store') ||
                        k.toLowerCase().includes('contact') ||
                        k.toLowerCase().includes('collection') ||
                        k.toLowerCase().includes('wid') ||
                        k.toLowerCase().includes('api'),
                );
                log('Relevant keys: ' + keys.slice(0, 30).join(', '));
                allMethods.push({
                    name: 'Window Keys',
                    keys: keys.slice(0, 30),
                });
            }

            log('\n===== Processing contacts =====');
            log('Raw contacts count: ' + (contacts?.length || 0));

            const result = [];
            let skippedNoNumber = 0;
            let skippedTooShort = 0;
            let addedCount = 0;

            for (const c of contacts || []) {
                try {
                    let attrs = null;
                    if (c.attributes) {
                        attrs = c.attributes;
                    } else if (
                        c.serialize &&
                        typeof c.serialize === 'function'
                    ) {
                        try {
                            attrs = c.serialize();
                        } catch (serializeError) {
                            attrs = c;
                        }
                    } else {
                        attrs = c;
                    }

                    let number =
                        attrs.phone ||
                        attrs.phoneNumber ||
                        attrs.id?.user ||
                        attrs.userid;
                    if (
                        typeof number === 'object' &&
                        number !== null &&
                        number.user
                    ) {
                        number = number.user;
                    }

                    if (!number || typeof number !== 'string') {
                        skippedNoNumber++;
                        continue;
                    }
                    if (number.length <= 5) {
                        skippedTooShort++;
                        continue;
                    }

                    result.push({
                        number: number,
                        name:
                            attrs.displayName ||
                            attrs.pushname ||
                            attrs.shortName ||
                            attrs.name ||
                            number,
                        isMe: attrs.isMe,
                        lid: attrs.id?.user || null,
                        id: attrs.id?._serialized || null,
                    });
                    addedCount++;
                    // eslint-disable-next-line no-empty
                } catch (e) {
                    log('Error processing contact: ' + e.message);
                }
            }

            log('Skipped (no number): ' + skippedNoNumber);
            log('Skipped (too short): ' + skippedTooShort);
            log('Added: ' + addedCount);
            log('Processed contacts: ' + result.length);
            return {
                contacts: result,
                methods: allMethods,
                rawCount: contacts?.length || 0,
                logs: logs,
            };
        });

        console.log('\n===== Browser Logs =====');
        if (contactsData.logs) {
            contactsData.logs.forEach((l) => console.log(l));
        }

        const contactList = contactsData.contacts
            .filter((c) => !c.isMe)
            .map((c) => ({
                id: c.number + '@c.us',
                name: c.name,
                number: c.number,
            }));

        contactTestLoop.lastResult = {
            success: contactList.length > 0,
            count: contactList.length,
            rawCount: contactsData.rawCount,
            methods: contactsData.methods,
            contacts: contactList,
            timestamp: new Date().toISOString(),
        };

        console.log(
            `\n========== Test #${contactTestLoop.attempts} Result ==========`,
        );
        console.log(
            `Found: ${contactList.length} contacts (raw: ${contactsData.rawCount})`,
        );
        console.log(
            'Methods tried:',
            contactsData.methods.map((m) => m.name).join(', '),
        );

        io.emit('contact-test-progress', contactTestLoop);

        if (contactTestLoop.stopOnSuccess && contactList.length > 0) {
            console.log('\n*** SUCCESS! Found contacts, stopping loop ***');
            contactTestLoop.running = false;
            io.emit('contact-test-progress', contactTestLoop);
        }
    } catch (e) {
        console.log(`Test #${contactTestLoop.attempts} - Error:`, e.message);
        contactTestLoop.lastResult = {
            success: false,
            error: e.message,
            timestamp: new Date().toISOString(),
        };
        io.emit('contact-test-progress', contactTestLoop);
    }
}

async function startContactTestLoop() {
    if (contactTestLoop.running && contactTestLoop.attempts > 0) return;

    contactTestLoop.running = true;
    contactTestLoop.attempts = 0;
    io.emit('contact-test-progress', contactTestLoop);

    console.log('=== Starting contact test loop ===');

    while (
        contactTestLoop.running &&
        contactTestLoop.attempts < contactTestLoop.maxAttempts
    ) {
        await runContactTest();

        if (contactTestLoop.running) {
            await new Promise((r) => setTimeout(r, contactTestLoop.interval));
        }
    }

    if (contactTestLoop.attempts >= contactTestLoop.maxAttempts) {
        console.log(
            `=== Max attempts (${contactTestLoop.maxAttempts}) reached, stopping loop ===`,
        );
        contactTestLoop.running = false;
        io.emit('contact-test-progress', contactTestLoop);
    }
}

function stopContactTestLoop() {
    console.log('=== Stopping contact test loop ===');
    contactTestLoop.running = false;
    io.emit('contact-test-progress', contactTestLoop);
}

function handleAutoReply(msg) {
    if (!autoReplyRules.length) return;

    for (const rule of autoReplyRules) {
        if (!rule.enabled) continue;

        let matched = false;
        if (
            rule.matchType === 'keyword' &&
            msg.body.toLowerCase().includes(rule.keyword.toLowerCase())
        ) {
            matched = true;
        } else if (rule.matchType === 'exact' && msg.body === rule.keyword) {
            matched = true;
        } else if (rule.matchType === 'regex') {
            try {
                const regex = new RegExp(rule.keyword);
                matched = regex.test(msg.body);
                // eslint-disable-next-line no-empty
            } catch (e) {}
        }

        if (matched) {
            client.sendMessage(msg.from, rule.reply);
            io.emit('auto-reply', {
                keyword: rule.keyword,
                reply: rule.reply,
                to: msg.from,
            });
            break;
        }
    }
}

function startScheduledTasks() {
    scheduledTasks.forEach((task) => {
        if (task.running) return;

        const runTask = async () => {
            if (!client || clientStatus !== 'ready') return;

            try {
                const chats = await client.getChats();
                const targetChats =
                    task.targetType === 'all'
                        ? chats
                        : chats.filter(
                              (c) =>
                                  c.isGroup === (task.targetType === 'groups'),
                          );

                for (const chat of targetChats) {
                    await client.sendMessage(chat.id._serialized, task.message);
                    await new Promise((r) => setTimeout(r, 5000));
                }

                io.emit('scheduled-task', {
                    name: task.name,
                    executedAt: new Date().toISOString(),
                    sentCount: targetChats.length,
                });
            } catch (e) {
                console.error('Scheduled task error:', e);
            }
        };

        if (task.type === 'once') {
            const delay = new Date(task.time) - new Date();
            if (delay > 0) {
                task.running = true;
                setTimeout(async () => {
                    await runTask();
                    task.running = false;
                }, delay);
            }
        } else if (task.type === 'daily') {
            task.running = true;
            const runDaily = async () => {
                await runTask();
                const now = new Date();
                const nextRun = new Date(now);
                nextRun.setDate(nextRun.getDate() + 1);
                nextRun.setHours(task.hour, task.minute, 0, 0);
                task.timeout = setTimeout(runDaily, nextRun - now);
            };
            const now = new Date();
            const nextRun = new Date(now);
            nextRun.setHours(task.hour, task.minute, 0, 0);
            if (nextRun <= now) nextRun.setDate(nextRun.getDate() + 1);
            task.timeout = setTimeout(runDaily, nextRun - now);
        }
    });
}

// 自动初始化客户端
initClient();

app.get('/api/status', (req, res) => {
    res.json({ status: clientStatus, qr: qrCode });
});

app.post('/api/connect', (req, res) => {
    if (client && clientStatus !== 'disconnected') {
        res.json({ success: false, message: 'Already connected' });
        return;
    }
    initClient();
    res.json({ success: true, message: 'Connecting...' });
});

app.post('/api/contact-test/start', (req, res) => {
    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }
    const body = req.body || {};
    const maxAttempts = body.maxAttempts || 100;
    const interval = body.interval || 3000;
    const stopOnSuccess =
        body.stopOnSuccess !== undefined ? body.stopOnSuccess : true;
    contactTestLoop.maxAttempts = maxAttempts;
    contactTestLoop.interval = interval;
    contactTestLoop.stopOnSuccess = stopOnSuccess;
    startContactTestLoop();
    res.json({ success: true });
});

app.post('/api/contact-test/stop', (req, res) => {
    stopContactTestLoop();
    res.json({ success: true });
});

app.get('/api/contact-test/status', (req, res) => {
    res.json(contactTestLoop);
});

app.get('/api/chats', async (req, res) => {
    if (!client || clientStatus !== 'ready') {
        return res.json({ chats: [] });
    }
    try {
        const chats = await client.getChats();

        // Debug: log first chat's available properties
        if (chats.length > 0) {
            console.log('First chat available keys:', Object.keys(chats[0]));
            console.log('First chat id keys:', Object.keys(chats[0].id));
            console.log('First chat id:', JSON.stringify(chats[0].id));
        }

        const chatList = chats.map((chat) => ({
            id: chat.id._serialized,
            name: chat.name,
            isGroup: chat.isGroup,
            lastMessage: chat.lastMessage?.body || '',
            participants: chat.participants?.length || 0,
        }));
        res.json({ chats: chatList });
    } catch (e) {
        res.json({ chats: [], error: e.message });
    }
});

app.get('/api/export-contacts', async (req, res) => {
    if (!client || clientStatus !== 'ready') {
        return res.json({ error: 'Client not ready' });
    }
    try {
        const chats = await client.getChats();
        const contacts = [];
        const seenNumbers = new Set();

        for (const chat of chats) {
            if (chat.isGroup) continue;

            let number = null;
            if (chat.id?.user) {
                number = chat.id.user;
            } else if (chat.id?._serialized) {
                const match = chat.id._serialized.match(/^(\d+)@/);
                if (match) number = match[1];
            }

            if (number && !seenNumbers.has(number) && number.length > 5) {
                seenNumbers.add(number);
                contacts.push({
                    number: number,
                    name: chat.name || number,
                });
            }
        }

        let csv = '手机号,姓名\n';
        contacts.forEach((c) => {
            csv += `${c.number},${c.name}\n`;
        });

        res.setHeader('Content-Type', 'text/csv;charset=utf-8');
        res.setHeader(
            'Content-Disposition',
            'attachment; filename=contacts.csv',
        );
        res.send(csv);
        // eslint-disable-next-line no-empty
    } catch (e) {
        res.json({ error: e.message });
    }
});

app.get('/api/contacts-list', async (req, res) => {
    if (!client || clientStatus !== 'ready') {
        return res.json({ contacts: [], error: 'Client not ready' });
    }
    try {
        console.log('Fetching contacts via Puppeteer...');

        const contactsData = await client.pupPage.evaluate(async () => {
            let contacts = [];

            // Method 1: Try _index first (most reliable for getting all contacts)
            if (window.require) {
                try {
                    const Collections = window.require('WAWebCollections');
                    if (Collections && Collections.Contact) {
                        // Try _index first (usually has all contacts)
                        if (Collections.Contact._index) {
                            const allContacts = Object.values(
                                Collections.Contact._index,
                            );
                            // Filter to only include contacts with phoneNumber attribute (avoid duplicates)
                            contacts = allContacts.filter((c) => {
                                try {
                                    const attrs =
                                        c.attributes ||
                                        (c.serialize ? c.serialize() : c);
                                    return attrs && attrs.phoneNumber;
                                } catch (e) {
                                    return false;
                                }
                            });
                            console.log(
                                '_index result:',
                                allContacts?.length,
                                'filtered:',
                                contacts?.length,
                            );
                        }
                        // Fallback to findAll
                        if (
                            (!contacts || contacts.length === 0) &&
                            Collections.Contact.findAll
                        ) {
                            contacts = await Collections.Contact.findAll();
                            console.log('findAll result:', contacts?.length);
                        }
                        // Last resort: models
                        if (
                            (!contacts || contacts.length === 0) &&
                            Collections.Contact.models &&
                            Collections.Contact.models.length > 0
                        ) {
                            contacts = Collections.Contact.models;
                            console.log('models result:', contacts.length);
                        }
                    }
                } catch (e) {
                    console.log('Error WAWebCollections:', e.message);
                }
            }

            // Method 2: Try window.Store (older API)
            if (!contacts || contacts.length === 0) {
                if (window.Store && window.Store.Contact) {
                    try {
                        if (window.Store.Contact.findAll) {
                            contacts = await window.Store.Contact.findAll();
                            console.log(
                                'Store findAll result:',
                                contacts?.length,
                            );
                        } else if (window.Store.Contact._index) {
                            contacts = Object.values(
                                window.Store.Contact._index,
                            );
                            console.log(
                                'Store _index result:',
                                contacts?.length,
                            );
                        } else if (
                            window.Store.Contact.models &&
                            window.Store.Contact.models.length > 0
                        ) {
                            contacts = window.Store.Contact.models;
                            console.log(
                                'Store models result:',
                                contacts?.length,
                            );
                        }
                    } catch (e) {
                        console.log('Error Store.Contact:', e.message);
                    }
                }
            }

            // Method 3: Try WAPI
            if (!contacts || contacts.length === 0) {
                if (window.WAPI && window.WAPI.getAllContacts) {
                    try {
                        contacts = await window.WAPI.getAllContacts();
                        console.log('WAPI result:', contacts?.length);
                    } catch (e) {
                        console.log('Error WAPI:', e.message);
                    }
                }
            }

            // Method 4: Fallback - get from Chat collection
            if (!contacts || contacts.length === 0) {
                try {
                    if (window.require) {
                        const Collections = window.require('WAWebCollections');
                        if (
                            Collections &&
                            Collections.Chat &&
                            Collections.Chat.models
                        ) {
                            const chats = Collections.Chat.models;
                            const seenNumbers = new Set();
                            contacts = [];
                            for (const chat of chats) {
                                try {
                                    const contact = chat.attributes || chat;
                                    const number =
                                        contact.id?.user ||
                                        contact.id?._serialized?.split('@')[0];
                                    if (
                                        number &&
                                        !seenNumbers.has(number) &&
                                        number.length > 5
                                    ) {
                                        seenNumbers.add(number);
                                        contacts.push({
                                            attributes: {
                                                phone: number,
                                                displayName:
                                                    contact.name ||
                                                    contact.rawName ||
                                                    number,
                                                isMe: false,
                                            },
                                        });
                                    }
                                    // eslint-disable-next-line no-empty
                                } catch (e) {}
                            }
                            console.log(
                                'Extracted from chats:',
                                contacts?.length,
                            );
                        }
                    }
                } catch (e) {
                    console.log('Error from Chat:', e.message);
                }
            }

            console.log('Final contacts array:', contacts?.length);

            const result = [];
            let countNoNumber = 0;
            let countTooShort = 0;
            let countAdded = 0;
            let countDuplicate = 0;
            const seenNumbers = new Set();

            for (const c of contacts || []) {
                try {
                    let attrs = null;
                    if (c.attributes) {
                        attrs = c.attributes;
                    } else if (
                        c.serialize &&
                        typeof c.serialize === 'function'
                    ) {
                        try {
                            attrs = c.serialize();
                        } catch (serializeError) {
                            attrs = c;
                        }
                    } else {
                        attrs = c;
                    }

                    let number =
                        attrs.phone ||
                        attrs.phoneNumber ||
                        attrs.id?.user ||
                        attrs.userid;
                    // Handle case where number is an object like {user: "xxx", server: "c.us"}
                    if (
                        typeof number === 'object' &&
                        number !== null &&
                        number.user
                    ) {
                        number = number.user;
                    }

                    // 如果没有电话号码，尝试使用id._serialized
                    if (!number && attrs.id && attrs.id._serialized) {
                        number = attrs.id._serialized.split('@')[0];
                    }

                    if (!number || typeof number !== 'string') {
                        countNoNumber++;
                        continue;
                    }
                    if (number.length <= 5) {
                        countTooShort++;
                        continue;
                    }

                    // 检查重复
                    if (seenNumbers.has(number)) {
                        countDuplicate++;
                        continue;
                    }
                    seenNumbers.add(number);

                    // Debug: log first contact's id structure
                    if (countAdded === 0) {
                        console.log(
                            'First contact attrs.id:',
                            JSON.stringify(attrs.id),
                        );
                        console.log(
                            'First contact attrs keys:',
                            Object.keys(attrs),
                        );
                    }

                    result.push({
                        number: number,
                        name:
                            attrs.displayName ||
                            attrs.pushname ||
                            attrs.shortName ||
                            attrs.name ||
                            number,
                        isMe: attrs.isMe,
                        lid: attrs.id?.user || null,
                        id: attrs.id?._serialized || null,
                    });
                    countAdded++;
                } catch (e) {
                    console.log('Error processing contact:', e.message);
                }
            }

            return {
                contacts: result,
                stats: {
                    total: contacts?.length || 0,
                    noNumber: countNoNumber,
                    tooShort: countTooShort,
                    duplicate: countDuplicate,
                    added: countAdded,
                },
            };
        });

        const { contacts: rawContacts, stats } = contactsData;
        console.log('Contact processing stats:', stats);

        const isMeCount = rawContacts.filter((c) => c.isMe).length;
        console.log('Filtered (isMe):', isMeCount);

        const uniqueNumbers = new Set();
        const contactList = [];
        for (const c of rawContacts) {
            if (c.isMe) continue;
            if (!uniqueNumbers.has(c.number)) {
                uniqueNumbers.add(c.number);
                contactList.push({
                    id: c.number + '@c.us',
                    name: c.name,
                    number: c.number,
                    lid: c.lid || null,
                });
            }
        }

        console.log('Final contacts (after dedup):', contactList.length);
        res.json({ contacts: contactList, total: contactList.length, stats });
    } catch (e) {
        console.log('API Error:', e.message);
        res.json({ contacts: [], error: e.message });
    }
});

app.get('/api/chat/:id', async (req, res) => {
    if (!client || clientStatus !== 'ready') {
        return res.json({ error: 'Client not ready' });
    }
    try {
        const chat = await client.getChatById(req.params.id);
        const messages = await chat.fetchMessages({ limit: 50 });
        res.json({
            chat: {
                id: chat.id._serialized,
                name: chat.name,
                isGroup: chat.isGroup,
            },
            messages: messages.map((m) => ({
                id: m.id._serialized,
                body: m.body,
                type: m.type,
                from: m.from,
                fromMe: m.fromMe,
                timestamp: m.timestamp,
            })),
        });
        // eslint-disable-next-line no-empty
    } catch (e) {
        res.json({ error: e.message });
    }
});

app.post('/api/send', async (req, res) => {
    const { chatId, message } = req.body;
    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }
    try {
        await client.sendMessage(chatId, message);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/send-media', async (req, res) => {
    // eslint-disable-next-line no-unused-vars
    const { chatId, caption, mediaType } = req.body;

    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }

    try {
        const uploadsDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const files = fs.readdirSync(uploadsDir);
        const mediaFile = files.find((f) => f.startsWith('media-'));

        if (!mediaFile) {
            return res.json({
                success: false,
                error: 'No media file found in uploads folder',
            });
        }

        const mediaPath = path.join(uploadsDir, mediaFile);
        const media = MessageMedia.fromFilePath(mediaPath);

        await client.sendMessage(chatId, media, { caption });
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/upload', async (req, res) => {
    // eslint-disable-next-line no-unused-vars
    const { fileName, base64Data, mimeType } = req.body;

    try {
        const uploadsDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const buffer = Buffer.from(base64Data, 'base64');
        const filePath = path.join(
            uploadsDir,
            `media-${Date.now()}-${fileName}`,
        );
        fs.writeFileSync(filePath, buffer);

        res.json({ success: true, filePath: filePath });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

function randomizeMessage(
    message,
    lastGreeting = null,
    lengthRandomize = true,
) {
    let result = message;

    // ========== 英文问候语去重 ==========
    const greetings = [
        'Hi',
        'Hey',
        'Hello',
        'Greetings',
        'Hi there',
        'Hey there',
        'Good morning',
        'Good afternoon',
        'Good evening',
    ];
    let currentGreeting = null;

    for (const greeting of greetings) {
        // 检测消息开头（考虑表情符号和空格）
        const cleanStart = result
            .replace(
                /^[\s\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]+/u,
                '',
            )
            .trim();
        if (cleanStart.toLowerCase().startsWith(greeting.toLowerCase())) {
            currentGreeting = greeting;
            break;
        }
    }

    // 如果问候语与上次相同，替换为不同的问候语
    if (currentGreeting && currentGreeting === lastGreeting) {
        const otherGreetings = greetings.filter((g) => g !== currentGreeting);
        const newGreeting =
            otherGreetings[Math.floor(Math.random() * otherGreetings.length)];
        // 只替换开头的问候语
        const regex = new RegExp(
            `^([\\s\\u{1F300}-\\u{1F9FF}\\u{2600}-\\u{26FF}\\u{2700}-\\u{27BF}]*)${currentGreeting}`,
            'iu',
        );
        result = result.replace(regex, `$1${newGreeting}`);
    }

    // ========== 友好表情符号（适合商务英文） ==========
    const emojis = [
        '😊',
        '👍',
        '✨',
        '🎉',
        '👋',
        '😄',
        '🙏',
        '🌟',
        '💐',
        '🤝',
        '🌈',
        '🎊',
        '💖',
        '🌺',
        '💫',
        '🦋',
        '🏆',
        '💎',
        '🔥',
        '⭐',
    ];

    // 随机添加表情符号（20%概率）
    if (Math.random() < 0.2) {
        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
        // 50% 加在前面，50% 加在后面
        if (Math.random() < 0.5) {
            result = randomEmoji + ' ' + result;
        } else {
            result = result + ' ' + randomEmoji;
        }
    }

    // ========== 英文同义词替换 ==========
    if (Math.random() < 0.25) {
        const synonyms = {
            project: ['venture', 'endeavor', 'initiative', 'undertaking'],
            collection: ['range', 'lineup', 'selection', 'series'],
            new: ['latest', 'fresh', 'brand-new', 'innovative'],
            quality: ['premium', 'top-tier', 'high-end', 'superior'],
            contact: ['reach out', 'get in touch', 'connect'],
            offer: ['proposal', 'opportunity', 'deal', 'package'],
            exclusive: ['limited', 'special', 'VIP', 'premium'],
            amazing: ['incredible', 'outstanding', 'remarkable', 'fantastic'],
            interested: ['keen', 'intrigued', 'enthusiastic'],
            reply: ['respond', 'write back', 'message back'],
        };

        for (const [word, alternatives] of Object.entries(synonyms)) {
            // 使用正则表达式匹配完整单词（不区分大小写）
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            if (regex.test(result) && Math.random() < 0.3) {
                const replacement =
                    alternatives[
                        Math.floor(Math.random() * alternatives.length)
                    ];
                // 保持原始大小写格式
                result = result.replace(regex, (match) => {
                    if (match[0] === match[0].toUpperCase()) {
                        return (
                            replacement.charAt(0).toUpperCase() +
                            replacement.slice(1)
                        );
                    }
                    return replacement;
                });
            }
        }
    }

    // ========== 英文句式变换 ==========
    if (Math.random() < 0.2) {
        const transformations = [
            { from: /\bWe are excited to\b/gi, to: "We're thrilled to" },
            { from: /\bDon't hesitate to\b/gi, to: 'Feel free to' },
            { from: /\bLooking forward to\b/gi, to: "Can't wait to" },
            {
                from: /\bThank you for your interest\b/gi,
                to: 'Thanks for your interest',
            },
            { from: /\bPlease let us know\b/gi, to: 'Let us know' },
            { from: /\bWe would love to\b/gi, to: "We'd love to" },
        ];

        const randomTransform =
            transformations[Math.floor(Math.random() * transformations.length)];
        if (randomTransform.from.test(result)) {
            result = result.replace(randomTransform.from, randomTransform.to);
        }
    }

    // ========== 随机结尾语（15%概率） ==========
    if (Math.random() < 0.15) {
        const closings = [
            'Looking forward to hearing from you!',
            'Excited to connect with you!',
            'Have a wonderful day!',
            'Best regards',
            'Talk soon!',
            'Cheers',
            'Stay amazing!',
            "Can't wait to work together!",
        ];
        const randomClosing =
            closings[Math.floor(Math.random() * closings.length)];
        result = result + '\n\n' + randomClosing;
    }

    // ========== 英文标点随机化 ==========
    if (Math.random() < 0.2) {
        // 随机将部分句号变为感叹号
        const sentences = result.split('.');
        if (sentences.length > 2) {
            for (let i = 0; i < sentences.length - 1; i++) {
                if (Math.random() < 0.3) {
                    sentences[i] = sentences[i].trim() + '!';
                } else {
                    sentences[i] = sentences[i].trim() + '.';
                }
            }
            result = sentences.join(' ');
        }
    }

    // ========== 消息长度随机化（增强版） ==========
    if (lengthRandomize) {
        // 策略1: 随机添加/删除可选短语，真正改变消息长度
        const optionalPhrases = [
            { add: ' By the way, ', prob: 0.15 },
            { add: ' Just a quick note: ', prob: 0.1 },
            { add: ' Also, ', prob: 0.12 },
            { add: ' Plus, ', prob: 0.1 },
            { add: ' In addition, ', prob: 0.08 },
            { add: ' As a side note, ', prob: 0.06 },
            { add: ' FYI, ', prob: 0.1 },
            { add: ' Just so you know, ', prob: 0.08 },
        ];

        // 在句子中间随机插入可选短语
        const sentencesArr = result.split(/(?<=[.!?])\s+/);
        if (sentencesArr.length > 1) {
            for (const phrase of optionalPhrases) {
                if (Math.random() < phrase.prob) {
                    // 随机选择一个句子位置插入
                    const insertIdx =
                        Math.floor(Math.random() * (sentencesArr.length - 1)) +
                        1;
                    sentencesArr[insertIdx] =
                        phrase.add +
                        sentencesArr[insertIdx].toLowerCase().charAt(0) +
                        sentencesArr[insertIdx].slice(1);
                    break; // 只插入一个
                }
            }
            result = sentencesArr.join(' ');
        }

        // 策略2: 随机添加填充词（不改变语义）
        const fillerWords = [
            { pattern: /\bvery\b/gi, replacement: 'really', prob: 0.1 },
            { pattern: /\breally\b/gi, replacement: 'very', prob: 0.1 },
            { pattern: /\bgreat\b/gi, replacement: 'wonderful', prob: 0.1 },
            { pattern: /\bwonderful\b/gi, replacement: 'great', prob: 0.1 },
        ];

        for (const fw of fillerWords) {
            if (Math.random() < fw.prob && fw.pattern.test(result)) {
                result = result.replace(fw.pattern, fw.replacement);
            }
        }

        // 策略3: 随机添加问候语后的称呼（增加长度）
        if (Math.random() < 0.2 && currentGreeting) {
            const namePlaceholders = ['{name}', 'there', 'friend', 'pal'];
            const placeholder =
                namePlaceholders[
                    Math.floor(Math.random() * namePlaceholders.length)
                ];
            // 在问候语后添加逗号和称呼
            const greetingRegex = new RegExp(
                `^([\\s\\u{1F300}-\\u{1F9FF}\\u{2600}-\\u{26FF}\\u{2700}-\\u{27BF}]*${currentGreeting})([,!\\s]*)`,
                'iu',
            );
            if (!result.match(new RegExp(`${currentGreeting}\\s+\\w+`, 'i'))) {
                result = result.replace(greetingRegex, `$1 ${placeholder}$2`);
            }
        }

        // 策略4: 随机添加不可见空格或零宽字符，改变消息长度但保持显示不变
        if (Math.random() < 0.4) {
            const invisibleChars = ['\u200B', '\u200C', '\u200D', '\uFEFF']; // 零宽字符和零宽非断空格
            const chars = result.split('');
            const insertPositions = [];

            // 随机选择2-5个插入位置
            const insertCount = Math.floor(Math.random() * 4) + 2;
            for (let i = 0; i < insertCount; i++) {
                const pos = Math.floor(Math.random() * chars.length);
                insertPositions.push(pos);
            }

            // 从后往前插入，避免位置偏移
            insertPositions.sort((a, b) => b - a);
            for (const pos of insertPositions) {
                const randomChar =
                    invisibleChars[
                        Math.floor(Math.random() * invisibleChars.length)
                    ];
                chars.splice(pos, 0, randomChar);
            }
            result = chars.join('');
        }

        // 策略5: 随机添加额外空格（在标点符号后）
        if (Math.random() < 0.3) {
            const extraSpaces = Math.floor(Math.random() * 2) + 1;
            result = result.replace(/([.!?])(\s)/g, (match, p1) => {
                if (Math.random() < 0.4) {
                    return p1 + ' '.repeat(extraSpaces);
                }
                return match;
            });
        }

        // 策略6: 随机添加行内换行（模拟手机输入时的换行习惯）
        if (Math.random() < 0.15 && result.length > 100) {
            const words = result.split(' ');
            if (words.length > 10) {
                // 在随机位置插入换行
                const breakPos =
                    Math.floor(Math.random() * (words.length - 5)) + 3;
                words.splice(breakPos, 0, '\n');
                result = words.join(' ');
            }
        }

        // 策略7: 随机添加省略号或破折号（改变长度和风格）
        if (Math.random() < 0.1) {
            const punctuationVariations = [
                { from: /,\s+/g, to: '... ', prob: 0.05 },
                { from: /;\s+/g, to: ' — ', prob: 0.05 },
            ];
            for (const pv of punctuationVariations) {
                if (Math.random() < pv.prob) {
                    result = result.replace(pv.from, pv.to);
                }
            }
        }
    }

    return {
        message: result,
        greeting: currentGreeting,
    };
}

async function getAllContactsFromPuppeteer() {
    const contactsData = await client.pupPage.evaluate(async () => {
        let contacts = [];

        // Method 1: Try _index first (most reliable for getting all contacts)
        if (window.require) {
            try {
                const Collections = window.require('WAWebCollections');
                if (Collections && Collections.Contact) {
                    // Try _index first (usually has all contacts)
                    if (Collections.Contact._index) {
                        const allContacts = Object.values(
                            Collections.Contact._index,
                        );
                        // Filter to only include contacts with phoneNumber attribute (avoid duplicates)
                        contacts = allContacts.filter((c) => {
                            try {
                                const attrs =
                                    c.attributes ||
                                    (c.serialize ? c.serialize() : c);
                                return attrs && attrs.phoneNumber;
                            } catch (e) {
                                return false;
                            }
                        });
                        console.log(
                            '_index result:',
                            allContacts?.length,
                            'filtered:',
                            contacts?.length,
                        );
                    }
                    // Fallback to findAll
                    if (
                        (!contacts || contacts.length === 0) &&
                        Collections.Contact.findAll
                    ) {
                        contacts = await Collections.Contact.findAll();
                        console.log('findAll result:', contacts?.length);
                    }
                    // Last resort: models
                    if (
                        (!contacts || contacts.length === 0) &&
                        Collections.Contact.models &&
                        Collections.Contact.models.length > 0
                    ) {
                        contacts = Collections.Contact.models;
                        console.log('models result:', contacts.length);
                    }
                }
            } catch (e) {
                console.log('Error WAWebCollections:', e.message);
            }
        }

        // Method 2: Try window.Store (older API)
        if (!contacts || contacts.length === 0) {
            if (window.Store && window.Store.Contact) {
                try {
                    if (window.Store.Contact.findAll) {
                        contacts = await window.Store.Contact.findAll();
                        console.log('Store findAll result:', contacts?.length);
                    } else if (window.Store.Contact._index) {
                        contacts = Object.values(window.Store.Contact._index);
                        console.log('Store _index result:', contacts?.length);
                    } else if (
                        window.Store.Contact.models &&
                        window.Store.Contact.models.length > 0
                    ) {
                        contacts = window.Store.Contact.models;
                        console.log('Store models result:', contacts?.length);
                    }
                } catch (e) {
                    console.log('Error Store.Contact:', e.message);
                }
            }
        }

        // Method 3: Try WAPI
        if (!contacts || contacts.length === 0) {
            if (window.WAPI && window.WAPI.getAllContacts) {
                try {
                    contacts = await window.WAPI.getAllContacts();
                    console.log('WAPI result:', contacts?.length);
                } catch (e) {
                    console.log('Error WAPI:', e.message);
                }
            }
        }

        console.log('Final contacts array:', contacts?.length);

        const result = [];
        let countNoNumber = 0;
        let countTooShort = 0;
        let countAdded = 0;
        let countDuplicate = 0;
        const seenNumbers = new Set();

        for (const c of contacts || []) {
            try {
                let attrs = null;
                if (c.attributes) {
                    attrs = c.attributes;
                } else if (c.serialize && typeof c.serialize === 'function') {
                    try {
                        attrs = c.serialize();
                    } catch (serializeError) {
                        attrs = c;
                    }
                } else {
                    attrs = c;
                }

                let number =
                    attrs.phone ||
                    attrs.phoneNumber ||
                    attrs.id?.user ||
                    attrs.userid;
                // Handle case where number is an object like {user: "xxx", server: "c.us"}
                if (
                    typeof number === 'object' &&
                    number !== null &&
                    number.user
                ) {
                    number = number.user;
                }

                // 如果没有电话号码，尝试使用id._serialized
                if (!number && attrs.id && attrs.id._serialized) {
                    number = attrs.id._serialized.split('@')[0];
                }

                if (!number || typeof number !== 'string') {
                    countNoNumber++;
                    continue;
                }
                if (number.length <= 5) {
                    countTooShort++;
                    continue;
                }

                // 检查重复
                if (seenNumbers.has(number)) {
                    countDuplicate++;
                    continue;
                }
                seenNumbers.add(number);

                result.push({
                    number: number,
                    name:
                        attrs.displayName ||
                        attrs.pushname ||
                        attrs.shortName ||
                        attrs.name ||
                        number,
                    isMe: attrs.isMe,
                    lid: attrs.id?.user || null,
                    id: attrs.id?._serialized || null,
                });
                countAdded++;
            } catch (e) {
                console.log('Error processing contact:', e.message);
            }
        }

        return {
            contacts: result,
            stats: {
                total: contacts?.length || 0,
                noNumber: countNoNumber,
                tooShort: countTooShort,
                duplicate: countDuplicate,
                added: countAdded,
            },
        };
    });

    return contactsData;
}

app.post('/api/broadcast', async (req, res) => {
    const {
        message,
        interval = 10000,
        randomInterval = true,
        randomizeMsg = true,
        lengthRandomize = true,
        simulateTyping = false,
        simulateMouse = false,
        respectHours = true,
        randomPause = true,
        excludeGroups = true,
        personalize,
        targetType = 'chats',
        manualNumbers,
        accountLevel = 'new',
    } = req.body;

    // 设置账户级别
    setAccountLevel(accountLevel);

    // 处理消息模板
    let messages = [];
    if (Array.isArray(message)) {
        messages = message;
    } else if (typeof message === 'string' && message.includes('\n')) {
        messages = message
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
    } else {
        messages = [message];
    }

    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }

    if (broadcastProgress.running) {
        return res.json({ success: false, error: 'Broadcast already running' });
    }

    // 检查每日发送限制
    const sendCheck = canSend();
    if (!sendCheck.allowed) {
        return res.json({
            success: false,
            error: `Daily limit reached (${sendCheck.dailyMax}). Please wait until tomorrow.`,
        });
    }

    try {
        let targetItems = [];

        if (targetType === 'manual' && manualNumbers) {
            const lines = manualNumbers.split('\n').filter((l) => l.trim());
            targetItems = lines.map((line) => {
                const parts = line.split('|');
                const number = parts[0].trim();
                const name = parts[1]?.trim() || number;
                return {
                    id: number + '@c.us',
                    name: name,
                    isGroup: false,
                };
            });
            console.log('Manual targets:', targetItems.length);
        } else if (targetType === 'contacts') {
            console.log('Fetching ALL contacts via Puppeteer...');

            const { contacts: contactsData, stats } =
                await getAllContactsFromPuppeteer();
            console.log('Contact stats:', stats);

            const filtered = contactsData.filter((c) => !c.isMe);

            const uniqueNums = new Set();
            targetItems = [];
            for (const c of filtered) {
                if (!uniqueNums.has(c.number)) {
                    uniqueNums.add(c.number);
                    targetItems.push({
                        id: c.id || c.number + '@c.us',
                        name: c.name,
                        number: c.number,
                        lid: c.lid,
                        isGroup: false,
                    });
                }
            }
            console.log('Found ALL contacts:', targetItems.length);
        } else if (targetType === 'nohistory') {
            console.log('Fetching contacts with NO chat history...');

            const { contacts: contactsData, stats } =
                await getAllContactsFromPuppeteer();
            console.log('Contact stats:', stats);

            const chats = await client.getChats();

            // 构建聊天记录的 ID 集合（多种格式）
            const chatNumbers = new Set();
            const chatLids = new Set();
            const chatNames = new Set();

            for (const chat of chats) {
                // 提取数字 ID
                let number = null;
                if (chat.id?.user) {
                    number = chat.id.user;
                } else if (chat.id?._serialized) {
                    const match = chat.id._serialized.match(/^(\d+)@/);
                    if (match) number = match[1];
                }
                if (number) {
                    chatNumbers.add(number);
                }

                // 提取 lid
                if (
                    chat.id?._serialized &&
                    chat.id._serialized.endsWith('@lid')
                ) {
                    const lidMatch = chat.id._serialized.match(/^(\d+)@lid/);
                    if (lidMatch) chatLids.add(lidMatch[1]);
                }

                // 提取名字
                if (chat.name) {
                    chatNames.add(chat.name.toLowerCase().trim());
                }
            }

            console.log('Chat numbers count:', chatNumbers.size);
            console.log('Chat lids count:', chatLids.size);
            console.log('Chat names count:', chatNames.size);

            const filteredContacts = contactsData.filter((c) => {
                if (c.isMe) return false;

                const num = c.number.replace(/^\+/, '');
                const nameMatch = c.name
                    ? chatNames.has(c.name.toLowerCase().trim())
                    : false;
                const partialMatch =
                    c.name &&
                    Array.from(chatNames).some(
                        (chatName) =>
                            chatName.includes(c.name.toLowerCase().trim()) ||
                            c.name.toLowerCase().trim().includes(chatName),
                    );

                // 多种方式检查是否在聊天记录中
                const inChatsByLid =
                    c.lid && (chatNumbers.has(c.lid) || chatLids.has(c.lid));
                const inChatsByNumber =
                    chatNumbers.has(num) || chatNumbers.has(c.number);
                const inChatsById = c.id && chatNumbers.has(c.id.split('@')[0]);

                const isNoHistory =
                    !inChatsByLid &&
                    !inChatsByNumber &&
                    !inChatsById &&
                    !nameMatch &&
                    !partialMatch;

                if (!isNoHistory) {
                    console.log(
                        `Filtered out: ${c.name} (${c.number}), lid=${c.lid}, id=${c.id}, inChatsByLid=${inChatsByLid}, inChatsByNumber=${inChatsByNumber}`,
                    );
                }

                return isNoHistory;
            });

            console.log(
                'Filtered no-history contacts:',
                filteredContacts.length,
            );

            const uniqueNums = new Set();
            targetItems = [];
            for (const c of filteredContacts) {
                if (!uniqueNums.has(c.number)) {
                    uniqueNums.add(c.number);
                    targetItems.push({
                        id: c.id || c.number + '@c.us',
                        name: c.name,
                        number: c.number,
                        lid: c.lid,
                        isGroup: false,
                    });
                }
            }
            console.log('Found NO HISTORY contacts:', targetItems.length);
        } else {
            const chats = await client.getChats();
            const seenIds = new Set();
            targetItems = [];
            for (const chat of chats) {
                if (excludeGroups && chat.isGroup) continue;
                if (!seenIds.has(chat.id._serialized)) {
                    seenIds.add(chat.id._serialized);
                    targetItems.push({
                        id: chat.id._serialized,
                        name: chat.name,
                        isGroup: chat.isGroup,
                    });
                }
            }
        }

        // 在广播开始前，打印目标列表供确认
        console.log(
            'Broadcast targets preview (first 10):',
            targetItems.slice(0, 10).map((t) => ({ name: t.name, id: t.id })),
        );
        console.log('Total targets:', targetItems.length);

        // 首次发送延迟
        if (randomInterval) {
            const initialDelay = Math.floor(Math.random() * 5000 + 2000); // 2-7秒
            console.log(`Starting broadcast in ${initialDelay}ms...`);
            await new Promise((resolve) => setTimeout(resolve, initialDelay));
        }

        broadcastProgress = {
            running: true,
            current: 0,
            total: targetItems.length,
            results: [],
            message: message,
            interval: interval,
            dailySent: dailySendStats.sent,
            dailyLimit: currentLimitLevel.dailyMax,
            remaining: Math.max(
                0,
                currentLimitLevel.dailyMax - dailySendStats.sent,
            ),
        };

        io.emit('broadcast-progress', broadcastProgress);

        let messageCount = 0;
        let batchCount = 0;
        const limit = currentLimitLevel;

        console.log(`\n===== Starting Safe Broadcast =====`);
        console.log(`Account level: ${accountLevel}`);
        console.log(
            `Daily limit: ${limit.dailyMax}, Already sent: ${dailySendStats.sent}`,
        );
        console.log(
            `Min interval: ${limit.minInterval}ms, Batch size: ${limit.batchSize}`,
        );
        console.log(`===================================\n`);

        for (const item of targetItems) {
            if (!broadcastProgress.running) break;

            // ===== 每次发送前检查每日配额 =====
            const sendCheck = canSend();
            if (!sendCheck.allowed) {
                console.log(
                    `\nDaily limit reached! Sent: ${dailySendStats.sent}/${limit.dailyMax}`,
                );
                io.emit('broadcast-status', {
                    type: 'daily_limit_reached',
                    message: `Daily limit of ${limit.dailyMax} reached. Please wait until tomorrow.`,
                });
                break;
            }

            // 检查是否在允许的发送时间段内
            if (respectHours) {
                const now = new Date();
                const hour = now.getHours();
                if (hour < 9 || hour >= 22) {
                    console.log(
                        'Outside sending hours (9:00-22:00), pausing...',
                    );
                    // 等待到允许时间
                    const waitMinutes =
                        hour < 9 ? (9 - hour) * 60 : (24 - hour + 9) * 60;
                    console.log(
                        `Waiting ${waitMinutes} minutes until 9:00 AM...`,
                    );
                    await new Promise((resolve) =>
                        setTimeout(resolve, waitMinutes * 60 * 1000),
                    );
                }
            }

            // ===== 分批发送：每批后暂停 =====
            if (
                randomPause &&
                messageCount > 0 &&
                messageCount % limit.batchSize === 0
            ) {
                batchCount++;
                const batchPauseTime =
                    limit.batchPause + Math.floor(Math.random() * 30000);
                console.log(
                    `\n=== Batch ${batchCount} complete (${messageCount} messages) ===`,
                );
                console.log(
                    `Taking a batch break for ${Math.round(batchPauseTime / 1000)}s...`,
                );
                console.log(
                    `Remaining quota today: ${canSend().remaining}/${limit.dailyMax}\n`,
                );

                io.emit('broadcast-status', {
                    type: 'batch_pause',
                    batchCount: batchCount,
                    pauseSeconds: Math.round(batchPauseTime / 1000),
                    remaining: canSend().remaining,
                });

                await new Promise((resolve) =>
                    setTimeout(resolve, batchPauseTime),
                );
            }

            try {
                // 随机选择一条消息模板
                let selectedMessage =
                    messages[Math.floor(Math.random() * messages.length)];

                let finalMessage = selectedMessage;
                if (personalize && item.name) {
                    finalMessage = selectedMessage.replace(
                        /{name}/g,
                        item.name,
                    );
                }
                // 如果启用消息随机化，对消息内容进行微调
                if (randomizeMsg) {
                    const randomized = randomizeMessage(
                        finalMessage,
                        null,
                        lengthRandomize,
                    );
                    finalMessage = randomized.message;
                }
                // 使用正确的 chat ID
                let chatId = item.id;
                if (!chatId.includes('@')) {
                    // 如果没有 @，根据 lid 判断格式
                    chatId = item.lid
                        ? item.lid + '@lid'
                        : item.number + '@c.us';
                }
                console.log(
                    `[${messageCount + 1}/${canSend().remaining}] Sending to: ${item.name}`,
                );

                // 如果启用行为模拟，先模拟人类操作
                if (simulateTyping || simulateMouse) {
                    try {
                        await simulatePreSendBehavior(
                            client,
                            chatId,
                            finalMessage,
                            simulateTyping,
                        );
                    } catch (e) {
                        console.log(
                            'Behavior simulation failed, continuing with direct send:',
                            e.message,
                        );
                    }
                }

                await client.sendMessage(chatId, finalMessage);

                // ===== 记录发送成功 =====
                recordSend(true);
                messageCount++;

                broadcastProgress.results.push({
                    name: item.name,
                    status: 'success',
                });

                // 实时更新配额
                broadcastProgress.dailySent = dailySendStats.sent;
                broadcastProgress.remaining = Math.max(
                    0,
                    limit.dailyMax - dailySendStats.sent,
                );
            } catch (e) {
                recordSend(false);
                broadcastProgress.results.push({
                    name: item.name,
                    status: 'failed',
                    error: e.message,
                });
                console.log(`Failed to send to ${item.name}: ${e.message}`);
            }

            broadcastProgress.current++;
            io.emit('broadcast-progress', broadcastProgress);

            // ===== 计算随机间隔（强制最小间隔 + 人类作息模拟） =====
            let actualInterval = interval;

            // 强制最小间隔（基于账户级别）
            const forcedMinInterval = limit.minInterval;

            if (randomInterval) {
                // 基础随机：在基础间隔的 ±30% 范围内随机
                let randomMax = Math.max(interval, forcedMinInterval) * 1.5;
                let randomMin = Math.max(
                    forcedMinInterval * 0.8,
                    interval * 0.7,
                );
                actualInterval = Math.floor(
                    Math.random() * (randomMax - randomMin) + randomMin,
                );

                // 确保不小于最小间隔
                actualInterval = Math.max(actualInterval, forcedMinInterval);

                // 模拟人类作息：根据当前时间调整发送速度
                const now = new Date();
                const hour = now.getHours();
                const dayOfWeek = now.getDay(); // 0=周日, 1=周一, ...

                // 工作时间（9-12点，14-18点）发送更快
                const isWorkHours =
                    (hour >= 9 && hour < 12) || (hour >= 14 && hour < 18);
                // 午休时间（12-14点）发送较慢
                const isLunchTime = hour >= 12 && hour < 14;
                // 晚上（18-22点）发送最慢
                const isEvening = hour >= 18 && hour < 22;
                // 周末发送更慢
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                if (isWorkHours && !isWeekend) {
                    actualInterval = Math.max(
                        forcedMinInterval,
                        actualInterval * 0.9,
                    );
                } else if (isLunchTime) {
                    actualInterval = actualInterval * 1.3;
                } else if (isEvening) {
                    actualInterval = actualInterval * 1.5;
                }

                if (isWeekend) {
                    actualInterval = actualInterval * 1.3;
                }

                // 随机"休息"：模拟人类去喝水、上厕所等
                if (Math.random() < 0.05) {
                    // 5%概率
                    const breakTime = Math.floor(Math.random() * 30000 + 10000); // 10-40秒休息
                    console.log(`Taking a human break for ${breakTime}ms...`);
                    await new Promise((resolve) =>
                        setTimeout(resolve, breakTime),
                    );
                }
            } else {
                // 非随机模式：直接使用最大间隔
                actualInterval = Math.max(interval, forcedMinInterval);
            }

            // 确保间隔不小于最小限制
            actualInterval = Math.max(actualInterval, forcedMinInterval);

            if (messageCount % 10 === 0) {
                console.log(
                    `Progress: ${messageCount} sent, ${canSend().remaining} remaining today`,
                );
            }

            await new Promise((resolve) =>
                setTimeout(resolve, Math.floor(actualInterval)),
            );
        }

        console.log(`\n===== Broadcast Complete =====`);
        console.log(
            `Total sent today: ${dailySendStats.sent}/${limit.dailyMax}`,
        );
        console.log(`============================\n`);

        broadcastProgress.running = false;
        io.emit('broadcast-progress', broadcastProgress);

        res.json({
            success: true,
            progress: broadcastProgress,
            dailyStats: getDailyStats(),
        });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/broadcast-stop', (req, res) => {
    broadcastProgress.running = false;
    // 重置进度，让前端可以重新开始
    broadcastProgress.current = 0;
    broadcastProgress.total = 0;
    broadcastProgress.results = [];
    io.emit('broadcast-progress', broadcastProgress);
    res.json({ success: true });
});

app.get('/api/broadcast-status', (req, res) => {
    res.json(broadcastProgress);
});

app.get('/api/daily-stats', (req, res) => {
    res.json(getDailyStats());
});

app.post('/api/set-account-level', (req, res) => {
    const { level } = req.body;
    setAccountLevel(level);
    res.json({ success: true, level, dailyMax: currentLimitLevel.dailyMax });
});

app.get('/api/auto-reply', (req, res) => {
    res.json({ rules: autoReplyRules });
});

app.post('/api/auto-reply', (req, res) => {
    const { keyword, reply, matchType, enabled } = req.body;
    const rule = {
        id: Date.now(),
        keyword,
        reply,
        matchType: matchType || 'keyword',
        enabled: enabled !== false,
    };
    autoReplyRules.push(rule);
    res.json({ success: true, rule });
});

app.post('/api/auto-reply/:id', (req, res) => {
    const { id } = req.params;
    const { keyword, reply, matchType, enabled } = req.body;

    const rule = autoReplyRules.find((r) => r.id == id);
    if (rule) {
        if (keyword) rule.keyword = keyword;
        if (reply) rule.reply = reply;
        if (matchType) rule.matchType = matchType;
        if (enabled !== undefined) rule.enabled = enabled;
        res.json({ success: true, rule });
    } else {
        res.json({ success: false, error: 'Rule not found' });
    }
});

app.delete('/api/auto-reply/:id', (req, res) => {
    const { id } = req.params;
    autoReplyRules = autoReplyRules.filter((r) => r.id != id);
    res.json({ success: true });
});

app.get('/api/scheduled-tasks', (req, res) => {
    res.json({ tasks: scheduledTasks });
});

app.post('/api/scheduled-tasks', (req, res) => {
    const { name, message, targetType, type, time, hour, minute } = req.body;

    const task = {
        id: Date.now(),
        name,
        message,
        targetType: targetType || 'all',
        type: type || 'once',
        time,
        hour: hour || 9,
        minute: minute || 0,
        running: false,
    };

    scheduledTasks.push(task);

    if (clientStatus === 'ready') {
        startScheduledTasks();
    }

    res.json({ success: true, task });
});

app.delete('/api/scheduled-tasks/:id', (req, res) => {
    const { id } = req.params;
    const task = scheduledTasks.find((t) => t.id == id);
    if (task && task.timeout) {
        clearTimeout(task.timeout);
    }
    scheduledTasks = scheduledTasks.filter((t) => t.id != id);
    res.json({ success: true });
});

app.get('/api/contacts', async (req, res) => {
    if (!client || clientStatus !== 'ready') {
        return res.json({ contacts: [] });
    }
    try {
        const contacts = await client.getContacts();
        res.json({
            contacts: contacts.map((c) => ({
                id: c.id?._serialized || c.id,
                name: c.name,
                pushname: c.pushname,
            })),
        });
    } catch (e) {
        res.json({ contacts: [], error: e.message });
    }
});

app.post('/api/group/create', async (req, res) => {
    const { name, participants } = req.body;

    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }

    try {
        const result = await client.createGroup(name, participants);
        res.json({ success: true, result });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/group/:id/add', async (req, res) => {
    const { id } = req.params;
    const { participants } = req.body;

    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }

    try {
        const chat = await client.getChatById(id);
        const result = await chat.addParticipants(participants);
        res.json({ success: true, result });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/group/:id/remove', async (req, res) => {
    const { id } = req.params;
    const { participants } = req.body;

    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }

    try {
        const chat = await client.getChatById(id);
        for (const participant of participants) {
            await chat.removeParticipants([participant]);
        }
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/group/:id/leave', async (req, res) => {
    const { id } = req.params;

    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }

    try {
        const chat = await client.getChatById(id);
        await chat.leave();
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/chat/:id/mark-seen', async (req, res) => {
    const { id } = req.params;

    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }

    try {
        const chat = await client.getChatById(id);
        await chat.sendSeen();
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/chat/:id/pin', async (req, res) => {
    const { id } = req.params;
    const { pin } = req.body;

    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }

    try {
        const chat = await client.getChatById(id);
        if (pin) {
            await chat.pin();
        } else {
            await chat.unpin();
        }
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/chat/:id/archive', async (req, res) => {
    const { id } = req.params;

    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }

    try {
        const chat = await client.getChatById(id);
        await chat.archive();
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/chat/:id/mute', async (req, res) => {
    const { id } = req.params;
    const { duration } = req.body;

    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }

    try {
        const chat = await client.getChatById(id);
        const unmuteDate = new Date(Date.now() + (duration || 3600000));
        await chat.mute(unmuteDate);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/chat/:id/unmute', async (req, res) => {
    const { id } = req.params;

    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }

    try {
        const chat = await client.getChatById(id);
        await chat.unmute();
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.get('/api/chat/:id/messages', async (req, res) => {
    const { id } = req.params;
    const { limit = 50 } = req.query;

    if (!client || clientStatus !== 'ready') {
        return res.json({ error: 'Client not ready' });
    }

    try {
        const chat = await client.getChatById(id);
        const messages = await chat.fetchMessages({ limit: parseInt(limit) });
        res.json({
            messages: messages.map((m) => ({
                id: m.id._serialized,
                body: m.body,
                type: m.type,
                from: m.from,
                fromMe: m.fromMe,
                timestamp: m.timestamp,
                hasMedia: m.hasMedia,
            })),
        });
    } catch (e) {
        res.json({ error: e.message });
    }
});

app.delete('/api/message/:id', async (req, res) => {
    const { id } = req.params;
    const { deleteForEveryone = true } = req.body;

    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }

    try {
        const message = await client.getMessageById(id);
        if (message) {
            await message.delete(deleteForEveryone);
            res.json({ success: true });
        } else {
            res.json({ success: false, error: 'Message not found' });
        }
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/message/:id/react', async (req, res) => {
    const { id } = req.params;
    const { reaction } = req.body;

    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }

    try {
        const message = await client.getMessageById(id);
        if (message) {
            await message.react(reaction);
            res.json({ success: true });
        } else {
            res.json({ success: false, error: 'Message not found' });
        }
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/message/:id/forward', async (req, res) => {
    const { id } = req.params;
    const { chatId } = req.body;

    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }

    try {
        const message = await client.getMessageById(id);
        if (message) {
            await message.forward(chatId);
            res.json({ success: true });
        } else {
            res.json({ success: false, error: 'Message not found' });
        }
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.get('/api/contact/:id', async (req, res) => {
    const { id } = req.params;

    if (!client || clientStatus !== 'ready') {
        return res.json({ error: 'Client not ready' });
    }

    try {
        const contact = await client.getContactById(id);
        res.json({
            contact: {
                id: contact.id?._serialized || contact.id,
                name: contact.name,
                pushname: contact.pushname,
                profilePicUrl: contact.profilePicUrl,
                isMe: contact.isMe,
                isUser: contact.isUser,
                isGroup: contact.isGroup,
                isWAContact: contact.isWAContact,
                isBusiness: contact.isBusiness,
            },
        });
    } catch (e) {
        res.json({ error: e.message });
    }
});

app.get('/api/contact/:id/profile-pic', async (req, res) => {
    const { id } = req.params;

    if (!client || clientStatus !== 'ready') {
        return res.json({ error: 'Client not ready' });
    }

    try {
        const profilePicUrl = await client.getProfilePicUrl(id);
        res.json({ profilePicUrl });
    } catch (e) {
        res.json({ profilePicUrl: null });
    }
});

app.post('/api/group/:id/set-description', async (req, res) => {
    const { id } = req.params;
    const { description } = req.body;

    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }

    try {
        const chat = await client.getChatById(id);
        await chat.setDescription(description);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/group/:id/set-subject', async (req, res) => {
    const { id } = req.params;
    const { subject } = req.body;

    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }

    try {
        const chat = await client.getChatById(id);
        await chat.setSubject(subject);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/group/:id/promote-admin', async (req, res) => {
    const { id } = req.params;
    const { participants } = req.body;

    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }

    try {
        const chat = await client.getChatById(id);
        for (const participant of participants) {
            await chat.promoteParticipant(participant);
        }
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/group/:id/demote-admin', async (req, res) => {
    const { id } = req.params;
    const { participants } = req.body;

    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }

    try {
        const chat = await client.getChatById(id);
        for (const participant of participants) {
            await chat.demoteParticipant(participant);
        }
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.get('/api/group/:id/invite-code', async (req, res) => {
    const { id } = req.params;

    if (!client || clientStatus !== 'ready') {
        return res.json({ error: 'Client not ready' });
    }

    try {
        const inviteCode = await client.getInviteCode(id);
        res.json({ inviteCode });
    } catch (e) {
        res.json({ error: e.message });
    }
});

app.get('/api/stats', async (req, res) => {
    if (!client || clientStatus !== 'ready') {
        return res.json({ error: 'Client not ready' });
    }

    try {
        const chats = await client.getChats();

        let privateChats = 0;
        let groupChats = 0;
        // eslint-disable-next-line no-unused-vars
        let totalMessages = 0;
        let groupsWithMembers = {};

        for (const chat of chats) {
            if (chat.isGroup) {
                groupChats++;
                groupsWithMembers[chat.name] = chat.participants?.length || 0;
            } else {
                privateChats++;
            }
        }

        res.json({
            stats: {
                totalChats: chats.length,
                privateChats,
                groupChats,
                topGroups: Object.entries(groupsWithMembers)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10),
            },
        });
    } catch (e) {
        res.json({ error: e.message });
    }
});

app.get('/api/broadcast-logs', (req, res) => {
    res.json({ logs: broadcastProgress });
});

app.post('/api/send-location', async (req, res) => {
    const { chatId, latitude, longitude, title } = req.body;

    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }

    try {
        const location = new (require('./index').Location)(
            latitude,
            longitude,
            { name: title },
        );
        await client.sendMessage(chatId, location);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/send-contact', async (req, res) => {
    const { chatId, contactId } = req.body;

    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }

    try {
        const contact = await client.getContactById(contactId);
        const vCard = `BEGIN:VCARD\nVERSION:3.0\nFN:${contact.name || contact.pushname}\nEND:VCARD`;
        const { MessageMedia } = require('./index');
        const media = new MessageMedia('text/vcard', vCard);
        await client.sendMessage(chatId, media);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/send-poll', async (req, res) => {
    const { chatId, question, options, allowMultipleAnswers } = req.body;

    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }

    try {
        const { Poll } = require('./index');
        const poll = new Poll(question, options, { allowMultipleAnswers });
        await client.sendMessage(chatId, poll);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.get('/api/search-messages', async (req, res) => {
    const { query, chatId } = req.query;

    if (!client || clientStatus !== 'ready') {
        return res.json({ error: 'Client not ready' });
    }

    try {
        const chats = await client.getChats();
        let results = [];

        for (const chat of chats) {
            if (chatId && chat.id._serialized !== chatId) continue;

            const messages = await chat.fetchMessages({ limit: 100 });
            const matched = messages.filter(
                (m) =>
                    m.body &&
                    m.body.toLowerCase().includes(query.toLowerCase()),
            );

            results = results.concat(
                matched.map((m) => ({
                    id: m.id._serialized,
                    body: m.body,
                    chatId: chat.id._serialized,
                    chatName: chat.name,
                    timestamp: m.timestamp,
                    fromMe: m.fromMe,
                })),
            );

            if (results.length >= 50) break;
        }

        res.json({ results: results.slice(0, 50) });
    } catch (e) {
        res.json({ error: e.message });
    }
});

app.get('/api/channel/list', async (req, res) => {
    if (!client || clientStatus !== 'ready') {
        return res.json({ channels: [] });
    }

    try {
        const chats = await client.getChats();
        const channels = chats.filter((c) => c.isChannel);
        res.json({
            channels: channels.map((c) => ({
                id: c.id._serialized,
                name: c.name,
                description: c.description,
            })),
        });
    } catch (e) {
        res.json({ channels: [], error: e.message });
    }
});

app.post('/api/channel/create', async (req, res) => {
    const { name, description } = req.body;

    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }

    try {
        const result = await client.createChannel(name, description);
        res.json({ success: true, result });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/join-group', async (req, res) => {
    const { inviteCode } = req.body;

    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }

    try {
        await client.acceptInvite(inviteCode);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.get('/api/chat/:id/pin-message', async (req, res) => {
    const { id } = req.params;
    const { duration = 604800 } = req.query;

    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }

    try {
        const message = await client.getMessageById(id);
        if (message) {
            const result = await message.pin(parseInt(duration));
            res.json({ success: result });
        } else {
            res.json({ success: false, error: 'Message not found' });
        }
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.get('/api/chat/:id/unpin-message', async (req, res) => {
    const { id } = req.params;

    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }

    try {
        const message = await client.getMessageById(id);
        if (message) {
            const result = await message.unpin();
            res.json({ success: result });
        } else {
            res.json({ success: false, error: 'Message not found' });
        }
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/profile/update-name', async (req, res) => {
    const { name } = req.body;

    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }

    try {
        await client.setDisplayName(name);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/profile/update-status', async (req, res) => {
    const { status } = req.body;

    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }

    try {
        await client.setStatus(status);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/block/:id', async (req, res) => {
    const { id } = req.params;

    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }

    try {
        await client.blockContact(id);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/unblock/:id', async (req, res) => {
    const { id } = req.params;

    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }

    try {
        await client.unblockContact(id);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/send-sticker', async (req, res) => {
    const { chatId, filePath, url } = req.body;

    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }

    try {
        let media;
        if (url) {
            media = await MessageMedia.fromUrl(url);
        } else if (filePath) {
            media = MessageMedia.fromFilePath(filePath);
        }

        if (!media) {
            return res.json({ success: false, error: 'No media provided' });
        }

        await client.sendMessage(chatId, media, { sendMediaAsSticker: true });
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.get('/api/labels', async (req, res) => {
    if (!client || clientStatus !== 'ready') {
        return res.json({ labels: [] });
    }

    try {
        const labels = await client.getLabels();
        res.json({
            labels: labels.map((l) => ({
                id: l.id,
                name: l.name,
                color: l.color,
            })),
        });
    } catch (e) {
        res.json({ labels: [], error: e.message });
    }
});

app.post('/api/chat/:id/label', async (req, res) => {
    const { id } = req.params;
    const { labelId, action } = req.body;

    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }

    try {
        if (action === 'add') {
            await client.addOrRemoveLabels([labelId], [id]);
        } else {
            await client.addOrRemoveLabels([], [id]);
        }
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

io.on('connection', (socket) => {
    socket.emit('status', { status: clientStatus, qr: qrCode });
    socket.emit('broadcast-progress', broadcastProgress);
    socket.emit('auto-reply-rules', { rules: autoReplyRules });
    socket.emit('scheduled-tasks', { tasks: scheduledTasks });
    socket.emit('contact-test-progress', contactTestLoop);
});

// 全局错误处理
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // 防止服务器崩溃，记录错误但继续运行
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // 防止服务器崩溃，记录错误但继续运行
});

const PORT = 3003;
server.listen(PORT, () => {
    console.log(`Web interface running at http://localhost:${PORT}`);
});
