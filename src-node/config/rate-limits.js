const SAFE_LIMITS = {
    NEW_ACCOUNT: {
        name: 'new',
        label: '新账号',
        dailyMax: parseInt(process.env.RATE_NEW_DAILY, 10) || 30,
        hourlyMax: parseInt(process.env.RATE_NEW_HOURLY, 10) || 5,
        minInterval: parseInt(process.env.RATE_NEW_MIN_INTERVAL, 10) || 60000,
        batchSize: parseInt(process.env.RATE_NEW_BATCH_SIZE, 10) || 5,
        batchPause: parseInt(process.env.RATE_NEW_BATCH_PAUSE, 10) || 180000,
    },
    ESTABLISHED_ACCOUNT: {
        name: 'established',
        label: '稳定账号',
        dailyMax: parseInt(process.env.RATE_ESTABLISHED_DAILY, 10) || 80,
        hourlyMax: parseInt(process.env.RATE_ESTABLISHED_HOURLY, 10) || 10,
        minInterval: parseInt(process.env.RATE_ESTABLISHED_MIN_INTERVAL, 10) || 30000,
        batchSize: parseInt(process.env.RATE_ESTABLISHED_BATCH_SIZE, 10) || 10,
        batchPause: parseInt(process.env.RATE_ESTABLISHED_BATCH_PAUSE, 10) || 120000,
    },
    MATURE_ACCOUNT: {
        name: 'mature',
        label: '成熟账号',
        dailyMax: parseInt(process.env.RATE_MATURE_DAILY, 10) || 150,
        hourlyMax: parseInt(process.env.RATE_MATURE_HOURLY, 10) || 20,
        minInterval: parseInt(process.env.RATE_MATURE_MIN_INTERVAL, 10) || 20000,
        batchSize: parseInt(process.env.RATE_MATURE_BATCH_SIZE, 10) || 15,
        batchPause: parseInt(process.env.RATE_MATURE_BATCH_PAUSE, 10) || 60000,
    },
};

module.exports = { SAFE_LIMITS };