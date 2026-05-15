const { canSend, recordSend, getCurrentLimit } = require('./rate-limiter');
const { randomizeMessage } = require('./message-randomizer');
const { simulatePreSendBehavior } = require('../simulators/behavior');
const logger = require('../utils/logger');

// 广播进度按 clientId 隔离存储
const broadcastProgressMap = new Map();

function getProgress(clientId = 'default') {
    if (!broadcastProgressMap.has(clientId)) {
        broadcastProgressMap.set(clientId, {
            running: false,
            current: 0,
            total: 0,
            results: [],
            message: null,
            currentTarget: null,
            interval: 10000,
            dailySent: 0,
            dailyLimit: 0,
            remaining: 0,
        });
    }
    return broadcastProgressMap.get(clientId);
}

function getBroadcastProgress(clientId = 'default') {
    return getProgress(clientId);
}

function stopBroadcast(clientId = 'default') {
    const progress = getProgress(clientId);
    progress.running = false;
}

function calculateInterval(baseInterval, randomInterval, limit) {
    const forcedMinInterval = limit.minInterval;
    let actualInterval = baseInterval;

    if (randomInterval) {
        let randomMax = Math.max(baseInterval, forcedMinInterval) * 1.5;
        let randomMin = Math.max(forcedMinInterval * 0.8, baseInterval * 0.7);
        actualInterval = Math.floor(
            Math.random() * (randomMax - randomMin) + randomMin,
        );
        actualInterval = Math.max(actualInterval, forcedMinInterval);

        const now = new Date();
        const hour = now.getHours();
        const dayOfWeek = now.getDay();

        const isWorkHours =
            (hour >= 9 && hour < 12) || (hour >= 14 && hour < 18);
        const isLunchTime = hour >= 12 && hour < 14;
        const isEvening = hour >= 18 && hour < 22;
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        if (isWorkHours && !isWeekend) {
            actualInterval = Math.max(forcedMinInterval, actualInterval * 0.9);
        } else if (isLunchTime) {
            actualInterval = actualInterval * 1.3;
        } else if (isEvening) {
            actualInterval = actualInterval * 1.5;
        }

        if (isWeekend) {
            actualInterval = actualInterval * 1.3;
        }

        if (Math.random() < 0.05) {
            const breakTime = Math.floor(Math.random() * 30000 + 10000);
            return { interval: actualInterval, breakTime };
        }
    } else {
        actualInterval = Math.max(baseInterval, forcedMinInterval);
    }

    return {
        interval: Math.max(actualInterval, forcedMinInterval),
        breakTime: 0,
    };
}

async function runBroadcast(client, options, io) {
    const {
        targetItems,
        interval = 10000,
        randomInterval = true,
        randomizeMsg = true,
        lengthRandomize = true,
        simulateTyping = false,
        simulateMouse = false,
        respectHours = true,
        randomPause = true,
        personalize = false,
        clientId = 'default',
    } = options;
    let { messages } = options;

    logger.info(`[runBroadcast] Starting for client=${clientId}, targets=${(targetItems || []).length}, msgs=${(messages || []).length}`);

    const broadcastProgress = getProgress(clientId);

    if (broadcastProgress.running) {
        throw new Error('Broadcast already running');
    }

    // 过滤无效消息，避免 undefined 导致崩溃
    messages = (messages || []).filter(m => typeof m === 'string' && m.trim());
    if (messages.length === 0) {
        broadcastProgress.running = false;
        throw new Error('没有有效的消息内容');
    }

    logger.info(`[runBroadcast] After filter: ${messages.length} valid messages, first: "${messages[0].substring(0, 30)}..."`);

    const limit = getCurrentLimit();

    broadcastProgress.running = true;
    broadcastProgress.current = 0;
    broadcastProgress.total = targetItems.length;
    broadcastProgress.results = [];
    broadcastProgress.message = messages[0];
    broadcastProgress.currentTarget = null;
    broadcastProgress.interval = interval;
    broadcastProgress.dailySent = 0;
    broadcastProgress.dailyLimit = limit.dailyMax;
    broadcastProgress.remaining = limit.dailyMax;

    logger.info(`Broadcast started: client=${clientId}, total=${targetItems.length}, interval=${interval}ms`);

    io.emit('broadcast-progress', broadcastProgress);

    let messageCount = 0;
    let batchCount = 0;

    for (const item of targetItems) {
        if (!broadcastProgress.running) {
            logger.info(`Broadcast stopped by user for client ${clientId}, progress: ${broadcastProgress.current}/${broadcastProgress.total}`);
            break;
        }

        // 广播当前正在发送的联系人
        io.emit('broadcast-current', {
            name: item.name,
            number: item.number,
            index: broadcastProgress.current + 1,
            total: broadcastProgress.total,
            status: 'sending',
        });
        broadcastProgress.currentTarget = {
            name: item.name,
            number: item.number,
            index: broadcastProgress.current + 1,
            total: broadcastProgress.total,
            status: 'sending',
        };

        const sendCheck = canSend();
        if (!sendCheck.allowed) {
            logger.info(`Broadcast daily limit reached for client ${clientId}, sent=${sendCheck.sent}/${limit.dailyMax}`);
            io.emit('broadcast-status', {
                type: 'daily_limit_reached',
                message: `Daily limit of ${limit.dailyMax} reached.`,
            });
            break;
        }

        if (respectHours) {
            const now = new Date();
            const hour = now.getHours();
            if (hour < 9 || hour >= 22) {
                const waitMinutes = hour < 9
                    ? (9 - hour) * 60
                    : (24 - hour + 9) * 60
                const resumeTime = new Date(now.getTime() + waitMinutes * 60 * 1000)
                io.emit('broadcast-status', {
                    type: 'outside_hours',
                    message: `当前不在发送时段（9:00-22:00），将在 ${resumeTime.toLocaleTimeString('zh-CN')} 自动恢复`,
                    resumeTime: resumeTime.toISOString(),
                    waitMinutes,
                })
                await new Promise((r) =>
                    setTimeout(r, waitMinutes * 60 * 1000),
                )
            }
        }

        if (
            randomPause &&
            messageCount > 0 &&
            messageCount % limit.batchSize === 0
        ) {
            batchCount++;
            const batchPauseTime =
                limit.batchPause + Math.floor(Math.random() * 30000);
            io.emit('broadcast-status', {
                type: 'batch_pause',
                batchCount,
                pauseSeconds: Math.round(batchPauseTime / 1000),
                remaining: sendCheck.remaining,
            });
            await new Promise((r) => setTimeout(r, batchPauseTime));
        }

        try {
            let selectedMessage =
                messages[Math.floor(Math.random() * messages.length)];
            let finalMessage =
                personalize && item.name
                    ? selectedMessage.replace(/{name}/g, item.name)
                    : selectedMessage;

            if (randomizeMsg) {
                const randomized = randomizeMessage(
                    finalMessage,
                    null,
                    lengthRandomize,
                );
                finalMessage = randomized.message;
            }

            let chatId = item.id;
            if (!chatId.includes('@')) {
                chatId = item.lid ? item.lid + '@lid' : item.number + '@c.us';
            }

            if (simulateTyping) {
                try {
                    await simulatePreSendBehavior(
                        client,
                        chatId,
                        finalMessage,
                        true,
                        simulateMouse,
                    );
                    await client.pupPage.keyboard.press('Enter');
                    await new Promise((r) => setTimeout(r, 500));
                } catch (e) {
                    logger.info('Behavior simulation failed:', { data: e.message });
                    await client.sendMessage(chatId, finalMessage);
                }
            } else if (simulateMouse) {
                try {
                    await simulatePreSendBehavior(
                        client,
                        chatId,
                        finalMessage,
                        false,
                        true,
                    );
                } catch (e) {
                    logger.info('Mouse simulation failed:', { data: e.message });
                }
                await client.sendMessage(chatId, finalMessage);
            } else {
                await client.sendMessage(chatId, finalMessage);
            }
            recordSend(true);
            messageCount++;

            broadcastProgress.results.push({
                name: item.name,
                status: 'success',
            });
            broadcastProgress.currentTarget.status = 'success';
            broadcastProgress.dailySent = sendCheck.sent + 1;
            broadcastProgress.remaining = Math.max(
                0,
                limit.dailyMax - broadcastProgress.dailySent,
            );

            // 广播成功状态
            io.emit('broadcast-current', {
                name: item.name,
                number: item.number,
                index: broadcastProgress.current + 1,
                total: broadcastProgress.total,
                status: 'success',
            });
        } catch (e) {
            recordSend(false);
            broadcastProgress.results.push({
                name: item.name,
                status: 'failed',
                error: e.message,
            });
            broadcastProgress.currentTarget.status = 'failed';

            // 广播失败状态
            io.emit('broadcast-current', {
                name: item.name,
                number: item.number,
                index: broadcastProgress.current + 1,
                total: broadcastProgress.total,
                status: 'failed',
                error: e.message,
            });
        }

        broadcastProgress.current++;
        io.emit('broadcast-progress', broadcastProgress);

        const { interval: actualInterval, breakTime } = calculateInterval(
            interval,
            randomInterval,
            limit,
        );
        if (breakTime > 0) {
            await new Promise((r) => setTimeout(r, breakTime));
        }
        await new Promise((r) => setTimeout(r, Math.floor(actualInterval)));
    }

    broadcastProgress.running = false;
    logger.info(`Broadcast finished for client ${clientId}: success=${messageCount}/${broadcastProgress.total}, failed=${broadcastProgress.current - messageCount}`);
    io.emit('broadcast-progress', broadcastProgress);

    return {
        success: true,
        progress: broadcastProgress,
        dailyStats: { sent: messageCount },
    };
}

module.exports = {
    getBroadcastProgress,
    stopBroadcast,
    runBroadcast,
    calculateInterval,
};
