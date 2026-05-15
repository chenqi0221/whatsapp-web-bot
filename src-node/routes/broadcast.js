const {
    getBroadcastProgress,
    stopBroadcast,
    runBroadcast,
} = require('../services/broadcast');
const { canSend, setAccountLevel } = require('../services/rate-limiter');
const logger = require('../utils/logger');

function createBroadcastRoutes(app, clientRef, clientState, io) {
    const getClientId = () => clientRef.currentClientId || 'default'

    app.get('/api/broadcast-status', (req, res) => {
        res.json(getBroadcastProgress(getClientId()))
    })

    app.post('/api/broadcast/stop', (req, res) => {
        stopBroadcast(getClientId())
        res.json({ success: true })
    })

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
        } = req.body

        setAccountLevel(accountLevel)

        let messages = []
        if (Array.isArray(message)) {
            messages = message
        } else if (typeof message === 'string' && message.includes('\n')) {
            messages = message
                .split('\n')
                .map((line) => line.trim())
                .filter((line) => line.length > 0)
        } else if (message) {
            messages = [String(message)]
        }

        messages = messages.filter(m => m && typeof m === 'string' && m.trim())
        if (messages.length === 0) {
            return res.json({ success: false, error: '请至少输入一条消息内容' })
        }

        if (
            !clientRef.client ||
            clientState.status !== 'ready' ||
            !clientRef.client.pupPage
        ) {
            return res.json({ success: false, error: 'WhatsApp 客户端未就绪，请先扫码登录' })
        }

        const sendCheck = canSend()
        if (!sendCheck.allowed) {
            return res.json({
                success: false,
                error: `今日发送已达上限(${sendCheck.dailyMax}条)，请明天再试`,
            })
        }

        try {
            let targetItems = []

            if (targetType === 'manual') {
                if (!manualNumbers || manualNumbers.trim().length === 0) {
                    return res.json({ success: false, error: '请输入手机号码' })
                }
                const numbers = manualNumbers
                    .split(/[,\n]/)
                    .map((n) => n.trim())
                    .filter((n) => n.length > 0)
                targetItems = numbers.map((num) => ({
                    id: num.includes('@') ? num : num + '@c.us',
                    name: num,
                    number: num.replace(/[^0-9]/g, ''),
                    lid: null,
                }))
            } else if (targetType === 'contacts' || targetType === 'nohistory') {
                const contactsData = await clientRef.client.pupPage.evaluate(async () => {
                    let contacts = []
                    if (window.require) {
                        try {
                            const Collections = window.require('WAWebCollections')
                            if (Collections && Collections.Contact) {
                                if (Collections.Contact._index) {
                                    const allContacts = Object.values(Collections.Contact._index)
                                    contacts = allContacts.filter((c) => {
                                        try {
                                            const attrs = c.attributes || (c.serialize ? c.serialize() : c)
                                            return attrs && attrs.phoneNumber
                                        } catch (e) { return false }
                                    })
                                }
                                if ((!contacts || contacts.length === 0) && Collections.Contact.findAll) {
                                    contacts = await Collections.Contact.findAll()
                                }
                            }
                        } catch (e) { /**/ }
                    }
                    const result = []
                    const seenNumbers = new Set()
                    for (const c of contacts || []) {
                        try {
                            let attrs = c.attributes || (c.serialize ? c.serialize() : c)
                            let number = attrs.phone || attrs.phoneNumber || attrs.id?.user || attrs.userid
                            if (typeof number === 'object' && number !== null && number.user) {
                                number = number.user
                            }
                            if (!number && attrs.id && attrs.id._serialized) {
                                number = attrs.id._serialized.split('@')[0]
                            }
                            if (!number || typeof number !== 'string' || number.length <= 5) continue
                            const cleanNumber = number.replace(/[^0-9]/g, '')
                            if (!cleanNumber || cleanNumber.length <= 5) continue
                            seenNumbers.add(cleanNumber)
                            result.push({
                                number: cleanNumber,
                                name: attrs.displayName || attrs.pushname || attrs.shortName || attrs.name || cleanNumber,
                                isMe: attrs.isMe,
                                lid: attrs.id?.user || null,
                                id: attrs.id?._serialized || null,
                            })
                        } catch (e) { /**/ }
                    }
                    return { contacts: result }
                })

                const allContacts = contactsData.contacts.filter((c) => !c.isMe)
                const chats = await clientRef.client.getChats()

                if (!allContacts || allContacts.length === 0) {
                    return res.json({ success: false, error: '无法获取联系人列表，请确认 WhatsApp 已完全加载' })
                }

                logger.info(`Broadcast ${targetType}: fetched ${allContacts.length} contacts, ${chats?.length || 0} chats`)

                // DEBUG: log sample contact numbers to verify normalization
                const sampleContactNums = allContacts.slice(0, 3).map(c => c.number)
                logger.info(`Contact sample numbers (first 3): ${JSON.stringify(sampleContactNums)}`)

                if (targetType === 'nohistory') {
                    const chatNumbers = new Set()
                    const chatLids = new Set()
                    const chatNames = new Set()
                    for (const chat of chats) {
                        if (excludeGroups && chat.isGroup) continue
                        const chatId = chat.id?._serialized || chat.id?.user || ''
                        if (chatId) {
                            const match = chatId.match(/^(\d+)@/)
                            if (match) chatNumbers.add(match[1])
                            const lidMatch = chatId.match(/^(\d+)@lid/)
                            if (lidMatch) chatLids.add(lidMatch[1])
                        }
                        if (chat.name) { chatNames.add(chat.name.toLowerCase().trim()) }
                    }

                    // DEBUG: log exclusion sets
                    const chatNumSamples = [...chatNumbers].slice(0, 5)
                    logger.info(
                        `Exclusion sets: chatNumbers=${chatNumbers.size}, chatNames=${chatNames.size}, ` +
                        `chatLids=${chatLids.size}, sampleChatNums=${JSON.stringify(chatNumSamples)}`
                    )

                    const noHistoryContacts = allContacts.filter((contact) => {
                        const inChatsByLid = contact.lid && (chatNumbers.has(contact.lid) || chatLids.has(contact.lid))
                        const inChatsByNumber = contact.number && chatNumbers.has(contact.number)
                        const inChatsByIdMatch = contact.id ? contact.id.match(/^(\d+)@/) : null
                        const inChatsById = inChatsByIdMatch ? chatNumbers.has(inChatsByIdMatch[1]) : false
                        const nameMatch = contact.name ? chatNames.has(contact.name.toLowerCase().trim()) : false
                        return !(inChatsByLid || inChatsByNumber || inChatsById || nameMatch)
                    })

                    logger.info(
                        `nohistory result: total=${allContacts.length}, ` +
                        `filtered=${noHistoryContacts.length}, ` +
                        `excluded=${allContacts.length - noHistoryContacts.length}`
                    )

                    if (noHistoryContacts.length === 0) {
                        return res.json({ success: false, error: '没有未聊天的联系人，所有联系人都有聊天记录' })
                    }

                    targetItems = noHistoryContacts.map((c) => ({
                        id: c.id || c.number + '@c.us',
                        name: c.name,
                        number: c.number,
                        lid: c.lid || null,
                    }))
                } else {
                    targetItems = allContacts.map((c) => ({
                        id: c.id || c.number + '@c.us',
                        name: c.name,
                        number: c.number,
                        lid: c.lid || null,
                    }))
                }
            } else {
                // targetType === 'chats' 或 'groups' 或 'private'
                const chats = await clientRef.client.getChats()

                if (!chats || chats.length === 0) {
                    return res.json({
                        success: false,
                        error: '暂无聊天记录，请先发起聊天',
                    })
                }

                const filteredChats = chats.filter((chat) => {
                    if (excludeGroups && chat.isGroup) return false
                    if (targetType === 'groups') return chat.isGroup
                    if (targetType === 'private') return !chat.isGroup
                    return true
                })

                if (filteredChats.length === 0) {
                    return res.json({
                        success: false,
                        error: '没有符合条件的聊天对象',
                    })
                }

                targetItems = filteredChats.map((chat) => {
                    const rawId = chat.id?._serialized || chat.id?.user || ''
                    const match = rawId.match(/^(\d+)@/)
                    const number = match ? match[1] : ''
                    return {
                        id: rawId || number + '@c.us',
                        name: chat.name || number,
                        number,
                        lid: null,
                    }
                })
            }

            if (targetItems.length === 0) {
                return res.json({
                    success: false,
                    error: '没有可发送的对象',
                })
            }

            const clientId = getClientId()
            logger.info(`[broadcast route] Calling runBroadcast: ${targetItems.length} targets, ${messages.length} msgs, type=${targetType}`)

            runBroadcast(
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
                    clientId,
                },
                io,
            ).then(() => {
                logger.info(`Broadcast completed for client ${clientId}`)
            }).catch((e) => {
                logger.error(`Broadcast error for client ${clientId}: ${e?.message || e || 'unknown error'}`)
                if (e?.stack) {
                    logger.error(`Broadcast stack: ${e.stack}`)
                }
                const progress = require('../services/broadcast').getBroadcastProgress(clientId)
                if (progress) progress.running = false
            })

            res.json({ success: true, message: '群发已启动' })
        } catch (e) {
            logger.error('Broadcast error:', { data: e.message, stack: e.stack })
            res.json({ success: false, error: e.message })
        }
    })
}

module.exports = { createBroadcastRoutes }