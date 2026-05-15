const { getDb } = require('../connection');

function findAll() {
    const db = getDb();
    return db.prepare('SELECT * FROM accounts ORDER BY updated_at DESC').all();
}

function findById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
}

function findByPhone(phone) {
    const db = getDb();
    return db.prepare('SELECT * FROM accounts WHERE phone = ?').get(phone);
}

function create(id, name, level = 'NEW_ACCOUNT', phone = null) {
    const db = getDb();
    const stmt = db.prepare(
        'INSERT OR REPLACE INTO accounts (id, name, phone, level, status, daily_sent, daily_limit, daily_date, total_sent, total_failed) VALUES (?, ?, ?, ?, \'offline\', 0, ?, date(\'now\'), 0, 0)'
    );
    const rl = require('../../config/rate-limits').SAFE_LIMITS;
    const dailyLimit = rl[level] ? rl[level].dailyMax : rl.NEW_ACCOUNT.dailyMax;
    stmt.run(id, name, phone, level, dailyLimit);
    return findById(id);
}

function update(id, data) {
    const db = getDb();
    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
            fields.push(`${key} = ?`);
            values.push(value);
        }
    }
    if (fields.length === 0) return findById(id);
    values.push(id);
    db.prepare(`UPDATE accounts SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...values);
    return findById(id);
}

function remove(id) {
    const db = getDb();
    db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
}

function incrementSentCount(id, success = true) {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];
    const account = findById(id);
    if (!account) return;

    if (account.daily_date !== today) {
        db.prepare('UPDATE accounts SET daily_sent = 1, daily_date = ?, total_sent = total_sent + 1 WHERE id = ?').run(today, id);
    } else {
        if (success) {
            db.prepare('UPDATE accounts SET daily_sent = daily_sent + 1, total_sent = total_sent + 1 WHERE id = ?').run(id);
        }
    }
    if (!success) {
        db.prepare('UPDATE accounts SET total_failed = total_failed + 1 WHERE id = ?').run(id);
    }
}

function updateStatus(id, status) {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare('UPDATE accounts SET status = ?, last_active = ?, updated_at = datetime(\'now\') WHERE id = ?').run(status, now, id);
}

function getDailyStats(id) {
    const db = getDb();
    const account = findById(id);
    if (!account) return null;
    const today = new Date().toISOString().split('T')[0];
    const isToday = account.daily_date === today;
    return {
        accountId: id,
        level: account.level,
        dailySent: isToday ? account.daily_sent : 0,
        dailyLimit: account.daily_limit,
        remaining: Math.max(0, account.daily_limit - (isToday ? account.daily_sent : 0)),
        totalSent: account.total_sent,
        totalFailed: account.total_failed,
    };
}

function setLevel(id, level) {
    const rl = require('../../config/rate-limits').SAFE_LIMITS;
    const dailyLimit = rl[level] ? rl[level].dailyMax : rl.NEW_ACCOUNT.dailyMax;
    return update(id, { level, daily_limit: dailyLimit });
}

function addLoginHistory(accountId, action, detail = null) {
    const db = getDb();
    db.prepare('INSERT INTO login_history (account_id, action, detail) VALUES (?, ?, ?)').run(accountId, action, detail);
}

function getLoginHistory(accountId, limit = 20) {
    const db = getDb();
    return db.prepare('SELECT * FROM login_history WHERE account_id = ? ORDER BY created_at DESC LIMIT ?').all(accountId, limit);
}

function searchAccounts(query) {
    const db = getDb();
    const like = `%${query}%`;
    return db.prepare(
        'SELECT * FROM accounts WHERE name LIKE ? OR phone LIKE ? OR id LIKE ? ORDER BY updated_at DESC'
    ).all(like, like, like);
}

function batchDelete(ids) {
    const db = getDb();
    const placeholders = ids.map(() => '?').join(',');
    const stmt = db.prepare(`DELETE FROM accounts WHERE id IN (${placeholders})`);
    stmt.run(...ids);
    return ids.length;
}

function resetDailyCounts() {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];
    db.prepare('UPDATE accounts SET daily_sent = 0, daily_date = ? WHERE daily_date != ?').run(today, today);
}

module.exports = {
    findAll,
    findById,
    findByPhone,
    create,
    update,
    remove,
    incrementSentCount,
    updateStatus,
    getDailyStats,
    setLevel,
    addLoginHistory,
    getLoginHistory,
    searchAccounts,
    batchDelete,
    resetDailyCounts,
};