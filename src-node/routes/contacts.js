const logger = require('../utils/logger');

function createContactsRoutes(app, clientRef, clientState) {
    app.get('/api/chats', async (req, res) => {
        if (
            !clientRef.client ||
            clientState.status !== 'ready' ||
            !clientRef.client.pupPage
        ) {
            return res.json({ chats: [] });
        }
        try {
            const chats = await clientRef.client.getChats();
            const chatList = chats.map((chat) => {
                let number = null;
                if (chat.id?.user) {
                    number = chat.id.user;
                } else if (chat.id?._serialized) {
                    const match = chat.id._serialized.match(/^(\d+)@/);
                    if (match) number = match[1];
                }
                return {
                    id: chat.id._serialized,
                    number: number,
                    name: chat.name,
                    isGroup: chat.isGroup,
                    lastMessage: chat.lastMessage?.body || '',
                    participants: chat.participants?.length || 0,
                };
            });
            res.json({ chats: chatList });
        } catch (e) {
            res.json({ chats: [], error: e.message });
        }
    });

    app.get('/api/contacts-list', async (req, res) => {
        if (
            !clientRef.client ||
            clientState.status !== 'ready' ||
            !clientRef.client.pupPage
        ) {
            return res.json({ contacts: [], error: 'Client not ready' });
        }
        try {
            const contactsData = await clientRef.client.pupPage.evaluate(
                async () => {
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
                                            return attrs && attrs.phoneNumber;
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
                            logger.info('Error WAWebCollections:', { data: e.message });
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
                            if (!number && attrs.id && attrs.id._serialized) {
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
                            logger.info('Error processing contact:', { data: e.message });
                        }
                    }
                    return { contacts: result };
                },
            );

            const contactList = contactsData.contacts
                .filter((c) => !c.isMe)
                .map((c) => ({
                    id: c.number + '@c.us',
                    name: c.name,
                    number: c.number,
                    lid: c.lid || null,
                }));

            res.json({ contacts: contactList, total: contactList.length });
        } catch (e) {
            logger.info('API Error:', { data: e.message });
            res.json({ contacts: [], error: e.message });
        }
    });

    app.get('/api/export-contacts', async (req, res) => {
        if (
            !clientRef.client ||
            clientState.status !== 'ready' ||
            !clientRef.client.pupPage
        ) {
            return res.json({ error: 'Client not ready' });
        }
        try {
            const chats = await clientRef.client.getChats();
            const contacts = [];
            const seenNumbers = new Set();

            for (const chat of chats) {
                if (chat.isGroup) continue;
                let number = null;
                if (chat.id?.user) {
                    number = chat.id.user;
                } else if (chat.id?._serialized) {
                    const match = chat.id._serialized.match(/^(\d+)@/);
                    if (match) number = match[1];
                }
                if (number && !seenNumbers.has(number) && number.length > 5) {
                    seenNumbers.add(number);
                    contacts.push({ number, name: chat.name || number });
                }
            }

            let csv = '\uFEFF手机号,姓名\n';
            contacts.forEach((c) => {
                csv += `${c.number},${c.name}\n`;
            });

            res.setHeader('Content-Type', 'text/csv;charset=utf-8');
            res.setHeader(
                'Content-Disposition',
                'attachment; filename=contacts.csv',
            );
            res.send(csv);
        } catch (e) {
            res.json({ error: e.message });
        }
    });

    app.get('/api/contacts/unchatted', async (req, res) => {
        if (
            !clientRef.client ||
            clientState.status !== 'ready' ||
            !clientRef.client.pupPage
        ) {
            return res.json({ contacts: [], error: 'Client not ready', total: 0 });
        }
        try {
            // 获取联系人（与 /api/contacts-list 同样的逻辑）
            const contactsData = await clientRef.client.pupPage.evaluate(
                async () => {
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
                                            return attrs && attrs.phoneNumber;
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
                            logger.info('Error WAWebCollections:', { data: e.message });
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
                            if (!number && attrs.id && attrs.id._serialized) {
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
                            logger.info('Error processing contact:', { data: e.message });
                        }
                    }
                    return { contacts: result };
                },
            );

            // 获取聊天列表
            const chats = await clientRef.client.getChats();

            // 构建 chatSets，与 Contacts.vue 完全一致的逻辑
            const chatNumbers = new Set();
            const chatLids = new Set();
            const chatNames = new Set();

            for (const chat of chats) {
                const chatId = chat.id?._serialized;
                if (chatId && typeof chatId === 'string') {
                    const match = chatId.match(/^(\d+)@/);
                    if (match) chatNumbers.add(match[1]);
                    const lidMatch = chatId.match(/^(\d+)@lid/);
                    if (lidMatch) chatLids.add(lidMatch[1]);
                }
                if (chat.name) {
                    chatNames.add(chat.name.toLowerCase().trim());
                }
            }

            // 按照 Contacts.vue isContactInChats() 完全一致的逻辑筛选未聊天联系人
            const unchattedContacts = contactsData.contacts
                .filter((c) => !c.isMe)
                .filter((contact) => {
                    const inChatsByLid =
                        contact.lid &&
                        (chatNumbers.has(contact.lid) ||
                            chatLids.has(contact.lid));
                    const inChatsByNumber =
                        contact.number && chatNumbers.has(contact.number);
                    const inChatsById =
                        contact.id && chatNumbers.has(contact.id.split('@')[0]);
                    const nameMatch = contact.name
                        ? chatNames.has(contact.name.toLowerCase().trim())
                        : false;
                    return !(
                        inChatsByLid ||
                        inChatsByNumber ||
                        inChatsById ||
                        nameMatch
                    );
                })
                .map((c) => ({
                    id: c.id || c.number + '@c.us',
                    number: c.number,
                    name: c.name,
                    lid: c.lid || null,
                }));

            res.json({ contacts: unchattedContacts, total: unchattedContacts.length });
        } catch (e) {
            logger.error('Unchatted contacts error:', { data: e.message });
            res.json({ contacts: [], error: e.message, total: 0 });
        }
    });

    app.get('/api/chat/:id', async (req, res) => {
        if (
            !clientRef.client ||
            clientState.status !== 'ready' ||
            !clientRef.client.pupPage
        ) {
            return res.json({ error: 'Client not ready' });
        }
        try {
            const chat = await clientRef.client.getChatById(req.params.id);
            const messages = await chat.fetchMessages({ limit: 50 });
            res.json({
                chat: {
                    id: chat.id._serialized,
                    name: chat.name,
                    isGroup: chat.isGroup,
                },
                messages: messages.map((m) => ({
                    id: m.id._serialized,
                    body: m.body,
                    type: m.type,
                    from: m.from,
                    fromMe: m.fromMe,
                    timestamp: m.timestamp,
                })),
            });
        } catch (e) {
            res.json({ error: e.message });
        }
    });
}

module.exports = { createContactsRoutes };
