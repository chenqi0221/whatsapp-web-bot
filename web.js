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
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ],
        timeout: 120000,
    },
};

function initClient() {
    if (client) {
        client.destroy();
    }

    client = new Client(clientConfig);

    client.on('qr', (qr) => {
        qrCode = qr;
        clientStatus = 'qr';
        io.emit('status', { status: 'qr', qr });
    });

    client.on('ready', () => {
        clientStatus = 'ready';
        qrCode = null;
        io.emit('status', { status: 'ready' });
        startScheduledTasks();
        console.log('\n\n===== WhatsApp Ready! Starting auto contact test loop =====\n');
        contactTestLoop.attempts = 0;
        startContactTestLoop();
    });

    client.on('authenticated', () => {
        clientStatus = 'authenticated';
        io.emit('status', { status: 'authenticated' });
    });

    client.on('auth_failure', (msg) => {
        clientStatus = 'auth_failure';
        io.emit('status', { status: 'auth_failure', message: msg });
    });

    client.on('disconnected', (reason) => {
        clientStatus = 'disconnected';
        io.emit('status', { status: 'disconnected', reason });
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

    client.initialize();
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
                    } else if (c.serialize) {
                        attrs = c.serialize();
                    } else {
                        attrs = c;
                    }
                    
                    const number = attrs.phone || attrs.phoneNumber || attrs.id?.user || attrs.userid;
                    
                    if (!number) {
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
                        isMe: attrs.isMe
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
                    await new Promise(r => setTimeout(r, 2000));
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

initClient();

app.get('/api/status', (req, res) => {
    res.json({ status: clientStatus, qr: qrCode });
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
            
            // Method 1: Try window.require('WAWebCollections') - NEW API
            if (window.require) {
                try {
                    const Collections = window.require('WAWebCollections');
                    if (Collections && Collections.Contact) {
                        // Try _index first (new API)
                        if (Collections.Contact._index) {
                            contacts = Object.values(Collections.Contact._index);
                            console.log('WAWebCollections.Contact._index result:', contacts?.length);
                        }
                        // Try findAll
                        if ((!contacts || contacts.length === 0) && Collections.Contact.findAll) {
                            contacts = await Collections.Contact.findAll();
                            console.log('findAll result:', contacts?.length);
                        }
                        // Try models
                        if ((!contacts || contacts.length === 0) && Collections.Contact.models) {
                            contacts = Collections.Contact.models;
                            console.log('models result:', contacts?.length);
                        }
                    }
                } catch(e) { console.log('Error WAWebCollections:', e.message); }
            }
            
            // Method 2: Try window.Store (older API)
            if (!contacts || contacts.length === 0) {
                if (window.Store && window.Store.Contact) {
                    try {
                        if (window.Store.Contact._index) {
                            contacts = Object.values(window.Store.Contact._index);
                        } else if (window.Store.Contact.findAll) {
                            contacts = await window.Store.Contact.findAll();
                        } else if (window.Store.Contact.models) {
                            contacts = window.Store.Contact.models;
                        }
                        console.log('Store.Contact result:', contacts?.length);
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
            for (const c of contacts || []) {
                try {
                    let attrs = null;
                    if (c.attributes) {
                        attrs = c.attributes;
                    } else if (c.serialize) {
                        attrs = c.serialize();
                    } else {
                        attrs = c;
                    }
                    const number = attrs.phone || attrs.phoneNumber || attrs.id?.user || attrs.userid;
                    if (number && number.length > 5) {
                        result.push({
                            number: number,
                            name: attrs.displayName || attrs.pushname || attrs.shortName || attrs.name || number,
                            isMe: attrs.isMe
                        });
                    }
                } catch(e) {}
            }
            return result;
        });
        
        console.log('Processed contacts:', contactsData.length);
        
        const contactList = contactsData
            .filter(c => !c.isMe)
            .map(c => ({
                id: c.number + '@c.us',
                name: c.name,
                number: c.number
            }));
        
        console.log('Final contacts:', contactList.length);
        res.json({ contacts: contactList, total: contactList.length });
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

app.post('/api/broadcast', async (req, res) => {
    const { message, interval = 10000, excludeGroups = true, personalize, targetType = 'chats', manualNumbers } = req.body;
    
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
            
            const contactsData = await client.pupPage.evaluate(async () => {
                let contacts = [];
                
                if (window.require) {
                    try {
                        const Collections = window.require('WAWebCollections');
                        if (Collections && Collections.Contact && Collections.Contact._index) {
                            contacts = Object.values(Collections.Contact._index);
                            console.log('Contact._index result:', contacts?.length);
                        }
                    } catch(e) { console.log('Error:', e.message); }
                }
                
                const result = [];
                for (const c of contacts || []) {
                    try {
                        let attrs = null;
                        if (c.attributes) {
                            attrs = c.attributes;
                        } else if (c.serialize) {
                            attrs = c.serialize();
                        } else {
                            attrs = c;
                        }
                        const number = attrs.phone || attrs.phoneNumber || attrs.id?.user || attrs.userid;
                        if (number && number.length > 5) {
                            result.push({
                                number: number,
                                name: attrs.displayName || attrs.pushname || attrs.shortName || attrs.name || number,
                                isMe: attrs.isMe
                            });
                        }
                    } catch(e) {}
                }
                return result;
            });
            
            const filtered = contactsData.filter(c => !c.isMe);
            targetItems = filtered.map(c => ({
                id: c.number + '@c.us',
                name: c.name,
                number: c.number,
                isGroup: false
            }));
            console.log('Found ALL contacts:', targetItems.length);
        } else {
            const chats = await client.getChats();
            targetItems = chats
                .filter(chat => !excludeGroups || !chat.isGroup)
                .map(chat => ({
                    id: chat.id._serialized,
                    name: chat.name,
                    isGroup: chat.isGroup
                }));
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
        
        for (const item of targetItems) {
            if (!broadcastProgress.running) break;
            
            try {
                let finalMessage = message;
                if (personalize && item.name) {
                    finalMessage = message.replace(/{name}/g, item.name);
                }
                const chatId = item.id._serialized || item.id;
                console.log('Sending to:', item.name, chatId);
                await client.sendMessage(chatId, finalMessage);
                broadcastProgress.results.push({ 
                    name: item.name, 
                    status: 'success' 
                });
            } catch (e) {
                broadcastProgress.results.push({ 
                    name: item.name, 
                    status: 'failed',
                    error: e.message 
                });
            }
            
            broadcastProgress.current++;
            io.emit('broadcast-progress', broadcastProgress);
            
            await new Promise(resolve => setTimeout(resolve, interval));
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

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Web interface running at http://localhost:${PORT}`);
});
