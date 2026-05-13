function createGroupRoutes(app, clientRef, clientState) {
    // 获取群组列表
    app.get('/api/groups', async (req, res) => {
        if (!clientRef.client || clientState.status !== 'ready') {
            return res.json({ groups: [] });
        }

        try {
            const chats = await clientRef.client.getChats();
            const groups = chats
                .filter(chat => chat.isGroup)
                .map(chat => ({
                    id: chat.id._serialized,
                    name: chat.name,
                    participants: chat.participants?.length || 0,
                }));
            res.json({ groups });
        } catch (e) {
            res.json({ groups: [], error: e.message });
        }
    });

    // 创建群组
    app.post('/api/group/create', async (req, res) => {
        const { name, members } = req.body;
        
        if (!name || !members || !Array.isArray(members)) {
            return res.json({ success: false, error: '群组名称和成员列表不能为空' });
        }

        if (!clientRef.client || clientState.status !== 'ready') {
            return res.json({ success: false, error: 'Client not ready' });
        }

        try {
            const group = await clientRef.client.createGroup(name, members);
            res.json({ success: true, group: {
                id: group.gid._serialized,
                name: group.title
            }});
        } catch (e) {
            res.json({ success: false, error: e.message });
        }
    });

    // 获取群组信息
    app.get('/api/group/:id', async (req, res) => {
        const { id } = req.params;
        
        if (!clientRef.client || clientState.status !== 'ready') {
            return res.json({ success: false, error: 'Client not ready' });
        }

        try {
            const chat = await clientRef.client.getChatById(id);
            const participants = await Promise.all(
                chat.participants.map(async (p) => {
                    const contact = await clientRef.client.getContactById(p.id._serialized);
                    return {
                        id: p.id._serialized,
                        name: contact.name || contact.pushname || p.id.user,
                        isAdmin: p.isAdmin,
                        isSuperAdmin: p.isSuperAdmin
                    };
                })
            );
            
            res.json({
                success: true,
                group: {
                    id: chat.id._serialized,
                    name: chat.name,
                    description: chat.description,
                    participants,
                    createdAt: chat.createdAt
                }
            });
        } catch (e) {
            res.json({ success: false, error: e.message });
        }
    });

    // 添加成员
    app.post('/api/group/:id/add', async (req, res) => {
        const { id } = req.params;
        const { members } = req.body;
        
        if (!members || !Array.isArray(members)) {
            return res.json({ success: false, error: '成员列表不能为空' });
        }

        if (!clientRef.client || clientState.status !== 'ready') {
            return res.json({ success: false, error: 'Client not ready' });
        }

        try {
            const chat = await clientRef.client.getChatById(id);
            const result = await chat.addParticipants(members);
            res.json({ success: true, result });
        } catch (e) {
            res.json({ success: false, error: e.message });
        }
    });

    // 移除成员
    app.post('/api/group/:id/remove', async (req, res) => {
        const { id } = req.params;
        const { members } = req.body;
        
        if (!members || !Array.isArray(members)) {
            return res.json({ success: false, error: '成员列表不能为空' });
        }

        if (!clientRef.client || clientState.status !== 'ready') {
            return res.json({ success: false, error: 'Client not ready' });
        }

        try {
            const chat = await clientRef.client.getChatById(id);
            const result = await chat.removeParticipants(members);
            res.json({ success: true, result });
        } catch (e) {
            res.json({ success: false, error: e.message });
        }
    });

    // 退出群组
    app.post('/api/group/:id/leave', async (req, res) => {
        const { id } = req.params;
        
        if (!clientRef.client || clientState.status !== 'ready') {
            return res.json({ success: false, error: 'Client not ready' });
        }

        try {
            const chat = await clientRef.client.getChatById(id);
            await chat.leave();
            res.json({ success: true });
        } catch (e) {
            res.json({ success: false, error: e.message });
        }
    });

    // 加入群组（通过邀请链接）
    app.post('/api/join-group', async (req, res) => {
        const { link } = req.body;
        
        if (!link) {
            return res.json({ success: false, error: '邀请链接不能为空' });
        }

        if (!clientRef.client || clientState.status !== 'ready') {
            return res.json({ success: false, error: 'Client not ready' });
        }

        try {
            const result = await clientRef.client.acceptInvite(link);
            res.json({ success: true, groupId: result });
        } catch (e) {
            res.json({ success: false, error: e.message });
        }
    });
}

module.exports = { createGroupRoutes };
