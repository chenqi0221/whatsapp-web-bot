function createAutoReplyRoutes(app, clientRef, clientState) {
    const autoReplies = new Map();
    let autoReplyEnabled = false;
    let replyHandler = null;

    // 获取所有自动回复规则
    app.get('/api/auto-reply', (req, res) => {
        const rules = Array.from(autoReplies.entries()).map(([id, rule]) => ({
            id,
            ...rule
        }));
        res.json({ rules, enabled: autoReplyEnabled });
    });

    // 添加自动回复规则
    app.post('/api/auto-reply', (req, res) => {
        const { keyword, reply, matchType = 'keyword' } = req.body;
        
        if (!keyword || !reply) {
            return res.json({ success: false, error: '关键词和回复内容不能为空' });
        }

        const id = Date.now().toString();
        autoReplies.set(id, { keyword, reply, matchType });
        
        res.json({ success: true, id });
    });

    // 更新自动回复规则
    app.put('/api/auto-reply/:id', (req, res) => {
        const { id } = req.params;
        const { keyword, reply, matchType } = req.body;
        
        if (!autoReplies.has(id)) {
            return res.json({ success: false, error: '规则不存在' });
        }

        autoReplies.set(id, { 
            ...autoReplies.get(id),
            ...(keyword && { keyword }),
            ...(reply && { reply }),
            ...(matchType && { matchType })
        });
        
        res.json({ success: true });
    });

    // 删除自动回复规则
    app.delete('/api/auto-reply/:id', (req, res) => {
        const { id } = req.params;
        autoReplies.delete(id);
        res.json({ success: true });
    });

    // 启用/禁用自动回复
    app.post('/api/auto-reply/toggle', (req, res) => {
        const { enabled } = req.body;
        autoReplyEnabled = enabled;

        if (enabled) {
            setupAutoReply();
        } else {
            removeAutoReply();
        }

        res.json({ success: true, enabled: autoReplyEnabled });
    });

    function setupAutoReply() {
        if (replyHandler || !clientRef.client) return;

        replyHandler = async (msg) => {
            if (!autoReplyEnabled || msg.fromMe) return;

            const text = msg.body?.toLowerCase() || '';
            
            for (const [id, rule] of autoReplies) {
                let matched = false;
                const keyword = rule.keyword.toLowerCase();
                
                switch (rule.matchType) {
                    case 'exact':
                        matched = text === keyword;
                        break;
                    case 'regex':
                        try {
                            const regex = new RegExp(keyword, 'i');
                            matched = regex.test(msg.body || '');
                        } catch (e) {
                            console.error('Invalid regex:', e);
                        }
                        break;
                    case 'keyword':
                    default:
                        matched = text.includes(keyword);
                        break;
                }

                if (matched) {
                    try {
                        await msg.reply(rule.reply);
                    } catch (e) {
                        console.error('Auto reply error:', e);
                    }
                    break;
                }
            }
        };

        clientRef.client.on('message_create', replyHandler);
    }

    function removeAutoReply() {
        if (replyHandler && clientRef.client) {
            clientRef.client.off('message_create', replyHandler);
            replyHandler = null;
        }
    }

    // 当客户端就绪时，如果自动回复已启用，则设置监听器
    const originalInit = clientRef.init;
    if (clientRef.client) {
        clientRef.client.on('ready', () => {
            if (autoReplyEnabled) {
                setupAutoReply();
            }
        });
    }
}

module.exports = { createAutoReplyRoutes };
