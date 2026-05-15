module.exports = {
    server: {
        port: parseInt(process.env.NODE_PORT, 10) || 3003,
        jsonLimit: '50mb',
    },
    env: process.env.NODE_ENV || 'development',
    whatsapp: {
        authPath: process.env.WA_AUTH_PATH || './.wwebjs_auth_v2',
        headless: process.env.WA_HEADLESS === 'true',
        timeout: parseInt(process.env.WA_TIMEOUT, 10) || 120000,
        puppeteerArgs: [
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
            `--lang=${process.env.WA_BROWSER_LANG || 'en-US,en'}`,
            `--window-size=${process.env.WA_WINDOW_WIDTH || 1920},${process.env.WA_WINDOW_HEIGHT || 1080}`,
        ],
    },
    broadcast: {
        defaultInterval: parseInt(process.env.BROADCAST_DEFAULT_INTERVAL, 10) || 10000,
        randomInterval: process.env.BROADCAST_RANDOM_INTERVAL !== 'false',
        respectHours: process.env.BROADCAST_RESPECT_HOURS !== 'false',
        randomPause: process.env.BROADCAST_RANDOM_PAUSE !== 'false',
        excludeGroups: process.env.BROADCAST_EXCLUDE_GROUPS !== 'false',
    },
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        filePath: process.env.LOG_FILE_PATH || './logs/app.log',
    },
    database: {
        path: process.env.DB_PATH || './data/bot.db',
    },
};