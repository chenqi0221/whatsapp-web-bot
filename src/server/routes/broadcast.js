const {
    getBroadcastProgress,
    stopBroadcast,
    runBroadcast,
} = require('../../services/broadcast');
const { canSend, setAccountLevel } = require('../../services/rate-limiter');

function createBroadcastRoutes(app, clientRef, clientState, io) {
    app.get('/api/broadcast-status', (req, res) => {
        res.json(getBroadcastProgress());
    });

    app.post('/api/broadcast/stop', (req, res) => {
        stopBroadcast();
        res.json({ success: true });
    });

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

        setAccountLevel(accountLevel);

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

        if (
            !clientRef.client ||
            clientState.status !== 'ready' ||
            !clientRef.client.pupPage
        ) {
            return res.json({ success: false, error: 'Client not ready' });
        }

        const sendCheck = canSend();
        if (!sendCheck.allowed) {
            return res.json({
                success: false,
                error: `Daily limit reached (${sendCheck.dailyMax}).`,
            });
        }

        try {
            let targetItems = [];

            if (targetType === 'manual' && manualNumbers) {
                const numbers = manualNumbers
                    .split(/[,\n]/)
                    .map((n) => n.trim())
                    .filter((n) => n.length > 0);
                targetItems = numbers.map((num) => ({
                    id: num + '@c.us',
                    name: num,
                    number: num,
                }));
            } else if (targetType === 'nohistory') {
                // 获取所有联系人和所有聊天
                const [contactsData, chats] = await Promise.all([
                    clientRef.client.pupPage.evaluate(async () => {
                        let contacts = [];
                        if (window.require) {
                            try {
                                const Collections =
                                    window.require('WAWebCollections');
                                if (Collections && Collections.Contact) {
                                    if (Collections.Contact._index) {
                                        const allContacts = Object.values(
                                            Collections.Contact._index,
                                        );
                                        contacts = allContacts.filter((c) => {
                                            try {
                                                const attrs =
                                                    c.attributes ||
                                                    (c.serialize
                                                        ? c.serialize()
                                                        : c);
                                                return (
                                                    attrs && attrs.phoneNumber
                                                );
                                            } catch (e) {
                                                return false;
                                            }
                                        });
                                    }
                                    if (
                                        (!contacts || contacts.length === 0) &&
                                        Collections.Contact.findAll
                                    ) {
                                        contacts =
                                            await Collections.Contact.findAll();
                                    }
                                }
                            } catch (e) {
                                console.log(
                                    'Error WAWebCollections:',
                                    e.message,
                                );
                            }
                        }

                        const result = [];
                        const seenNumbers = new Set();

                        for (const c of contacts || []) {
                            try {
                                let attrs =
                                    c.attributes ||
                                    (c.serialize ? c.serialize() : c);
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
                                if (
                                    !number &&
                                    attrs.id &&
                                    attrs.id._serialized
                                ) {
                                    number = attrs.id._serialized.split('@')[0];
                                }
                                if (
                                    !number ||
                                    typeof number !== 'string' ||
                                    number.length <= 5
                                )
                                    continue;
                                if (seenNumbers.has(number)) continue;
                                seenNumbers.add(number);

                                result.push({
                                    number,
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
                            } catch (e) {
                                console.log(
                                    'Error processing contact:',
                                    e.message,
                                );
                            }
                        }
                        return { contacts: result };
                    }),
                    clientRef.client.getChats(),
                ]);

                // 构建已有聊天的号码集合
                const chatNumbers = new Set();
                const chatLids = new Set();
                const chatNames = new Set();

                for (const chat of chats) {
                    if (excludeGroups && chat.isGroup) continue;
                    const chatId = chat.id?._serialized || chat.id?.user || '';
                    if (chatId) {
                        const match = chatId.match(/^(\d+)@/);
                        if (match) chatNumbers.add(match[1]);
                        const lidMatch = chatId.match(/^(\d+)@lid/);
                        if (lidMatch) chatLids.add(lidMatch[1]);
                    }
                    if (chat.name) {
                        chatNames.add(chat.name.toLowerCase().trim());
                    }
                }

                // 过滤出未聊天的联系人
                const noHistoryContacts = contactsData.contacts.filter((c) => {
                    if (c.isMe) return false;
                    const inChatsByLid =
                        c.lid &&
                        (chatNumbers.has(c.lid) || chatLids.has(c.lid));
                    const inChatsByNumber =
                        c.number && chatNumbers.has(c.number);
                    const inChatsById =
                        c.id && chatNumbers.has(c.id.split('@')[0]);
                    const nameMatch = c.name
                        ? chatNames.has(c.name.toLowerCase().trim())
                        : false;

                    return (
                        !inChatsByLid &&
                        !inChatsByNumber &&
                        !inChatsById &&
                        !nameMatch
                    );
                });

                targetItems = noHistoryContacts.map((c) => ({
                    id: c.id || c.number + '@c.us',
                    name: c.name,
                    number: c.number,
                    lid: c.lid || null,
                }));
            } else {
                const chats = await clientRef.client.getChats();
                const filteredChats = chats.filter((chat) => {
                    if (excludeGroups && chat.isGroup) return false;
                    if (targetType === 'groups') return chat.isGroup;
                    if (targetType === 'private') return !chat.isGroup;
                    return true;
                });

                targetItems = filteredChats.map((chat) => {
                    const number =
                        chat.id?.user ||
                        chat.id?._serialized?.split('@')[0] ||
                        '';
                    return {
                        id: chat.id._serialized,
                        name: chat.name || number,
                        number,
                        lid: null,
                    };
                });
            }

            // 记录当前账号，用于隔离不同账号的广播状态
            const currentClientId = clientRef.currentClientId || 'default';

            const result = await runBroadcast(
                clientRef.client,
                {
                    targetItems,
                    messages,
                    interval,
                    randomInterval,
                    randomizeMsg,
                    lengthRandomize,
                    simulateTyping,
                    simulateMouse,
                    respectHours,
                    randomPause,
                    personalize,
                    clientId: currentClientId,
                },
                io,
            );

            res.json(result);
        } catch (e) {
            res.json({ success: false, error: e.message });
        }
    });
}

module.exports = { createBroadcastRoutes };
