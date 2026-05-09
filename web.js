const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client, LocalAuth, MessageMedia } = require('./index');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

let client = null;
let clientStatus = 'disconnected';
let qrCode = null;
let broadcastProgress = { running: false, current: 0, total: 0, results: [] };

let contactTestLoop = {
    running: false,
    attempts: 0,
    maxAttempts: 100,
    interval: 3000,
    lastResult: null,
    stopOnSuccess: true
};

let autoReplyRules = [];
let scheduledTasks = [];

const clientConfig = {
    authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth_v2' }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process'
        ],
        timeout: 120000,
    },
};

function initClient() {
    if (client) {
        try {
            client.destroy();
        } catch(e) {}
    }

    client = new Client(clientConfig);

    client.on('qr', (qr) => {
        qrCode = qr;
        clientStatus = 'qr';
        io.emit('status', { status: 'qr', qr });
        console.log('QR code received');
    });

    client.on('loading_screen', (percent, message) => {
        console.log(`Loading: ${percent}% - ${message}`);
    });

    client.on('authenticated', () => {
        clientStatus = 'authenticated';
        io.emit('status', { status: 'authenticated' });
        console.log('Authenticated');
    });

    client.on('ready', () => {
        clientStatus = 'ready';
        qrCode = null;
        io.emit('status', { status: 'ready' });
        startScheduledTasks();
        console.log('\n\n===== WhatsApp Ready! =====\n');
    });

    client.on('auth_failure', (msg) => {
        clientStatus = 'auth_failure';
        io.emit('status', { status: 'auth_failure', message: msg });
        console.log('Auth failure:', msg);
    });

    client.on('disconnected', (reason) => {
        clientStatus = 'disconnected';
        io.emit('status', { status: 'disconnected', reason });
        console.log('Disconnected:', reason);
    });

    // 添加更多调试事件
    client.on('change_state', (state) => {
        console.log('State changed:', state);
    });

    client.on('change_battery', (batteryInfo) => {
        console.log('Battery:', batteryInfo);
    });

    client.on('message', (msg) => {
        io.emit('message', {
            body: msg.body,
            from: msg.from,
            name: msg.notifyName,
            type: msg.type,
            timestamp: msg.timestamp
        });

        handleAutoReply(msg);
    });

    client.initialize().then(() => {
        console.log('Client initialization completed');
    }).catch((error) => {
        console.error('Error initializing client:', error);
        clientStatus = 'auth_failure';
        io.emit('status', { status: 'auth_failure', message: error.message });
    });
}

async function runContactTest() {
    if (!client || clientStatus !== 'ready') {
        console.log('Client not ready for contact test');
        return;
    }

    contactTestLoop.attempts++;
    console.log(`\n========== Contact Test Attempt #${contactTestLoop.attempts} ==========`);

    try {
        const contactsData = await client.pupPage.evaluate(async () => {
            let contacts = [];
            const allMethods = [];
            const logs = [];
            
            function log(msg) {
                console.log(msg);
                logs.push(msg);
            }
            
            async function waitAndRetry(fn, maxRetries = 3, delay = 2000) {
                for (let i = 0; i < maxRetries; i++) {
                    try {
                        const result = await fn();
                        if (result && result.length > 0) return result;
                    } catch(e) {}
                    await new Promise(r => setTimeout(r, delay));
                }
                return null;
            }
            
            log('===== Checking available window objects =====');
            log('window.Store: ' + typeof window.Store);
            log('window.WA: ' + typeof window.WA);
            log('window.WAPI: ' + typeof window.WAPI);
            log('window.require: ' + typeof window.require);
            
            // Method 1: Try window.require('WAWebCollections')
            try {
                if (window.require) {
                    log('\n===== Method 1: window.require(WAWebCollections) =====');
                    try {
                        const Collections = window.require('WAWebCollections');
                        log('WAWebCollections: ' + typeof Collections);
                        
                        if (Collections && Collections.Contact) {
                            log('WAWebCollections.Contact found!');
                            
                            // Try .models first
                            if (Collections.Contact.models && Collections.Contact.models.length > 0) {
                                contacts = Collections.Contact.models;
                                log('Models found: ' + contacts.length);
                            }
                            
                            // Try findAll
                            if ((!contacts || contacts.length === 0) && Collections.Contact.findAll) {
                                log('Trying findAll()...');
                                contacts = await Collections.Contact.findAll();
                                log('findAll result: ' + (contacts?.length || 0));
                            }
                            
                            // Try _index
                            if ((!contacts || contacts.length === 0) && Collections.Contact._index) {
                                log('Trying _index...');
                                contacts = Object.values(Collections.Contact._index);
                                log('_index result: ' + (contacts?.length || 0));
                            }
                            
                            // Try .then() if it's a promise
                            if ((!contacts || contacts.length === 0) && typeof Collections.Contact.then === 'function') {
                                log('Contact is a Promise, awaiting...');
                                const resolved = await Collections.Contact;
                                if (resolved && resolved.models && resolved.models.length > 0) {
                                    contacts = resolved.models;
                                    log('Resolved models: ' + contacts.length);
                                }
                            }
                        }
                    } catch(e) {
                        log('Error with WAWebCollections: ' + e.message);
                        allMethods.push({ name: 'WAWebCollections', error: e.message });
                    }
                }
            } catch(e) { log('require check error: ' + e.message); }
            
            // Method 2: Try window.Store (older API)
            if (!contacts || contacts.length === 0) {
                try {
                    log('\n===== Method 2: window.Store.Contact =====');
                    if (window.Store && window.Store.Contact) {
                        log('window.Store.Contact found!');
                        if (window.Store.Contact.models && window.Store.Contact.models.length > 0) {
                            contacts = window.Store.Contact.models;
                            log('Store models: ' + contacts.length);
                        }
                        if ((!contacts || contacts.length === 0) && window.Store.Contact.findAll) {
                            contacts = await window.Store.Contact.findAll();
                            log('findAll result: ' + (contacts?.length || 0));
                        }
                        if ((!contacts || contacts.length === 0) && window.Store.Contact.filter) {
                            contacts = window.Store.Contact.filter(() => true);
                            log('filter result: ' + (contacts?.length || 0));
                        }
                    } else {
                        log('window.Store.Contact NOT FOUND');
                    }
                } catch(e) {
                    log('Error Store.Contact: ' + e.message);
                    allMethods.push({ name: 'Store.Contact', error: e.message });
                }
            }
            
            // Method 3: Try WAPI
            if (!contacts || contacts.length === 0) {
                try {
                    log('\n===== Method 3: WAPI.getAllContacts =====');
                    if (window.WAPI && window.WAPI.getAllContacts) {
                        contacts = await window.WAPI.getAllContacts();
                        log('WAPI result: ' + (contacts?.length || 0));
                    } else {
                        log('WAPI.getAllContacts NOT FOUND');
                    }
                } catch(e) {
                    log('Error WAPI: ' + e.message);
                    allMethods.push({ name: 'WAPI', error: e.message });
                }
            }
            
            // Method 4: Try triggering contact load by opening a chat
            if (!contacts || contacts.length === 0) {
                log('\n===== Method 4: Try to find from WidFactory =====');
                try {
                    if (window.require) {
                        const WidFactory = window.require('WAWebWidFactory');
                        log('WidFactory: ' + typeof WidFactory);
                    }
                } catch(e) {
                    log('Error WidFactory: ' + e.message);
                }
            }
            
            // Method 5: Get from chat list - fallback
            if (!contacts || contacts.length === 0) {
                log('\n===== Method 5: Get from Chat collection (fallback) =====');
                try {
                    if (window.require) {
                        const Collections = window.require('WAWebCollections');
                        if (Collections && Collections.Chat) {
                            log('Chat collection found!');
                            const chats = Collections.Chat.models || [];
                            log('Chats: ' + chats.length);
                            
                            // Extract contacts from chats
                            const seenNumbers = new Set();
                            for (const chat of chats) {
                                try {
                                    const contact = chat.attributes || chat;
                                    const number = contact.id?.user || contact.id?._serialized?.split('@')[0];
                                    if (number && !seenNumbers.has(number) && number.length > 5) {
                                        seenNumbers.add(number);
                                        contacts.push({
                                            attributes: {
                                                phone: number,
                                                displayName: contact.name || contact.rawName || number,
                                                isMe: false
                                            }
                                        });
                                    }
                                } catch(e) {}
                            }
                            log('Extracted contacts from chats: ' + contacts.length);
                        }
                    }
                } catch(e) {
                    log('Error getting from Chat: ' + e.message);
                }
            }
            
            if (!contacts || contacts.length === 0) {
                log('\n===== All methods failed, listing window keys =====');
                const keys = Object.keys(window).filter(k => 
                    k.toLowerCase().includes('wa') || 
                    k.toLowerCase().includes('store') || 
                    k.toLowerCase().includes('contact') || 
                    k.toLowerCase().includes('collection') ||
                    k.toLowerCase().includes('wid') ||
                    k.toLowerCase().includes('api')
                );
                log('Relevant keys: ' + keys.slice(0, 30).join(', '));
                allMethods.push({ name: 'Window Keys', keys: keys.slice(0, 30) });
            }
            
            log('\n===== Processing contacts =====');
            log('Raw contacts count: ' + (contacts?.length || 0));
            
            const result = [];
            let skippedNoNumber = 0;
            let skippedTooShort = 0;
            let addedCount = 0;
            
            for (const c of contacts || []) {
                try {
                    let attrs = null;
                    if (c.attributes) {
                        attrs = c.attributes;
                    } else if (c.serialize && typeof c.serialize === 'function') {
                        try {
                            attrs = c.serialize();
                        } catch (serializeError) {
                            attrs = c;
                        }
                    } else {
                        attrs = c;
                    }
                    
                    let number = attrs.phone || attrs.phoneNumber || attrs.id?.user || attrs.userid;
                    if (typeof number === 'object' && number !== null && number.user) {
                        number = number.user;
                    }
                    
                    if (!number || typeof number !== 'string') {
                        skippedNoNumber++;
                        continue;
                    }
                    if (number.length <= 5) {
                        skippedTooShort++;
                        continue;
                    }
                    
                    result.push({
                        number: number,
                        name: attrs.displayName || attrs.pushname || attrs.shortName || attrs.name || number,
                        isMe: attrs.isMe,
                        lid: attrs.id?.user || null,
                        id: attrs.id?._serialized || null
                    });
                    addedCount++;
                } catch(e) { log('Error processing contact: ' + e.message); }
            }
            
            log('Skipped (no number): ' + skippedNoNumber);
            log('Skipped (too short): ' + skippedTooShort);
            log('Added: ' + addedCount);
            log('Processed contacts: ' + result.length);
            return { contacts: result, methods: allMethods, rawCount: contacts?.length || 0, logs: logs };
        });
        
        console.log('\n===== Browser Logs =====');
        if (contactsData.logs) {
            contactsData.logs.forEach(l => console.log(l));
        }
        
        const contactList = contactsData.contacts
            .filter(c => !c.isMe)
            .map(c => ({
                id: c.number + '@c.us',
                name: c.name,
                number: c.number
            }));
        
        contactTestLoop.lastResult = {
            success: contactList.length > 0,
            count: contactList.length,
            rawCount: contactsData.rawCount,
            methods: contactsData.methods,
            contacts: contactList,
            timestamp: new Date().toISOString()
        };
        
        console.log(`\n========== Test #${contactTestLoop.attempts} Result ==========`);
        console.log(`Found: ${contactList.length} contacts (raw: ${contactsData.rawCount})`);
        console.log('Methods tried:', contactsData.methods.map(m => m.name).join(', '));
        
        io.emit('contact-test-progress', contactTestLoop);
        
        if (contactTestLoop.stopOnSuccess && contactList.length > 0) {
            console.log('\n*** SUCCESS! Found contacts, stopping loop ***');
            contactTestLoop.running = false;
            io.emit('contact-test-progress', contactTestLoop);
        }
        
    } catch (e) {
        console.log(`Test #${contactTestLoop.attempts} - Error:`, e.message);
        contactTestLoop.lastResult = {
            success: false,
            error: e.message,
            timestamp: new Date().toISOString()
        };
        io.emit('contact-test-progress', contactTestLoop);
    }
}

async function startContactTestLoop() {
    if (contactTestLoop.running && contactTestLoop.attempts > 0) return;
    
    contactTestLoop.running = true;
    contactTestLoop.attempts = 0;
    io.emit('contact-test-progress', contactTestLoop);
    
    console.log('=== Starting contact test loop ===');
    
    while (contactTestLoop.running && contactTestLoop.attempts < contactTestLoop.maxAttempts) {
        await runContactTest();
        
        if (contactTestLoop.running) {
            await new Promise(r => setTimeout(r, contactTestLoop.interval));
        }
    }
    
    if (contactTestLoop.attempts >= contactTestLoop.maxAttempts) {
        console.log(`=== Max attempts (${contactTestLoop.maxAttempts}) reached, stopping loop ===`);
        contactTestLoop.running = false;
        io.emit('contact-test-progress', contactTestLoop);
    }
}

function stopContactTestLoop() {
    console.log('=== Stopping contact test loop ===');
    contactTestLoop.running = false;
    io.emit('contact-test-progress', contactTestLoop);
}

function handleAutoReply(msg) {
    if (!autoReplyRules.length) return;

    for (const rule of autoReplyRules) {
        if (!rule.enabled) continue;

        let matched = false;
        if (rule.matchType === 'keyword' && msg.body.toLowerCase().includes(rule.keyword.toLowerCase())) {
            matched = true;
        } else if (rule.matchType === 'exact' && msg.body === rule.keyword) {
            matched = true;
        } else if (rule.matchType === 'regex') {
            try {
                const regex = new RegExp(rule.keyword);
                matched = regex.test(msg.body);
            } catch (e) {}
        }

        if (matched) {
            client.sendMessage(msg.from, rule.reply);
            io.emit('auto-reply', { keyword: rule.keyword, reply: rule.reply, to: msg.from });
            break;
        }
    }
}

function startScheduledTasks() {
    scheduledTasks.forEach(task => {
        if (task.running) return;

        const runTask = async () => {
            if (!client || clientStatus !== 'ready') return;

            try {
                const chats = await client.getChats();
                const targetChats = task.targetType === 'all' ? chats : 
                    chats.filter(c => c.isGroup === (task.targetType === 'groups'));

                for (const chat of targetChats) {
                    await client.sendMessage(chat.id._serialized, task.message);
                    await new Promise(r => setTimeout(r, 5000));
                }

                io.emit('scheduled-task', { 
                    name: task.name, 
                    executedAt: new Date().toISOString(),
                    sentCount: targetChats.length
                });
            } catch (e) {
                console.error('Scheduled task error:', e);
            }
        };

        if (task.type === 'once') {
            const delay = new Date(task.time) - new Date();
            if (delay > 0) {
                task.running = true;
                setTimeout(async () => {
                    await runTask();
                    task.running = false;
                }, delay);
            }
        } else if (task.type === 'daily') {
            task.running = true;
            const runDaily = async () => {
                await runTask();
                const now = new Date();
                const nextRun = new Date(now);
                nextRun.setDate(nextRun.getDate() + 1);
                nextRun.setHours(task.hour, task.minute, 0, 0);
                task.timeout = setTimeout(runDaily, nextRun - now);
            };
            const now = new Date();
            const nextRun = new Date(now);
            nextRun.setHours(task.hour, task.minute, 0, 0);
            if (nextRun <= now) nextRun.setDate(nextRun.getDate() + 1);
            task.timeout = setTimeout(runDaily, nextRun - now);
        }
    });
}

// 自动初始化客户端
initClient();

app.get('/api/status', (req, res) => {
    res.json({ status: clientStatus, qr: qrCode });
});

app.post('/api/connect', (req, res) => {
    if (client && clientStatus !== 'disconnected') {
        res.json({ success: false, message: 'Already connected' });
        return;
    }
    initClient();
    res.json({ success: true, message: 'Connecting...' });
});

app.post('/api/contact-test/start', (req, res) => {
    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }
    const body = req.body || {};
    const maxAttempts = body.maxAttempts || 100;
    const interval = body.interval || 3000;
    const stopOnSuccess = body.stopOnSuccess !== undefined ? body.stopOnSuccess : true;
    contactTestLoop.maxAttempts = maxAttempts;
    contactTestLoop.interval = interval;
    contactTestLoop.stopOnSuccess = stopOnSuccess;
    startContactTestLoop();
    res.json({ success: true });
});

app.post('/api/contact-test/stop', (req, res) => {
    stopContactTestLoop();
    res.json({ success: true });
});

app.get('/api/contact-test/status', (req, res) => {
    res.json(contactTestLoop);
});

app.get('/api/chats', async (req, res) => {
    if (!client || clientStatus !== 'ready') {
        return res.json({ chats: [] });
    }
    try {
        const chats = await client.getChats();
        
        // Debug: log first chat's available properties
        if (chats.length > 0) {
            console.log('First chat available keys:', Object.keys(chats[0]));
            console.log('First chat id keys:', Object.keys(chats[0].id));
            console.log('First chat id:', JSON.stringify(chats[0].id));
        }
        
        const chatList = chats.map(chat => ({
            id: chat.id._serialized,
            name: chat.name,
            isGroup: chat.isGroup,
            lastMessage: chat.lastMessage?.body || '',
            participants: chat.participants?.length || 0
        }));
        res.json({ chats: chatList });
    } catch (e) {
        res.json({ chats: [], error: e.message });
    }
});

app.get('/api/export-contacts', async (req, res) => {
    if (!client || clientStatus !== 'ready') {
        return res.json({ error: 'Client not ready' });
    }
    try {
        const chats = await client.getChats();
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
                contacts.push({
                    number: number,
                    name: chat.name || number
                });
            }
        }
        
        let csv = '手机号,姓名\n';
        contacts.forEach(c => {
            csv += `${c.number},${c.name}\n`;
        });
        
        res.setHeader('Content-Type', 'text/csv;charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=contacts.csv');
        res.send(csv);
    } catch (e) {
        res.json({ error: e.message });
    }
});

app.get('/api/contacts-list', async (req, res) => {
    if (!client || clientStatus !== 'ready') {
        return res.json({ contacts: [], error: 'Client not ready' });
    }
    try {
        console.log('Fetching contacts via Puppeteer...');
        
        const contactsData = await client.pupPage.evaluate(async () => {
            let contacts = [];
            
            // Method 1: Try _index first (most reliable for getting all contacts)
            if (window.require) {
                try {
                    const Collections = window.require('WAWebCollections');
                    if (Collections && Collections.Contact) {
                        // Try _index first (usually has all contacts)
                        if (Collections.Contact._index) {
                            const allContacts = Object.values(Collections.Contact._index);
                            // Filter to only include contacts with phoneNumber attribute (avoid duplicates)
                            contacts = allContacts.filter(c => {
                                try {
                                    const attrs = c.attributes || (c.serialize ? c.serialize() : c);
                                    return attrs && attrs.phoneNumber;
                                } catch(e) { return false; }
                            });
                            console.log('_index result:', allContacts?.length, 'filtered:', contacts?.length);
                        }
                        // Fallback to findAll
                        if ((!contacts || contacts.length === 0) && Collections.Contact.findAll) {
                            contacts = await Collections.Contact.findAll();
                            console.log('findAll result:', contacts?.length);
                        }
                        // Last resort: models
                        if ((!contacts || contacts.length === 0) && Collections.Contact.models && Collections.Contact.models.length > 0) {
                            contacts = Collections.Contact.models;
                            console.log('models result:', contacts.length);
                        }
                    }
                } catch(e) { console.log('Error WAWebCollections:', e.message); }
            }
            
            // Method 2: Try window.Store (older API)
            if (!contacts || contacts.length === 0) {
                if (window.Store && window.Store.Contact) {
                    try {
                        if (window.Store.Contact.findAll) {
                            contacts = await window.Store.Contact.findAll();
                            console.log('Store findAll result:', contacts?.length);
                        } else if (window.Store.Contact._index) {
                            contacts = Object.values(window.Store.Contact._index);
                            console.log('Store _index result:', contacts?.length);
                        } else if (window.Store.Contact.models && window.Store.Contact.models.length > 0) {
                            contacts = window.Store.Contact.models;
                            console.log('Store models result:', contacts?.length);
                        }
                    } catch(e) { console.log('Error Store.Contact:', e.message); }
                }
            }
            
            // Method 3: Try WAPI
            if (!contacts || contacts.length === 0) {
                if (window.WAPI && window.WAPI.getAllContacts) {
                    try {
                        contacts = await window.WAPI.getAllContacts();
                        console.log('WAPI result:', contacts?.length);
                    } catch(e) { console.log('Error WAPI:', e.message); }
                }
            }
            
            // Method 4: Fallback - get from Chat collection
            if (!contacts || contacts.length === 0) {
                try {
                    if (window.require) {
                        const Collections = window.require('WAWebCollections');
                        if (Collections && Collections.Chat && Collections.Chat.models) {
                            const chats = Collections.Chat.models;
                            const seenNumbers = new Set();
                            contacts = [];
                            for (const chat of chats) {
                                try {
                                    const contact = chat.attributes || chat;
                                    const number = contact.id?.user || contact.id?._serialized?.split('@')[0];
                                    if (number && !seenNumbers.has(number) && number.length > 5) {
                                        seenNumbers.add(number);
                                        contacts.push({
                                            attributes: {
                                                phone: number,
                                                displayName: contact.name || contact.rawName || number,
                                                isMe: false
                                            }
                                        });
                                    }
                                } catch(e) {}
                            }
                            console.log('Extracted from chats:', contacts?.length);
                        }
                    }
                } catch(e) { console.log('Error from Chat:', e.message); }
            }
            
            console.log('Final contacts array:', contacts?.length);
            
            const result = [];
            let countNoNumber = 0;
            let countTooShort = 0;
            let countAdded = 0;
            let countDuplicate = 0;
            const seenNumbers = new Set();
            
            for (const c of contacts || []) {
                try {
                    let attrs = null;
                    if (c.attributes) {
                        attrs = c.attributes;
                    } else if (c.serialize && typeof c.serialize === 'function') {
                        try {
                            attrs = c.serialize();
                        } catch (serializeError) {
                            attrs = c;
                        }
                    } else {
                        attrs = c;
                    }
                    
                    let number = attrs.phone || attrs.phoneNumber || attrs.id?.user || attrs.userid;
                    // Handle case where number is an object like {user: "xxx", server: "c.us"}
                    if (typeof number === 'object' && number !== null && number.user) {
                        number = number.user;
                    }
                    
                    // 如果没有电话号码，尝试使用id._serialized
                    if (!number && attrs.id && attrs.id._serialized) {
                        number = attrs.id._serialized.split('@')[0];
                    }
                    
                    if (!number || typeof number !== 'string') {
                        countNoNumber++;
                        continue;
                    }
                    if (number.length <= 5) {
                        countTooShort++;
                        continue;
                    }
                    
                    // 检查重复
                    if (seenNumbers.has(number)) {
                        countDuplicate++;
                        continue;
                    }
                    seenNumbers.add(number);
                    
                    // Debug: log first contact's id structure
                    if (countAdded === 0) {
                        console.log('First contact attrs.id:', JSON.stringify(attrs.id));
                        console.log('First contact attrs keys:', Object.keys(attrs));
                    }
                    
                    result.push({
                        number: number,
                        name: attrs.displayName || attrs.pushname || attrs.shortName || attrs.name || number,
                        isMe: attrs.isMe,
                        lid: attrs.id?.user || null,
                        id: attrs.id?._serialized || null
                    });
                    countAdded++;
                } catch(e) {
                    console.log('Error processing contact:', e.message);
                }
            }
            
            return {
                contacts: result,
                stats: {
                    total: contacts?.length || 0,
                    noNumber: countNoNumber,
                    tooShort: countTooShort,
                    duplicate: countDuplicate,
                    added: countAdded
                }
            };
        });
        
        const { contacts: rawContacts, stats } = contactsData;
        console.log('Contact processing stats:', stats);
        
        const isMeCount = rawContacts.filter(c => c.isMe).length;
        console.log('Filtered (isMe):', isMeCount);
        
        const uniqueNumbers = new Set();
        const contactList = [];
        for (const c of rawContacts) {
            if (c.isMe) continue;
            if (!uniqueNumbers.has(c.number)) {
                uniqueNumbers.add(c.number);
                contactList.push({
                    id: c.number + '@c.us',
                    name: c.name,
                    number: c.number,
                    lid: c.lid || null
                });
            }
        }
        
        console.log('Final contacts (after dedup):', contactList.length);
        res.json({ contacts: contactList, total: contactList.length, stats });
    } catch (e) {
        console.log('API Error:', e.message);
        res.json({ contacts: [], error: e.message });
    }
});

app.get('/api/chat/:id', async (req, res) => {
    if (!client || clientStatus !== 'ready') {
        return res.json({ error: 'Client not ready' });
    }
    try {
        const chat = await client.getChatById(req.params.id);
        const messages = await chat.fetchMessages({ limit: 50 });
        res.json({ 
            chat: { 
                id: chat.id._serialized,
                name: chat.name,
                isGroup: chat.isGroup 
            },
            messages: messages.map(m => ({
                id: m.id._serialized,
                body: m.body,
                type: m.type,
                from: m.from,
                fromMe: m.fromMe,
                timestamp: m.timestamp
            }))
        });
    } catch (e) {
        res.json({ error: e.message });
    }
});

app.post('/api/send', async (req, res) => {
    const { chatId, message } = req.body;
    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }
    try {
        await client.sendMessage(chatId, message);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/send-media', async (req, res) => {
    const { chatId, caption, mediaType } = req.body;
    
    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }

    try {
        const uploadsDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const files = fs.readdirSync(uploadsDir);
        const mediaFile = files.find(f => f.startsWith('media-'));

        if (!mediaFile) {
            return res.json({ success: false, error: 'No media file found in uploads folder' });
        }

        const mediaPath = path.join(uploadsDir, mediaFile);
        const media = MessageMedia.fromFilePath(mediaPath);

        await client.sendMessage(chatId, media, { caption });
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/upload', async (req, res) => {
    const { fileName, base64Data, mimeType } = req.body;
    
    try {
        const uploadsDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const buffer = Buffer.from(base64Data, 'base64');
        const filePath = path.join(uploadsDir, `media-${Date.now()}-${fileName}`);
        fs.writeFileSync(filePath, buffer);

        res.json({ success: true, filePath: filePath });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

function randomizeMessage(message) {
    let result = message;
    
    // 随机添加表情符号（20%概率）
    const emojis = ['😊', '👍', '✨', '🎉', '👋', '😄', '🙏', '💪'];
    if (Math.random() < 0.2) {
        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
        // 50% 加在前面，50% 加在后面
        if (Math.random() < 0.5) {
            result = randomEmoji + ' ' + result;
        } else {
            result = result + ' ' + randomEmoji;
        }
    }
    
    // 随机变换标点符号（30%概率）
    if (Math.random() < 0.3) {
        result = result.replace(/。/g, () => Math.random() < 0.5 ? '。' : '！');
    }
    
    return result;
}

async function getAllContactsFromPuppeteer() {
    const contactsData = await client.pupPage.evaluate(async () => {
        let contacts = [];
        
        // Method 1: Try _index first (most reliable for getting all contacts)
        if (window.require) {
            try {
                const Collections = window.require('WAWebCollections');
                if (Collections && Collections.Contact) {
                    // Try _index first (usually has all contacts)
                    if (Collections.Contact._index) {
                        const allContacts = Object.values(Collections.Contact._index);
                        // Filter to only include contacts with phoneNumber attribute (avoid duplicates)
                        contacts = allContacts.filter(c => {
                            try {
                                const attrs = c.attributes || (c.serialize ? c.serialize() : c);
                                return attrs && attrs.phoneNumber;
                            } catch(e) { return false; }
                        });
                        console.log('_index result:', allContacts?.length, 'filtered:', contacts?.length);
                    }
                    // Fallback to findAll
                    if ((!contacts || contacts.length === 0) && Collections.Contact.findAll) {
                        contacts = await Collections.Contact.findAll();
                        console.log('findAll result:', contacts?.length);
                    }
                    // Last resort: models
                    if ((!contacts || contacts.length === 0) && Collections.Contact.models && Collections.Contact.models.length > 0) {
                        contacts = Collections.Contact.models;
                        console.log('models result:', contacts.length);
                    }
                }
            } catch(e) { console.log('Error WAWebCollections:', e.message); }
        }
        
        // Method 2: Try window.Store (older API)
        if (!contacts || contacts.length === 0) {
            if (window.Store && window.Store.Contact) {
                try {
                    if (window.Store.Contact.findAll) {
                        contacts = await window.Store.Contact.findAll();
                        console.log('Store findAll result:', contacts?.length);
                    } else if (window.Store.Contact._index) {
                        contacts = Object.values(window.Store.Contact._index);
                        console.log('Store _index result:', contacts?.length);
                    } else if (window.Store.Contact.models && window.Store.Contact.models.length > 0) {
                        contacts = window.Store.Contact.models;
                        console.log('Store models result:', contacts?.length);
                    }
                } catch(e) { console.log('Error Store.Contact:', e.message); }
            }
        }
        
        // Method 3: Try WAPI
        if (!contacts || contacts.length === 0) {
            if (window.WAPI && window.WAPI.getAllContacts) {
                try {
                    contacts = await window.WAPI.getAllContacts();
                    console.log('WAPI result:', contacts?.length);
                } catch(e) { console.log('Error WAPI:', e.message); }
            }
        }
        
        console.log('Final contacts array:', contacts?.length);
        
        const result = [];
        let countNoNumber = 0;
        let countTooShort = 0;
        let countAdded = 0;
        let countDuplicate = 0;
        const seenNumbers = new Set();
        
        for (const c of contacts || []) {
            try {
                let attrs = null;
                if (c.attributes) {
                    attrs = c.attributes;
                } else if (c.serialize && typeof c.serialize === 'function') {
                    try {
                        attrs = c.serialize();
                    } catch (serializeError) {
                        attrs = c;
                    }
                } else {
                    attrs = c;
                }
                
                let number = attrs.phone || attrs.phoneNumber || attrs.id?.user || attrs.userid;
                // Handle case where number is an object like {user: "xxx", server: "c.us"}
                if (typeof number === 'object' && number !== null && number.user) {
                    number = number.user;
                }
                
                // 如果没有电话号码，尝试使用id._serialized
                if (!number && attrs.id && attrs.id._serialized) {
                    number = attrs.id._serialized.split('@')[0];
                }
                
                if (!number || typeof number !== 'string') {
                    countNoNumber++;
                    continue;
                }
                if (number.length <= 5) {
                    countTooShort++;
                    continue;
                }
                
                // 检查重复
                if (seenNumbers.has(number)) {
                    countDuplicate++;
                    continue;
                }
                seenNumbers.add(number);
                
                result.push({
                    number: number,
                    name: attrs.displayName || attrs.pushname || attrs.shortName || attrs.name || number,
                    isMe: attrs.isMe,
                    lid: attrs.id?.user || null,
                    id: attrs.id?._serialized || null
                });
                countAdded++;
            } catch(e) {
                console.log('Error processing contact:', e.message);
            }
        }
        
        return {
            contacts: result,
            stats: {
                total: contacts?.length || 0,
                noNumber: countNoNumber,
                tooShort: countTooShort,
                duplicate: countDuplicate,
                added: countAdded
            }
        };
    });
    
    return contactsData;
}

app.post('/api/broadcast', async (req, res) => {
    const { message, interval = 10000, randomInterval = true, randomizeMsg = true, respectHours = true, randomPause = true, excludeGroups = true, personalize, targetType = 'chats', manualNumbers } = req.body;
    
    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }
    
    if (broadcastProgress.running) {
        return res.json({ success: false, error: 'Broadcast already running' });
    }
    
    try {
        let targetItems = [];
        
        if (targetType === 'manual' && manualNumbers) {
            const lines = manualNumbers.split('\n').filter(l => l.trim());
            targetItems = lines.map(line => {
                const parts = line.split('|');
                const number = parts[0].trim();
                const name = parts[1]?.trim() || number;
                return {
                    id: number + '@c.us',
                    name: name,
                    isGroup: false
                };
            });
            console.log('Manual targets:', targetItems.length);
        } else if (targetType === 'contacts') {
            console.log('Fetching ALL contacts via Puppeteer...');
            
            const { contacts: contactsData, stats } = await getAllContactsFromPuppeteer();
            console.log('Contact stats:', stats);
            
            const filtered = contactsData.filter(c => !c.isMe);
            
            const uniqueNums = new Set();
            targetItems = [];
            for (const c of filtered) {
                if (!uniqueNums.has(c.number)) {
                    uniqueNums.add(c.number);
                    targetItems.push({
                        id: c.id || c.number + '@c.us',
                        name: c.name,
                        number: c.number,
                        lid: c.lid,
                        isGroup: false
                    });
                }
            }
            console.log('Found ALL contacts:', targetItems.length);
        } else if (targetType === 'nohistory') {
            console.log('Fetching contacts with NO chat history...');
            
            const { contacts: contactsData, stats } = await getAllContactsFromPuppeteer();
            console.log('Contact stats:', stats);
            
            const chats = await client.getChats();
            
            // 构建聊天记录的 ID 集合（多种格式）
            const chatNumbers = new Set();
            const chatLids = new Set();
            const chatNames = new Set();
            
            for (const chat of chats) {
                // 提取数字 ID
                let number = null;
                if (chat.id?.user) {
                    number = chat.id.user;
                } else if (chat.id?._serialized) {
                    const match = chat.id._serialized.match(/^(\d+)@/);
                    if (match) number = match[1];
                }
                if (number) {
                    chatNumbers.add(number);
                }
                
                // 提取 lid
                if (chat.id?._serialized && chat.id._serialized.endsWith('@lid')) {
                    const lidMatch = chat.id._serialized.match(/^(\d+)@lid/);
                    if (lidMatch) chatLids.add(lidMatch[1]);
                }
                
                // 提取名字
                if (chat.name) {
                    chatNames.add(chat.name.toLowerCase().trim());
                }
            }
            
            console.log('Chat numbers count:', chatNumbers.size);
            console.log('Chat lids count:', chatLids.size);
            console.log('Chat names count:', chatNames.size);
            
            const filteredContacts = contactsData.filter(c => {
                if (c.isMe) return false;
                
                const num = c.number.replace(/^\+/, '');
                const nameMatch = c.name ? chatNames.has(c.name.toLowerCase().trim()) : false;
                const partialMatch = c.name && Array.from(chatNames).some(chatName =>
                    chatName.includes(c.name.toLowerCase().trim()) || 
                    c.name.toLowerCase().trim().includes(chatName)
                );
                
                // 多种方式检查是否在聊天记录中
                const inChatsByLid = c.lid && (chatNumbers.has(c.lid) || chatLids.has(c.lid));
                const inChatsByNumber = chatNumbers.has(num) || chatNumbers.has(c.number);
                const inChatsById = c.id && chatNumbers.has(c.id.split('@')[0]);
                
                const isNoHistory = !inChatsByLid && !inChatsByNumber && !inChatsById && !nameMatch && !partialMatch;
                
                if (!isNoHistory) {
                    console.log(`Filtered out: ${c.name} (${c.number}), lid=${c.lid}, id=${c.id}, inChatsByLid=${inChatsByLid}, inChatsByNumber=${inChatsByNumber}`);
                }
                
                return isNoHistory;
            });
            
            console.log('Filtered no-history contacts:', filteredContacts.length);
            
            const uniqueNums = new Set();
            targetItems = [];
            for (const c of filteredContacts) {
                if (!uniqueNums.has(c.number)) {
                    uniqueNums.add(c.number);
                    targetItems.push({
                        id: c.id || c.number + '@c.us',
                        name: c.name,
                        number: c.number,
                        lid: c.lid,
                        isGroup: false
                    });
                }
            }
            console.log('Found NO HISTORY contacts:', targetItems.length);
        } else {
            const chats = await client.getChats();
            const seenIds = new Set();
            targetItems = [];
            for (const chat of chats) {
                if (excludeGroups && chat.isGroup) continue;
                if (!seenIds.has(chat.id._serialized)) {
                    seenIds.add(chat.id._serialized);
                    targetItems.push({
                        id: chat.id._serialized,
                        name: chat.name,
                        isGroup: chat.isGroup
                    });
                }
            }
        }
        
        // 在广播开始前，打印目标列表供确认
        console.log('Broadcast targets preview (first 10):', targetItems.slice(0, 10).map(t => ({ name: t.name, id: t.id })));
        console.log('Total targets:', targetItems.length);
        
        // 首次发送延迟
        if (randomInterval) {
            const initialDelay = Math.floor(Math.random() * 5000 + 2000); // 2-7秒
            console.log(`Starting broadcast in ${initialDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, initialDelay));
        }
        
        broadcastProgress = {
            running: true,
            current: 0,
            total: targetItems.length,
            results: [],
            message: message,
            interval: interval
        };
        
        io.emit('broadcast-progress', broadcastProgress);
        
        let messageCount = 0;
        
        for (const item of targetItems) {
            if (!broadcastProgress.running) break;
            
            // 检查是否在允许的发送时间段内
            if (respectHours) {
                const now = new Date();
                const hour = now.getHours();
                if (hour < 9 || hour >= 22) {
                    console.log('Outside sending hours (9:00-22:00), skipping...');
                    broadcastProgress.results.push({ 
                        name: item.name, 
                        status: 'skipped',
                        error: 'Outside sending hours (9:00-22:00)' 
                    });
                    broadcastProgress.current++;
                    io.emit('broadcast-progress', broadcastProgress);
                    continue;
                }
            }
            
            // 每发送 5-10 条后随机暂停 10-30 秒
            if (randomPause && messageCount > 0 && messageCount % Math.floor(Math.random() * 6 + 5) === 0) {
                const pauseTime = Math.floor(Math.random() * 20000 + 10000);
                console.log(`Taking a break for ${pauseTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, pauseTime));
            }
            
            try {
                let finalMessage = message;
                if (personalize && item.name) {
                    finalMessage = message.replace(/{name}/g, item.name);
                }
                // 如果启用消息随机化，对消息内容进行微调
                if (randomizeMsg) {
                    finalMessage = randomizeMessage(finalMessage);
                }
                // 使用正确的 chat ID
                let chatId = item.id;
                if (!chatId.includes('@')) {
                    // 如果没有 @，根据 lid 判断格式
                    chatId = item.lid ? item.lid + '@lid' : item.number + '@c.us';
                }
                console.log('Sending to:', item.name, chatId);
                await client.sendMessage(chatId, finalMessage);
                broadcastProgress.results.push({ 
                    name: item.name, 
                    status: 'success' 
                });
                messageCount++;
            } catch (e) {
                broadcastProgress.results.push({ 
                    name: item.name, 
                    status: 'failed',
                    error: e.message 
                });
            }
            
            broadcastProgress.current++;
            io.emit('broadcast-progress', broadcastProgress);
            
            // 计算随机间隔
            let actualInterval = interval;
            if (randomInterval) {
                // 在基础间隔的 ±30% 范围内随机
                const minInterval = Math.max(3000, interval * 0.7);  // 最少3秒
                const maxInterval = interval * 1.3;
                actualInterval = Math.floor(Math.random() * (maxInterval - minInterval) + minInterval);
                console.log(`Next message in ${actualInterval}ms (base: ${interval}ms)`);
            }
            await new Promise(resolve => setTimeout(resolve, actualInterval));
        }
        
        broadcastProgress.running = false;
        io.emit('broadcast-progress', broadcastProgress);
        
        res.json({ success: true, progress: broadcastProgress });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/broadcast-stop', (req, res) => {
    broadcastProgress.running = false;
    io.emit('broadcast-progress', broadcastProgress);
    res.json({ success: true });
});

app.get('/api/broadcast-status', (req, res) => {
    res.json(broadcastProgress);
});

app.get('/api/auto-reply', (req, res) => {
    res.json({ rules: autoReplyRules });
});

app.post('/api/auto-reply', (req, res) => {
    const { keyword, reply, matchType, enabled } = req.body;
    const rule = {
        id: Date.now(),
        keyword,
        reply,
        matchType: matchType || 'keyword',
        enabled: enabled !== false
    };
    autoReplyRules.push(rule);
    res.json({ success: true, rule });
});

app.post('/api/auto-reply/:id', (req, res) => {
    const { id } = req.params;
    const { keyword, reply, matchType, enabled } = req.body;
    
    const rule = autoReplyRules.find(r => r.id == id);
    if (rule) {
        if (keyword) rule.keyword = keyword;
        if (reply) rule.reply = reply;
        if (matchType) rule.matchType = matchType;
        if (enabled !== undefined) rule.enabled = enabled;
        res.json({ success: true, rule });
    } else {
        res.json({ success: false, error: 'Rule not found' });
    }
});

app.delete('/api/auto-reply/:id', (req, res) => {
    const { id } = req.params;
    autoReplyRules = autoReplyRules.filter(r => r.id != id);
    res.json({ success: true });
});

app.get('/api/scheduled-tasks', (req, res) => {
    res.json({ tasks: scheduledTasks });
});

app.post('/api/scheduled-tasks', (req, res) => {
    const { name, message, targetType, type, time, hour, minute } = req.body;
    
    const task = {
        id: Date.now(),
        name,
        message,
        targetType: targetType || 'all',
        type: type || 'once',
        time,
        hour: hour || 9,
        minute: minute || 0,
        running: false
    };
    
    scheduledTasks.push(task);
    
    if (clientStatus === 'ready') {
        startScheduledTasks();
    }
    
    res.json({ success: true, task });
});

app.delete('/api/scheduled-tasks/:id', (req, res) => {
    const { id } = req.params;
    const task = scheduledTasks.find(t => t.id == id);
    if (task && task.timeout) {
        clearTimeout(task.timeout);
    }
    scheduledTasks = scheduledTasks.filter(t => t.id != id);
    res.json({ success: true });
});

app.get('/api/contacts', async (req, res) => {
    if (!client || clientStatus !== 'ready') {
        return res.json({ contacts: [] });
    }
    try {
        const contacts = await client.getContacts();
        res.json({ 
            contacts: contacts.map(c => ({
                id: c.id?._serialized || c.id,
                name: c.name,
                pushname: c.pushname
            })) 
        });
    } catch (e) {
        res.json({ contacts: [], error: e.message });
    }
});

app.post('/api/group/create', async (req, res) => {
    const { name, participants } = req.body;
    
    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }
    
    try {
        const result = await client.createGroup(name, participants);
        res.json({ success: true, result });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/group/:id/add', async (req, res) => {
    const { id } = req.params;
    const { participants } = req.body;
    
    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }
    
    try {
        const chat = await client.getChatById(id);
        const result = await chat.addParticipants(participants);
        res.json({ success: true, result });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/group/:id/remove', async (req, res) => {
    const { id } = req.params;
    const { participants } = req.body;
    
    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }
    
    try {
        const chat = await client.getChatById(id);
        for (const participant of participants) {
            await chat.removeParticipants([participant]);
        }
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/group/:id/leave', async (req, res) => {
    const { id } = req.params;
    
    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }
    
    try {
        const chat = await client.getChatById(id);
        await chat.leave();
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/chat/:id/mark-seen', async (req, res) => {
    const { id } = req.params;
    
    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }
    
    try {
        const chat = await client.getChatById(id);
        await chat.sendSeen();
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/chat/:id/pin', async (req, res) => {
    const { id } = req.params;
    const { pin } = req.body;
    
    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }
    
    try {
        const chat = await client.getChatById(id);
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

app.post('/api/chat/:id/archive', async (req, res) => {
    const { id } = req.params;
    
    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }
    
    try {
        const chat = await client.getChatById(id);
        await chat.archive();
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/chat/:id/mute', async (req, res) => {
    const { id } = req.params;
    const { duration } = req.body;
    
    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }
    
    try {
        const chat = await client.getChatById(id);
        const unmuteDate = new Date(Date.now() + (duration || 3600000));
        await chat.mute(unmuteDate);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/chat/:id/unmute', async (req, res) => {
    const { id } = req.params;
    
    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }
    
    try {
        const chat = await client.getChatById(id);
        await chat.unmute();
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.get('/api/chat/:id/messages', async (req, res) => {
    const { id } = req.params;
    const { limit = 50 } = req.query;
    
    if (!client || clientStatus !== 'ready') {
        return res.json({ error: 'Client not ready' });
    }
    
    try {
        const chat = await client.getChatById(id);
        const messages = await chat.fetchMessages({ limit: parseInt(limit) });
        res.json({ 
            messages: messages.map(m => ({
                id: m.id._serialized,
                body: m.body,
                type: m.type,
                from: m.from,
                fromMe: m.fromMe,
                timestamp: m.timestamp,
                hasMedia: m.hasMedia
            }))
        });
    } catch (e) {
        res.json({ error: e.message });
    }
});

app.delete('/api/message/:id', async (req, res) => {
    const { id } = req.params;
    const { deleteForEveryone = true } = req.body;
    
    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }
    
    try {
        const message = await client.getMessageById(id);
        if (message) {
            await message.delete(deleteForEveryone);
            res.json({ success: true });
        } else {
            res.json({ success: false, error: 'Message not found' });
        }
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/message/:id/react', async (req, res) => {
    const { id } = req.params;
    const { reaction } = req.body;
    
    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }
    
    try {
        const message = await client.getMessageById(id);
        if (message) {
            await message.react(reaction);
            res.json({ success: true });
        } else {
            res.json({ success: false, error: 'Message not found' });
        }
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/message/:id/forward', async (req, res) => {
    const { id } = req.params;
    const { chatId } = req.body;
    
    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }
    
    try {
        const message = await client.getMessageById(id);
        if (message) {
            await message.forward(chatId);
            res.json({ success: true });
        } else {
            res.json({ success: false, error: 'Message not found' });
        }
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.get('/api/contact/:id', async (req, res) => {
    const { id } = req.params;
    
    if (!client || clientStatus !== 'ready') {
        return res.json({ error: 'Client not ready' });
    }
    
    try {
        const contact = await client.getContactById(id);
        res.json({ 
            contact: {
                id: contact.id?._serialized || contact.id,
                name: contact.name,
                pushname: contact.pushname,
                profilePicUrl: contact.profilePicUrl,
                isMe: contact.isMe,
                isUser: contact.isUser,
                isGroup: contact.isGroup,
                isWAContact: contact.isWAContact,
                isBusiness: contact.isBusiness
            }
        });
    } catch (e) {
        res.json({ error: e.message });
    }
});

app.get('/api/contact/:id/profile-pic', async (req, res) => {
    const { id } = req.params;
    
    if (!client || clientStatus !== 'ready') {
        return res.json({ error: 'Client not ready' });
    }
    
    try {
        const profilePicUrl = await client.getProfilePicUrl(id);
        res.json({ profilePicUrl });
    } catch (e) {
        res.json({ profilePicUrl: null });
    }
});

app.post('/api/group/:id/set-description', async (req, res) => {
    const { id } = req.params;
    const { description } = req.body;
    
    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }
    
    try {
        const chat = await client.getChatById(id);
        await chat.setDescription(description);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/group/:id/set-subject', async (req, res) => {
    const { id } = req.params;
    const { subject } = req.body;
    
    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }
    
    try {
        const chat = await client.getChatById(id);
        await chat.setSubject(subject);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/group/:id/promote-admin', async (req, res) => {
    const { id } = req.params;
    const { participants } = req.body;
    
    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }
    
    try {
        const chat = await client.getChatById(id);
        for (const participant of participants) {
            await chat.promoteParticipant(participant);
        }
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/group/:id/demote-admin', async (req, res) => {
    const { id } = req.params;
    const { participants } = req.body;
    
    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }
    
    try {
        const chat = await client.getChatById(id);
        for (const participant of participants) {
            await chat.demoteParticipant(participant);
        }
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.get('/api/group/:id/invite-code', async (req, res) => {
    const { id } = req.params;
    
    if (!client || clientStatus !== 'ready') {
        return res.json({ error: 'Client not ready' });
    }
    
    try {
        const inviteCode = await client.getInviteCode(id);
        res.json({ inviteCode });
    } catch (e) {
        res.json({ error: e.message });
    }
});

app.get('/api/stats', async (req, res) => {
    if (!client || clientStatus !== 'ready') {
        return res.json({ error: 'Client not ready' });
    }
    
    try {
        const chats = await client.getChats();
        
        let privateChats = 0;
        let groupChats = 0;
        let totalMessages = 0;
        let groupsWithMembers = {};
        
        for (const chat of chats) {
            if (chat.isGroup) {
                groupChats++;
                groupsWithMembers[chat.name] = chat.participants?.length || 0;
            } else {
                privateChats++;
            }
        }
        
        res.json({
            stats: {
                totalChats: chats.length,
                privateChats,
                groupChats,
                topGroups: Object.entries(groupsWithMembers)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10)
            }
        });
    } catch (e) {
        res.json({ error: e.message });
    }
});

app.get('/api/broadcast-logs', (req, res) => {
    res.json({ logs: broadcastProgress });
});

app.post('/api/send-location', async (req, res) => {
    const { chatId, latitude, longitude, title } = req.body;
    
    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }
    
    try {
        const location = new (require('./index')).Location(latitude, longitude, { name: title });
        await client.sendMessage(chatId, location);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/send-contact', async (req, res) => {
    const { chatId, contactId } = req.body;
    
    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }
    
    try {
        const contact = await client.getContactById(contactId);
        const vCard = `BEGIN:VCARD\nVERSION:3.0\nFN:${contact.name || contact.pushname}\nEND:VCARD`;
        const { MessageMedia } = require('./index');
        const media = new MessageMedia('text/vcard', vCard);
        await client.sendMessage(chatId, media);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/send-poll', async (req, res) => {
    const { chatId, question, options, allowMultipleAnswers } = req.body;
    
    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }
    
    try {
        const { Poll } = require('./index');
        const poll = new Poll(question, options, { allowMultipleAnswers });
        await client.sendMessage(chatId, poll);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.get('/api/search-messages', async (req, res) => {
    const { query, chatId } = req.query;
    
    if (!client || clientStatus !== 'ready') {
        return res.json({ error: 'Client not ready' });
    }
    
    try {
        const chats = await client.getChats();
        let results = [];
        
        for (const chat of chats) {
            if (chatId && chat.id._serialized !== chatId) continue;
            
            const messages = await chat.fetchMessages({ limit: 100 });
            const matched = messages.filter(m => 
                m.body && m.body.toLowerCase().includes(query.toLowerCase())
            );
            
            results = results.concat(matched.map(m => ({
                id: m.id._serialized,
                body: m.body,
                chatId: chat.id._serialized,
                chatName: chat.name,
                timestamp: m.timestamp,
                fromMe: m.fromMe
            })));
            
            if (results.length >= 50) break;
        }
        
        res.json({ results: results.slice(0, 50) });
    } catch (e) {
        res.json({ error: e.message });
    }
});

app.get('/api/channel/list', async (req, res) => {
    if (!client || clientStatus !== 'ready') {
        return res.json({ channels: [] });
    }
    
    try {
        const chats = await client.getChats();
        const channels = chats.filter(c => c.isChannel);
        res.json({ 
            channels: channels.map(c => ({
                id: c.id._serialized,
                name: c.name,
                description: c.description
            })) 
        });
    } catch (e) {
        res.json({ channels: [], error: e.message });
    }
});

app.post('/api/channel/create', async (req, res) => {
    const { name, description } = req.body;
    
    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }
    
    try {
        const result = await client.createChannel(name, description);
        res.json({ success: true, result });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/join-group', async (req, res) => {
    const { inviteCode } = req.body;
    
    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }
    
    try {
        await client.acceptInvite(inviteCode);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.get('/api/chat/:id/pin-message', async (req, res) => {
    const { id } = req.params;
    const { duration = 604800 } = req.query;
    
    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }
    
    try {
        const message = await client.getMessageById(id);
        if (message) {
            const result = await message.pin(parseInt(duration));
            res.json({ success: result });
        } else {
            res.json({ success: false, error: 'Message not found' });
        }
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.get('/api/chat/:id/unpin-message', async (req, res) => {
    const { id } = req.params;
    
    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }
    
    try {
        const message = await client.getMessageById(id);
        if (message) {
            const result = await message.unpin();
            res.json({ success: result });
        } else {
            res.json({ success: false, error: 'Message not found' });
        }
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/profile/update-name', async (req, res) => {
    const { name } = req.body;
    
    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }
    
    try {
        await client.setDisplayName(name);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/profile/update-status', async (req, res) => {
    const { status } = req.body;
    
    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }
    
    try {
        await client.setStatus(status);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/block/:id', async (req, res) => {
    const { id } = req.params;
    
    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }
    
    try {
        await client.blockContact(id);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/unblock/:id', async (req, res) => {
    const { id } = req.params;
    
    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }
    
    try {
        await client.unblockContact(id);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/send-sticker', async (req, res) => {
    const { chatId, filePath, url } = req.body;
    
    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }
    
    try {
        let media;
        if (url) {
            media = await MessageMedia.fromUrl(url);
        } else if (filePath) {
            media = MessageMedia.fromFilePath(filePath);
        }
        
        if (!media) {
            return res.json({ success: false, error: 'No media provided' });
        }
        
        await client.sendMessage(chatId, media, { sendMediaAsSticker: true });
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.get('/api/labels', async (req, res) => {
    if (!client || clientStatus !== 'ready') {
        return res.json({ labels: [] });
    }
    
    try {
        const labels = await client.getLabels();
        res.json({ 
            labels: labels.map(l => ({
                id: l.id,
                name: l.name,
                color: l.color
            }))
        });
    } catch (e) {
        res.json({ labels: [], error: e.message });
    }
});

app.post('/api/chat/:id/label', async (req, res) => {
    const { id } = req.params;
    const { labelId, action } = req.body;
    
    if (!client || clientStatus !== 'ready') {
        return res.json({ success: false, error: 'Client not ready' });
    }
    
    try {
        if (action === 'add') {
            await client.addOrRemoveLabels([labelId], [id]);
        } else {
            await client.addOrRemoveLabels([], [id]);
        }
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

io.on('connection', (socket) => {
    socket.emit('status', { status: clientStatus, qr: qrCode });
    socket.emit('broadcast-progress', broadcastProgress);
    socket.emit('auto-reply-rules', { rules: autoReplyRules });
    socket.emit('scheduled-tasks', { tasks: scheduledTasks });
    socket.emit('contact-test-progress', contactTestLoop);
});

// 全局错误处理
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // 防止服务器崩溃，记录错误但继续运行
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // 防止服务器崩溃，记录错误但继续运行
});

const PORT = 3003;
server.listen(PORT, () => {
    console.log(`Web interface running at http://localhost:${PORT}`);
});
