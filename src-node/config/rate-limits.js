const SAFE_LIMITS = {
    NEW_ACCOUNT: {
        name: 'new',
        label: '新账号',
        dailyMax: parseInt(process.env.RATE_NEW_DAILY, 10) || 30,
        batchSize: parseInt(process.env.RATE_NEW_BATCH_SIZE, 10) || 8,
        batchPause: parseInt(process.env.RATE_NEW_BATCH_PAUSE, 10) || 60000,
    },
    ESTABLISHED_ACCOUNT: {
        name: 'established',
        label: '稳定账号',
        dailyMax: parseInt(process.env.RATE_ESTABLISHED_DAILY, 10) || 80,
        batchSize: parseInt(process.env.RATE_ESTABLISHED_BATCH_SIZE, 10) || 15,
        batchPause: parseInt(process.env.RATE_ESTABLISHED_BATCH_PAUSE, 10) || 45000,
    },
    MATURE_ACCOUNT: {
        name: 'mature',
        label: '成熟账号',
        dailyMax: parseInt(process.env.RATE_MATURE_DAILY, 10) || 150,
        batchSize: parseInt(process.env.RATE_MATURE_BATCH_SIZE, 10) || 20,
        batchPause: parseInt(process.env.RATE_MATURE_BATCH_PAUSE, 10) || 30000,
    },
};

module.exports = { SAFE_LIMITS };