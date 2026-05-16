function checkIsTauriEnv(): boolean {
    if (typeof window === 'undefined') return false
    const w = window as any
    // Tauri v1/v2 都会在 window 上挂载 __TAURI_INTERNALS__
    if (w.__TAURI_INTERNALS__) return true
    // 备选检测方式
    if (w.__TAURI__) return true
    // 检查是否处于 Tauri WebView 环境
    if (w.navigator?.userAgent?.includes('Tauri')) return true
    return false
}

const isTauriEnv = checkIsTauriEnv()
console.log('[tauri.ts] isTauriEnv:', isTauriEnv, 'window.__TAURI_INTERNALS__:', !!(window as any).__TAURI_INTERNALS__)

const API_BASE = 'http://127.0.0.1:3003'

async function tauriInvoke(cmd: string, args?: Record<string, unknown>) {
    console.log(`[tauriInvoke] Calling command: ${cmd}`, args)
    try {
        const { invoke } = await import('@tauri-apps/api/core')
        const result = (await invoke(cmd, args)) as any
        console.log(`[tauriInvoke] Command ${cmd} result:`, result)
        if (typeof result === 'string') {
            try {
                return JSON.parse(result)
            } catch {
                return result
            }
        }
        return result
    } catch (error) {
        console.error(`[tauriInvoke] Command ${cmd} failed:`, error)
        throw error
    }
}

async function apiGet(path: string) {
    if (isTauriEnv) {
        return tauriInvoke('proxy_get', { path })
    }
    const res = await fetch(`${API_BASE}${path}`)
    return res.json()
}

async function apiPost(path: string, body?: Record<string, unknown>) {
    if (isTauriEnv) {
        return tauriInvoke('proxy_post', { path, body })
    }
    const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    })
    return res.json()
}

async function apiPut(path: string, body?: Record<string, unknown>) {
    if (isTauriEnv) {
        return tauriInvoke('proxy_put', { path, body })
    }
    const res = await fetch(`${API_BASE}${path}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    })
    return res.json()
}

async function apiDelete(path: string) {
    if (isTauriEnv) {
        return tauriInvoke('proxy_delete', { path })
    }
    const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE' })
    return res.json()
}

export interface Account {
    id: string
    name: string
    phone: string
    level: string
    status: string
    dailySent: number
    dailyLimit: number
    totalSent: number
    totalFailed: number
    lastActive: string | null
    createdAt: string
    updatedAt: string
}

export interface AccountStats {
    accountId: string
    level: string
    dailySent: number
    dailyLimit: number
    remaining: number
    totalSent: number
    totalFailed: number
}

export interface LoginHistory {
    id: number
    account_id: string
    action: string
    detail: string | null
    created_at: string
}

export interface StatusData {
    status: string
    message: string
    clientId: string | null
    qr: string | null
    lastActive: string | null
    currentAccount: string | null
    accountLevel: string | null
}

export async function getStatus(): Promise<StatusData> {
    if (isTauriEnv) return tauriInvoke('get_status')
    return apiGet('/api/status')
}

export async function getSessions(): Promise<{ success: boolean; accounts: Account[]; total: number }> {
    if (isTauriEnv) return tauriInvoke('get_sessions')
    return apiGet('/api/accounts')
}

export async function getAccountDetail(id: string): Promise<{ success: boolean; account: Account; stats: AccountStats; loginHistory: LoginHistory[] }> {
    if (isTauriEnv) return tauriInvoke('get_account_detail', { id })
    return apiGet(`/api/accounts/${id}`)
}

export async function searchAccounts(query: string): Promise<{ success: boolean; accounts: Account[]; total: number }> {
    if (isTauriEnv) return tauriInvoke('search_accounts', { query })
    return apiGet(`/api/accounts/search?q=${encodeURIComponent(query)}`)
}

export async function createAccount(name: string, phone?: string): Promise<{ success: boolean; account: Account; accounts: Account[] }> {
    if (isTauriEnv) return tauriInvoke('create_account', { name, phone: phone || null })
    return apiPost('/api/accounts', { name, phone: phone || null })
}

export async function renameAccount(id: string, name: string): Promise<{ success: boolean }> {
    if (isTauriEnv) return tauriInvoke('rename_account', { id, name })
    return apiPost('/api/account/rename', { id, name })
}

export async function updateAccount(id: string, data: { name?: string; phone?: string; level?: string }): Promise<{ success: boolean; account: Account }> {
    if (isTauriEnv) {
        return tauriInvoke('update_account', {
            id,
            name: data.name || null,
            phone: data.phone || null,
            level: data.level || null,
        })
    }
    return apiPut(`/api/accounts/${id}`, data)
}

export async function deleteAccount(id: string): Promise<{ success: boolean; accounts: Account[] }> {
    if (isTauriEnv) return tauriInvoke('delete_account', { id })
    return apiDelete(`/api/accounts/${id}`)
}

export async function batchDeleteAccounts(ids: string[]): Promise<{ success: boolean; deleted: number; accounts: Account[] }> {
    if (isTauriEnv) return tauriInvoke('batch_delete_accounts', { ids })
    return apiPost('/api/accounts/batch-delete', { ids: ids as any })
}

export async function setAccountLevel(id: string, level: string): Promise<{ success: boolean; account: Account }> {
    if (isTauriEnv) return tauriInvoke('set_account_level', { id, level })
    return apiPut(`/api/accounts/${id}/level`, { level })
}

export async function getAccountStats(id: string): Promise<{ success: boolean; stats: AccountStats }> {
    if (isTauriEnv) return tauriInvoke('get_account_stats', { id })
    return apiGet(`/api/accounts/${id}/stats`)
}

export async function getAccountHistory(id: string, limit?: number): Promise<{ success: boolean; history: LoginHistory[] }> {
    if (isTauriEnv) return tauriInvoke('get_account_history', { id, limit: limit || 20 })
    return apiGet(`/api/accounts/${id}/history?limit=${limit || 20}`)
}

export async function connect(clientId: string): Promise<void> {
    if (isTauriEnv) {
        await tauriInvoke('connect', { clientId })
        return
    }
    await apiPost('/api/connect', { clientId, forceNew: false })
}

export async function disconnect(): Promise<void> {
    if (isTauriEnv) {
        await tauriInvoke('disconnect')
        return
    }
    await apiPost('/api/logout')
}

export async function logout(): Promise<void> {
    // logout 使用 disconnect 命令（它们都调用 /api/logout）
    if (isTauriEnv) {
        await tauriInvoke('disconnect')
        return
    }
    await apiPost('/api/logout')
}

/**
 * @deprecated 请使用 broadcastApi.start(options) 替代，它传递完整参数包括 targetType
 */
export async function sendMessage(clientId: string, numbers: string[], message: string): Promise<void> {
    if (isTauriEnv) {
        await tauriInvoke('send_message', { clientId, numbers, message })
        return
    }
    await apiPost('/api/broadcast', { clientId, manualNumbers: numbers.join(','), message })
}

export async function getContacts(clientId?: string): Promise<any> {
    if (isTauriEnv) return tauriInvoke('get_contacts')
    return apiGet('/api/contacts-list')
}

export async function getChats(): Promise<any> {
    if (isTauriEnv) return tauriInvoke('get_chats')
    return apiGet('/api/chats')
}

export async function exportContacts(): Promise<void> {
    if (isTauriEnv) {
        await tauriInvoke('export_contacts')
        return
    }
    const res = await fetch(`${API_BASE}/api/export-contacts`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'contacts.csv'
    a.click()
    URL.revokeObjectURL(url)
}

/**
 * @deprecated 请使用 broadcastApi.start(options) 替代，它传递完整参数包括 targetType
 */
export async function startBroadcast(clientId: string, numbers: string[], message: string): Promise<any> {
    if (isTauriEnv) return tauriInvoke('start_broadcast', { clientId, numbers, message })
    return apiPost('/api/broadcast', { manualNumbers: numbers.join(','), message })
}

export async function stopBroadcast(): Promise<void> {
    if (isTauriEnv) {
        await tauriInvoke('stop_broadcast')
        return
    }
    await apiPost('/api/broadcast/stop')
}

export async function getBroadcastStatus(): Promise<any> {
    if (isTauriEnv) return tauriInvoke('get_broadcast_status')
    return apiGet('/api/broadcast-status')
}

export const whatsappApi = {
    async connect(opts: { forceNew?: boolean; clientId?: string; accountName?: string } = {}) {
        if (isTauriEnv) {
            return tauriInvoke('connect', {
                request: {
                    force_new: opts.forceNew || false,
                    client_id: opts.clientId || null,
                    account_name: opts.accountName || null,
                }
            })
        }
        return apiPost('/api/connect', {
            forceNew: opts.forceNew || false,
            clientId: opts.clientId || undefined,
            accountName: opts.accountName || undefined,
        })
    },
    async disconnect() {
        if (isTauriEnv) return tauriInvoke('disconnect')
        return apiPost('/api/logout')
    },
    async getStatus() {
        if (isTauriEnv) return tauriInvoke('get_status')
        return apiGet('/api/status')
    },
}

export const systemApi = {
    async getSessions() {
        if (isTauriEnv) return tauriInvoke('get_sessions')
        return apiGet('/api/accounts')
    },
    async getDailyStats() {
        if (isTauriEnv) return tauriInvoke('get_daily_stats')
        return apiGet('/api/daily-stats')
    },
    async setAccountLevel(level: string) {
        if (isTauriEnv) return tauriInvoke('global_set_account_level', { level })
        return apiPost('/api/set-account-level', { level })
    },
}

export const contactsApi = {
    async getContacts(clientId?: string) {
        if (isTauriEnv) return tauriInvoke('get_contacts')
        return apiGet('/api/contacts-list')
    },
    async getChats() {
        if (isTauriEnv) return tauriInvoke('get_chats')
        return apiGet('/api/chats')
    },
    async getUnchatted() {
        if (isTauriEnv) return tauriInvoke('get_unchatted_contacts')
        return apiGet('/api/contacts/unchatted')
    },
    async exportContacts() {
        if (isTauriEnv) return tauriInvoke('export_contacts')
        await exportContacts()
    },
}

export const broadcastApi = {
    async start(options: any) {
        if (isTauriEnv) return tauriInvoke('start_broadcast', options)
        return apiPost('/api/broadcast', options)
    },
    async stop() {
        if (isTauriEnv) return tauriInvoke('stop_broadcast')
        return apiPost('/api/broadcast/stop')
    },
    async getStatus() {
        if (isTauriEnv) return tauriInvoke('get_broadcast_status')
        return apiGet('/api/broadcast-status')
    },
}

export const profileApi = {
    async getProfile() {
        if (isTauriEnv) return tauriInvoke('get_profile')
        return apiGet('/api/profile')
    },
}

export const autoreplyApi = {
    async getRules() {
        if (isTauriEnv) return tauriInvoke('get_autoreply_rules')
        return apiGet('/api/auto-reply')
    },
    async addRule(data: { keyword: string; reply: string; matchType?: string }) {
        if (isTauriEnv) {
            return tauriInvoke('add_autoreply_rule', {
                keyword: data.keyword,
                reply: data.reply,
                match_type: data.matchType || null,
            })
        }
        return apiPost('/api/auto-reply', data)
    },
    async toggle(enabled: boolean) {
        if (isTauriEnv) return tauriInvoke('toggle_autoreply', { enabled })
        return apiPost('/api/auto-reply/toggle', { enabled })
    },
}

export const scheduleApi = {
    async getTasks() {
        if (isTauriEnv) return tauriInvoke('get_scheduled_tasks')
        return apiGet('/api/scheduled-tasks')
    },
    async createTask(data: { name: string; type: string; dailyTime?: string; time?: string; message: string; target: string }) {
        if (isTauriEnv) {
            return tauriInvoke('create_scheduled_task', {
                name: data.name,
                task_type: data.type,
                daily_time: data.dailyTime || null,
                time: data.time || null,
                message: data.message,
                target: data.target,
            })
        }
        return apiPost('/api/scheduled-tasks', data)
    },
}

export const chatApi = {
    async send(to: string, message: string) {
        if (isTauriEnv) return tauriInvoke('send_message_direct', { to, message })
        return apiPost('/api/send', { to, message })
    },
}

export interface ImportedContact {
    id: string
    name: string
    phone: string
    rawName: string
    source: string
}

export const importedContactsApi = {
    async scanCsv() {
        return apiGet('/api/imported-contacts/scan-csv')
    },
    async previewCsv(filePath: string) {
        return apiPost('/api/imported-contacts/preview-csv', { filePath })
    },
    async importCsv(filePath: string, sessionId?: string) {
        return apiPost('/api/imported-contacts/import', { filePath, sessionId })
    },
    async importContent(content: string, fileName?: string, sessionId?: string) {
        return apiPost('/api/imported-contacts/import-content', { content, fileName, sessionId })
    },
    async getImported(sessionId?: string) {
        return apiGet(`/api/imported-contacts?sessionId=${sessionId || 'default'}`)
    },
    async clearImported(sessionId?: string) {
        return apiPost('/api/imported-contacts/clear', { sessionId })
    },
    async checkWhatsApp(phone: string) {
        return apiPost('/api/imported-contacts/check-whatsapp', { phone })
    },
}

export const backendApi = {
    async checkHealth(): Promise<'alive' | 'dead'> {
        // Tauri 模式下使用 Rust 命令检测（避免 WebView fetch 限制）
        if (isTauriEnv) {
            try {
                const result = await tauriInvoke('check_backend_health')
                return result === 'alive' ? 'alive' : 'dead'
            } catch (e) {
                console.warn('[backendApi] Tauri health check failed:', e)
                return 'dead'
            }
        }
        // 浏览器开发模式用 fetch
        try {
            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 2000)
            const res = await fetch(`${API_BASE}/api/status`, {
                signal: controller.signal,
            })
            clearTimeout(timeout)
            if (res.ok) {
                await res.json()
                return 'alive'
            }
            return 'dead'
        } catch (e) {
            console.warn('[backendApi] health check failed:', e)
            return 'dead'
        }
    },
    async restart(): Promise<string> {
        if (isTauriEnv) {
            try {
                return await tauriInvoke('restart_backend') as string
            } catch (e) {
                console.warn('Tauri restart failed:', e)
            }
        }
        return 'restarting'
    },
}