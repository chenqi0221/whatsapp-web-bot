-- WhatsApp Bot Database Schema
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    level TEXT DEFAULT 'NEW_ACCOUNT',
    status TEXT DEFAULT 'offline',
    daily_sent INTEGER DEFAULT 0,
    daily_date TEXT,
    daily_limit INTEGER DEFAULT 30,
    total_sent INTEGER DEFAULT 0,
    total_failed INTEGER DEFAULT 0,
    last_active TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS login_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT NOT NULL,
    action TEXT NOT NULL,
    detail TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS contacts_cache (
    id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    name TEXT,
    number TEXT,
    is_group INTEGER DEFAULT 0,
    data TEXT,
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (id, account_id),
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS broadcast_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT NOT NULL,
    target_count INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    message_preview TEXT,
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_contacts_account ON contacts_cache(account_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_account ON broadcast_records(account_id);
CREATE INDEX IF NOT EXISTS idx_login_history_account ON login_history(account_id);