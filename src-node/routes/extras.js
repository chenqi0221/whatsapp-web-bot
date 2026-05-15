const logger = require('../utils/logger');

function createExtrasRoutes(app, clientRef, clientState) {
    // 搜索消息
    app.get('/api/search', async (req, res) => {
        const { query, chatId } = req.query;
        
        if (!query) {
            return res.json({ messages: [] });
        }

        if (!clientRef.client || clientState.status !== 'ready') {
            return res.json({ messages: [] });
        }

        try {
            let results = [];
            
            if (chatId) {
                // 在指定聊天中搜索
                const chat = await clientRef.client.getChatById(chatId);
                const messages = await chat.fetchMessages({ limit: 100 });
                results = messages.filter(msg => 
                    msg.body && msg.body.toLowerCase().includes(query.toLowerCase())
                );
            } else {
                // 在所有聊天中搜索
                const chats = await clientRef.client.getChats();
                for (const chat of chats.slice(0, 20)) {
                    try {
                        const messages = await chat.fetchMessages({ limit: 50 });
                        const matched = messages.filter(msg => 
                            msg.body && msg.body.toLowerCase().includes(query.toLowerCase())
                        );
                        results.push(...matched);
                    } catch (e) {
                        logger.info('Search error in chat:', { error: e.message });
                    }
                }
            }

            const messageList = results.slice(0, 50).map(msg => ({
                id: msg.id._serialized,
                body: msg.body,
                from: msg.from,
                to: msg.to,
                timestamp: msg.timestamp,
                fromMe: msg.fromMe,
                chatName: msg._data?.notifyName || msg.from
            }));

            res.json({ messages: messageList });
        } catch (e) {
            res.json({ messages: [], error: e.message });
        }
    });

    // 获取频道列表
    app.get('/api/channel/list', async (req, res) => {
        if (!clientRef.client || clientState.status !== 'ready') {
            return res.json({ channels: [] });
        }

        try {
            // whatsapp-web.js 可能不直接支持频道，返回空列表
            res.json({ channels: [] });
        } catch (e) {
            res.json({ channels: [], error: e.message });
        }
    });

    // 创建频道
    app.post('/api/channel/create', async (req, res) => {
        const { name, description } = req.body;
        
        if (!name) {
            return res.json({ success: false, error: '频道名称不能为空' });
        }

        // whatsapp-web.js 可能不直接支持创建频道
        res.json({ success: false, error: '频道功能暂不支持' });
    });

    // 获取标签列表
    app.get('/api/labels', async (req, res) => {
        if (!clientRef.client || clientState.status !== 'ready') {
            return res.json({ labels: [] });
        }

        try {
            const labels = await clientRef.client.getLabels();
            const labelList = labels.map(label => ({
                id: label.id,
                name: label.name,
                color: label.color,
                count: label.count
            }));
            res.json({ labels: labelList });
        } catch (e) {
            res.json({ labels: [], error: e.message });
        }
    });

    // 给聊天添加标签
    app.post('/api/chat/:id/label', async (req, res) => {
        const { id } = req.params;
        const { labelId } = req.body;
        
        if (!labelId) {
            return res.json({ success: false, error: '标签ID不能为空' });
        }

        if (!clientRef.client || clientState.status !== 'ready') {
            return res.json({ success: false, error: 'Client not ready' });
        }

        try {
            const chat = await clientRef.client.getChatById(id);
            await chat.addLabels([labelId]);
            res.json({ success: true });
        } catch (e) {
            res.json({ success: false, error: e.message });
        }
    });

    // 从聊天移除标签
    app.delete('/api/chat/:id/label', async (req, res) => {
        const { id } = req.params;
        const { labelId } = req.body;
        
        if (!labelId) {
            return res.json({ success: false, error: '标签ID不能为空' });
        }

        if (!clientRef.client || clientState.status !== 'ready') {
            return res.json({ success: false, error: 'Client not ready' });
        }

        try {
            const chat = await clientRef.client.getChatById(id);
            await chat.removeLabels([labelId]);
            res.json({ success: true });
        } catch (e) {
            res.json({ success: false, error: e.message });
        }
    });

    // 更新个人资料名称
    app.post('/api/profile/update-name', async (req, res) => {
        const { name } = req.body;
        
        if (!name) {
            return res.json({ success: false, error: '名称不能为空' });
        }

        if (!clientRef.client || clientState.status !== 'ready') {
            return res.json({ success: false, error: 'Client not ready' });
        }

        try {
            await clientRef.client.setDisplayName(name);
            res.json({ success: true });
        } catch (e) {
            res.json({ success: false, error: e.message });
        }
    });

    // 更新个人资料状态
    app.post('/api/profile/update-status', async (req, res) => {
        const { status } = req.body;
        
        if (!status) {
            return res.json({ success: false, error: '状态不能为空' });
        }

        if (!clientRef.client || clientState.status !== 'ready') {
            return res.json({ success: false, error: 'Client not ready' });
        }

        try {
            await clientRef.client.setStatus(status);
            res.json({ success: true });
        } catch (e) {
            res.json({ success: false, error: e.message });
        }
    });

    // 查询联系人信息
    app.get('/api/contact/:id', async (req, res) => {
        const { id } = req.params;
        
        if (!clientRef.client || clientState.status !== 'ready') {
            return res.json({ success: false, error: 'Client not ready' });
        }

        try {
            const contact = await clientRef.client.getContactById(id);
            res.json({
                success: true,
                contact: {
                    id: contact.id._serialized,
                    name: contact.name,
                    pushname: contact.pushname,
                    number: contact.number,
                    isBusiness: contact.isBusiness,
                    isEnterprise: contact.isEnterprise,
                    isMe: contact.isMe
                }
            });
        } catch (e) {
            res.json({ success: false, error: e.message });
        }
    });

    // 获取联系人头像
    app.get('/api/contact/:id/profile-pic', async (req, res) => {
        const { id } = req.params;
        
        if (!clientRef.client || clientState.status !== 'ready') {
            return res.json({ success: false, error: 'Client not ready' });
        }

        try {
            const url = await clientRef.client.getProfilePicUrl(id);
            res.json({ success: true, url });
        } catch (e) {
            res.json({ success: false, error: e.message });
        }
    });

    // 获取统计信息
    app.get('/api/stats', async (req, res) => {
        if (!clientRef.client || clientState.status !== 'ready') {
            return res.json({ stats: {} });
        }

        try {
            const chats = await clientRef.client.getChats();
            const contacts = await clientRef.client.getContacts();
            
            const totalMessages = chats.reduce((sum, chat) => sum + (chat.unreadCount || 0), 0);
            const groups = chats.filter(c => c.isGroup).length;
            const privateChats = chats.filter(c => !c.isGroup).length;
            
            res.json({
                stats: {
                    totalChats: chats.length,
                    totalContacts: contacts.length,
                    totalGroups: groups,
                    totalPrivateChats: privateChats,
                    totalUnreadMessages: totalMessages
                }
            });
        } catch (e) {
            res.json({ stats: {}, error: e.message });
        }
    });
}

module.exports = { createExtrasRoutes };
