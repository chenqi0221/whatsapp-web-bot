const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');
const logger = require('../utils/logger');

// In-memory storage for imported contacts (per session)
const importedContactsMap = new Map();

function parseCSV(content) {
    const records = csv.parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
    });
    return records;
}

function extractContact(record) {
    // Try common column names for name
    const nameKeys = [
        'name', 'Name',
        '联系人', '联系人名称', '商家名称',
        'title', 'Title',
        'company', 'Company',
        'English', 'english', 'Chinese', 'chinese',  // B2B scraper format
        '商家名', '店铺名称', '店名',
    ];
    let name = '';
    for (const key of nameKeys) {
        if (record[key] && String(record[key]).trim()) {
            name = String(record[key]).trim();
            break;
        }
    }

    // Try common column names for phone
    const phoneKeys = ['phone', 'Phone', '电话', '手机号', '手机号码', '电话号', 'mobile', 'Mobile', 'tel', 'Tel'];
    let phone = '';
    for (const key of phoneKeys) {
        if (record[key] && record[key].trim()) {
            phone = record[key].trim();
            break;
        }
    }

    // If no explicit phone column, try to find any column that looks like a phone number
    if (!phone) {
        for (const [key, value] of Object.entries(record)) {
            const str = String(value).trim();
            // Match phone-like numbers (at least 7 digits, optional + prefix)
            if (/^\+?\d[\d\s\-\(\)]{6,}$/.test(str)) {
                phone = str;
                break;
            }
        }
    }

    // Clean phone number: remove non-digit except leading +
    let cleanPhone = phone;
    if (phone.startsWith('+')) {
        cleanPhone = '+' + phone.substring(1).replace(/\D/g, '');
    } else {
        cleanPhone = phone.replace(/\D/g, '');
    }

    return { name, phone, cleanPhone, raw: record };
}

function createImportedContactsRoutes(app) {
    // Scan project root for CSV files
    app.get('/api/imported-contacts/scan-csv', (req, res) => {
        try {
            const projectRoot = path.resolve(__dirname, '..', '..');
            const files = fs.readdirSync(projectRoot);
            const csvFiles = files
                .filter(f => f.toLowerCase().endsWith('.csv'))
                .map(f => ({
                    name: f,
                    path: path.join(projectRoot, f),
                }));

            res.json({ success: true, files: csvFiles });
        } catch (e) {
            logger.error('Scan CSV error:', e.message);
            res.json({ success: false, error: e.message });
        }
    });

    // Preview CSV file contents
    app.post('/api/imported-contacts/preview-csv', (req, res) => {
        try {
            const { filePath } = req.body;
            if (!filePath || !fs.existsSync(filePath)) {
                return res.json({ success: false, error: '文件不存在' });
            }

            const content = fs.readFileSync(filePath, 'utf-8');
            const records = parseCSV(content);

            // Extract contacts from first 20 rows for preview
            const contacts = records.slice(0, 20).map(extractContact);
            const columns = records.length > 0 ? Object.keys(records[0]) : [];

            res.json({
                success: true,
                total: records.length,
                preview: contacts,
                columns,
                fileName: path.basename(filePath),
            });
        } catch (e) {
            logger.error('Preview CSV error:', e.message);
            res.json({ success: false, error: e.message });
        }
    });

    // Import contacts from CSV file
    app.post('/api/imported-contacts/import', (req, res) => {
        try {
            const { filePath, sessionId = 'default' } = req.body;
            if (!filePath || !fs.existsSync(filePath)) {
                return res.json({ success: false, error: '文件不存在' });
            }

            const content = fs.readFileSync(filePath, 'utf-8');
            const records = parseCSV(content);

            const contacts = records
                .map(extractContact)
                .filter(c => c.cleanPhone && c.cleanPhone.length >= 7)
                .map((c, index) => ({
                    id: `imported_${index}`,
                    name: c.name || c.cleanPhone,
                    phone: c.cleanPhone,
                    rawName: c.name,
                    source: path.basename(filePath),
                }));

            // Deduplicate by phone
            const seen = new Set();
            const uniqueContacts = contacts.filter(c => {
                if (seen.has(c.phone)) return false;
                seen.add(c.phone);
                return true;
            });

            importedContactsMap.set(sessionId, {
                contacts: uniqueContacts,
                importedAt: new Date().toISOString(),
                source: path.basename(filePath),
                total: uniqueContacts.length,
            });

            logger.info(`Imported ${uniqueContacts.length} contacts from ${filePath}`);

            res.json({
                success: true,
                count: uniqueContacts.length,
                contacts: uniqueContacts.slice(0, 50), // Return first 50 for display
            });
        } catch (e) {
            logger.error('Import CSV error:', e.message);
            res.json({ success: false, error: e.message });
        }
    });

    // Import from uploaded file content
    app.post('/api/imported-contacts/import-content', (req, res) => {
        try {
            const { content, fileName, sessionId = 'default' } = req.body;
            if (!content) {
                return res.json({ success: false, error: '文件内容为空' });
            }

            const records = parseCSV(content);

            const contacts = records
                .map(extractContact)
                .filter(c => c.cleanPhone && c.cleanPhone.length >= 7)
                .map((c, index) => ({
                    id: `imported_${index}`,
                    name: c.name || c.cleanPhone,
                    phone: c.cleanPhone,
                    rawName: c.name,
                    source: fileName || 'uploaded.csv',
                }));

            // Deduplicate by phone
            const seen = new Set();
            const uniqueContacts = contacts.filter(c => {
                if (seen.has(c.phone)) return false;
                seen.add(c.phone);
                return true;
            });

            importedContactsMap.set(sessionId, {
                contacts: uniqueContacts,
                importedAt: new Date().toISOString(),
                source: fileName || 'uploaded.csv',
                total: uniqueContacts.length,
            });

            logger.info(`Imported ${uniqueContacts.length} contacts from uploaded file`);

            res.json({
                success: true,
                count: uniqueContacts.length,
                contacts: uniqueContacts.slice(0, 50),
            });
        } catch (e) {
            logger.error('Import content error:', e.message);
            res.json({ success: false, error: e.message });
        }
    });

    // Get imported contacts
    app.get('/api/imported-contacts', (req, res) => {
        const sessionId = req.query.sessionId || 'default';
        const data = importedContactsMap.get(sessionId);
        if (!data) {
            return res.json({ success: true, contacts: [], total: 0 });
        }
        res.json({
            success: true,
            contacts: data.contacts,
            total: data.total,
            source: data.source,
            importedAt: data.importedAt,
        });
    });

    // Clear imported contacts
    app.post('/api/imported-contacts/clear', (req, res) => {
        const sessionId = req.body.sessionId || 'default';
        importedContactsMap.delete(sessionId);
        res.json({ success: true });
    });

    // Check if a phone number has WhatsApp
    app.post('/api/imported-contacts/check-whatsapp', async (req, res) => {
        const { phone } = req.body;
        if (!phone) {
            return res.json({ success: false, error: '请提供电话号码' });
        }

        // Try to get client from global reference
        const clientRef = global._whatsappClientRef;
        if (!clientRef || !clientRef.client) {
            return res.json({ success: false, error: 'WhatsApp 客户端未连接' });
        }

        try {
            // Format phone number
            let cleanPhone = phone.replace(/[^0-9]/g, '');
            if (!cleanPhone.startsWith('86') && cleanPhone.length === 11) {
                cleanPhone = '86' + cleanPhone;
            }

            // Use whatsapp-web.js getNumberId to check if registered
            const numberId = await clientRef.client.getNumberId(cleanPhone);

            const hasWhatsApp = !!numberId;

            res.json({
                success: true,
                hasWhatsApp,
                phone: cleanPhone,
                numberId: numberId ? numberId._serialized : null,
            });
        } catch (e) {
            logger.error('Check WhatsApp error:', e.message);
            res.json({ success: false, error: e.message });
        }
    });
}

function getImportedContacts(sessionId = 'default') {
    const data = importedContactsMap.get(sessionId);
    return data ? data.contacts : [];
}

module.exports = { createImportedContactsRoutes, getImportedContacts };
