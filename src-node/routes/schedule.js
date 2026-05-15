const logger = require('../utils/logger');

function createScheduleRoutes(app, clientRef, clientState) {
    const scheduledTasks = new Map();
    let taskInterval = null;

    // 获取所有定时任务
    app.get('/api/scheduled-tasks', (req, res) => {
        const tasks = Array.from(scheduledTasks.entries()).map(([id, task]) => ({
            id,
            ...task
        }));
        res.json({ tasks });
    });

    // 添加定时任务
    app.post('/api/scheduled-tasks', (req, res) => {
        const { name, type, time, dailyTime, message, target } = req.body;
        
        if (!name || !message) {
            return res.json({ success: false, error: '任务名称和消息内容不能为空' });
        }

        const id = Date.now().toString();
        const task = {
            name,
            type: type || 'once',
            time: time || null,
            dailyTime: dailyTime || null,
            message,
            target: target || 'all',
            enabled: true,
            lastRun: null,
            nextRun: calculateNextRun(type, time, dailyTime)
        };

        scheduledTasks.set(id, task);
        startTaskScheduler();
        
        res.json({ success: true, id, task });
    });

    // 删除定时任务
    app.delete('/api/scheduled-tasks/:id', (req, res) => {
        const { id } = req.params;
        scheduledTasks.delete(id);
        
        if (scheduledTasks.size === 0) {
            stopTaskScheduler();
        }
        
        res.json({ success: true });
    });

    // 启用/禁用任务
    app.post('/api/scheduled-tasks/:id/toggle', (req, res) => {
        const { id } = req.params;
        const { enabled } = req.body;
        
        const task = scheduledTasks.get(id);
        if (!task) {
            return res.json({ success: false, error: '任务不存在' });
        }

        task.enabled = enabled;
        if (enabled) {
            task.nextRun = calculateNextRun(task.type, task.time, task.dailyTime);
        }
        
        res.json({ success: true });
    });

    function calculateNextRun(type, time, dailyTime) {
        const now = new Date();
        
        if (type === 'once' && time) {
            return new Date(time);
        } else if (type === 'daily' && dailyTime) {
            const [hours, minutes] = dailyTime.split(':').map(Number);
            const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
            if (next <= now) {
                next.setDate(next.getDate() + 1);
            }
            return next;
        }
        
        return null;
    }

    function startTaskScheduler() {
        if (taskInterval) return;
        
        taskInterval = setInterval(async () => {
            const now = new Date();
            
            for (const [id, task] of scheduledTasks) {
                if (!task.enabled || !task.nextRun) continue;
                
                if (now >= new Date(task.nextRun)) {
                    await executeTask(task);
                    task.lastRun = now.toISOString();
                    
                    if (task.type === 'daily') {
                        task.nextRun = calculateNextRun(task.type, task.time, task.dailyTime);
                    } else {
                        task.enabled = false;
                    }
                }
            }
        }, 60000); // 每分钟检查一次
    }

    function stopTaskScheduler() {
        if (taskInterval) {
            clearInterval(taskInterval);
            taskInterval = null;
        }
    }

    async function executeTask(task) {
        if (!clientRef.client || clientState.status !== 'ready') {
            logger.info('Client not ready, skipping scheduled task');
            return;
        }

        try {
            let targets = [];
            const chats = await clientRef.client.getChats();
            
            switch (task.target) {
                case 'private':
                    targets = chats.filter(c => !c.isGroup);
                    break;
                case 'groups':
                    targets = chats.filter(c => c.isGroup);
                    break;
                case 'all':
                default:
                    targets = chats;
                    break;
            }

            for (const chat of targets) {
                try {
                    await chat.sendMessage(task.message);
                    await new Promise(r => setTimeout(r, 1000));
                } catch (e) {
                    logger.error('Scheduled task send error:', { error: e.message, stack: e.stack });
                }
            }
        } catch (e) {
            logger.error('Scheduled task execution error:', { error: e.message, stack: e.stack });
        }
    }
}

module.exports = { createScheduleRoutes };
