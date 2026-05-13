function createChatManageRoutes(app, clientRef, clientState) {
    // 标记已读
    app.post('/api/chat/:id/mark-seen', async (req, res) => {
        const { id } = req.params;
        
        if (!clientRef.client || clientState.status !== 'ready') {
            return res.json({ success: false, error: 'Client not ready' });
        }

        try {
            const chat = await clientRef.client.getChatById(id);
            await chat.sendSeen();
            res.json({ success: true });
        } catch (e) {
            res.json({ success: false, error: e.message });
        }
    });

    // 置顶/取消置顶
    app.post('/api/chat/:id/pin', async (req, res) => {
        const { id } = req.params;
        const { pin } = req.body;
        
        if (!clientRef.client || clientState.status !== 'ready') {
            return res.json({ success: false, error: 'Client not ready' });
        }

        try {
            const chat = await clientRef.client.getChatById(id);
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

    // 归档
    app.post('/api/chat/:id/archive', async (req, res) => {
        const { id } = req.params;
        
        if (!clientRef.client || clientState.status !== 'ready') {
            return res.json({ success: false, error: 'Client not ready' });
        }

        try {
            const chat = await clientRef.client.getChatById(id);
            await chat.archive();
            res.json({ success: true });
        } catch (e) {
            res.json({ success: false, error: e.message });
        }
    });

    // 免打扰
    app.post('/api/chat/:id/mute', async (req, res) => {
        const { id } = req.params;
        const { unmute } = req.body;
        
        if (!clientRef.client || clientState.status !== 'ready') {
            return res.json({ success: false, error: 'Client not ready' });
        }

        try {
            const chat = await clientRef.client.getChatById(id);
            if (unmute) {
                await chat.unmute();
            } else {
                await chat.mute();
            }
            res.json({ success: true });
        } catch (e) {
            res.json({ success: false, error: e.message });
        }
    });

    // 删除聊天
    app.post('/api/chat/:id/delete', async (req, res) => {
        const { id } = req.params;
        
        if (!clientRef.client || clientState.status !== 'ready') {
            return res.json({ success: false, error: 'Client not ready' });
        }

        try {
            const chat = await clientRef.client.getChatById(id);
            await chat.delete();
            res.json({ success: true });
        } catch (e) {
            res.json({ success: false, error: e.message });
        }
    });

    // 清空消息
    app.post('/api/chat/:id/clear', async (req, res) => {
        const { id } = req.params;
        
        if (!clientRef.client || clientState.status !== 'ready') {
            return res.json({ success: false, error: 'Client not ready' });
        }

        try {
            const chat = await clientRef.client.getChatById(id);
            await chat.clearMessages();
            res.json({ success: true });
        } catch (e) {
            res.json({ success: false, error: e.message });
        }
    });

    // 发送消息
    app.post('/api/send', async (req, res) => {
        const { to, message } = req.body;
        
        if (!to || !message) {
            return res.json({ success: false, error: '接收者和消息内容不能为空' });
        }

        if (!clientRef.client || clientState.status !== 'ready') {
            return res.json({ success: false, error: 'Client not ready' });
        }

        try {
            const result = await clientRef.client.sendMessage(to, message);
            res.json({ success: true, messageId: result.id._serialized });
        } catch (e) {
            res.json({ success: false, error: e.message });
        }
    });

    // 获取消息记录
    app.get('/api/chat/:id/messages', async (req, res) => {
        const { id } = req.params;
        const { limit = 50 } = req.query;
        
        if (!clientRef.client || clientState.status !== 'ready') {
            return res.json({ messages: [] });
        }

        try {
            const chat = await clientRef.client.getChatById(id);
            const messages = await chat.fetchMessages({ limit: parseInt(limit) });
            
            const messageList = messages.map(msg => ({
                id: msg.id._serialized,
                body: msg.body,
                from: msg.from,
                to: msg.to,
                timestamp: msg.timestamp,
                fromMe: msg.fromMe,
                hasMedia: msg.hasMedia,
                type: msg.type
            }));
            
            res.json({ messages: messageList });
        } catch (e) {
            res.json({ messages: [], error: e.message });
        }
    });
}

module.exports = { createChatManageRoutes };
