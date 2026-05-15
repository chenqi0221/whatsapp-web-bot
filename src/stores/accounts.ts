import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
    type Account,
    type AccountStats,
    type LoginHistory,
    getSessions,
    getAccountDetail,
    searchAccounts,
    createAccount,
    renameAccount,
    updateAccount,
    deleteAccount,
    batchDeleteAccounts,
    setAccountLevel,
    getAccountStats,
    getAccountHistory,
} from '@/api/tauri'

export const useAccountsStore = defineStore('accounts', () => {
    const accounts = ref<Account[]>([])
    const loading = ref(false)
    const error = ref<string | null>(null)
    const searchQuery = ref('')

    const filteredAccounts = computed(() => {
        if (!searchQuery.value) return accounts.value
        const q = searchQuery.value.toLowerCase()
        return accounts.value.filter(
            (a) =>
                a.name.toLowerCase().includes(q) ||
                (a.phone && a.phone.includes(q)) ||
                a.id.toLowerCase().includes(q),
        )
    })

    const onlineCount = computed(() => accounts.value.filter((a) => a.status === 'ready').length)

    const levelLabels: Record<string, string> = {
        NEW_ACCOUNT: '新号',
        ESTABLISHED_ACCOUNT: '稳定号',
        MATURE_ACCOUNT: '成熟号',
    }

    const statusLabels: Record<string, string> = {
        offline: '离线',
        qr: '待扫码',
        scanning: '登录中',
        ready: '在线',
        error: '异常',
    }

    async function fetchAccounts() {
        loading.value = true
        error.value = null
        try {
            const result = await getSessions()
            if (result.success && result.accounts) {
                accounts.value = result.accounts
            }
        } catch (e: any) {
            error.value = e?.toString?.() || String(e)
        } finally {
            loading.value = false
        }
    }

    async function fetchSearch(q: string) {
        loading.value = true
        error.value = null
        try {
            const result = await searchAccounts(q)
            if (result.success && result.accounts) {
                accounts.value = result.accounts
            }
        } catch (e: any) {
            error.value = e?.toString?.() || String(e)
        } finally {
            loading.value = false
        }
    }

    async function create(name: string, phone?: string) {
        loading.value = true
        error.value = null
        try {
            const result = await createAccount(name, phone)
            if (result.success && result.accounts) {
                accounts.value = result.accounts
            }
            return result.success
        } catch (e: any) {
            error.value = e?.toString?.() || String(e)
            return false
        } finally {
            loading.value = false
        }
    }

    async function rename(id: string, name: string) {
        error.value = null
        try {
            await renameAccount(id, name)
            const idx = accounts.value.findIndex((a) => a.id === id)
            if (idx !== -1) {
                accounts.value[idx] = { ...accounts.value[idx], name }
            }
            return true
        } catch (e: any) {
            error.value = e?.toString?.() || String(e)
            return false
        }
    }

    async function update(id: string, data: { name?: string; phone?: string; level?: string }) {
        error.value = null
        try {
            const result = await updateAccount(id, data)
            if (result.success && result.account) {
                const idx = accounts.value.findIndex((a) => a.id === id)
                if (idx !== -1) {
                    accounts.value[idx] = result.account
                }
            }
            return result.success
        } catch (e: any) {
            error.value = e?.toString?.() || String(e)
            return false
        }
    }

    async function remove(id: string) {
        loading.value = true
        error.value = null
        try {
            const result = await deleteAccount(id)
            if (result.success && result.accounts) {
                accounts.value = result.accounts
            }
            return result.success
        } catch (e: any) {
            error.value = e?.toString?.() || String(e)
            return false
        } finally {
            loading.value = false
        }
    }

    async function batchRemove(ids: string[]) {
        loading.value = true
        error.value = null
        try {
            const result = await batchDeleteAccounts(ids)
            if (result.success && result.accounts) {
                accounts.value = result.accounts
            }
            return result.success
        } catch (e: any) {
            error.value = e?.toString?.() || String(e)
            return false
        } finally {
            loading.value = false
        }
    }

    async function setLevel(id: string, level: string) {
        error.value = null
        try {
            const result = await setAccountLevel(id, level)
            if (result.success && result.account) {
                const idx = accounts.value.findIndex((a) => a.id === id)
                if (idx !== -1) {
                    accounts.value[idx] = result.account
                }
            }
            return result.success
        } catch (e: any) {
            error.value = e?.toString?.() || String(e)
            return false
        }
    }

    async function fetchStats(id: string): Promise<AccountStats | null> {
        error.value = null
        try {
            const result = await getAccountStats(id)
            if (result.success) return result.stats
        } catch (e: any) {
            error.value = e?.toString?.() || String(e)
        }
        return null
    }

    async function fetchHistory(id: string, limit?: number): Promise<LoginHistory[]> {
        error.value = null
        try {
            const result = await getAccountHistory(id, limit)
            if (result.success) return result.history
        } catch (e: any) {
            error.value = e?.toString?.() || String(e)
        }
        return []
    }

    return {
        accounts,
        loading,
        error,
        searchQuery,
        filteredAccounts,
        onlineCount,
        levelLabels,
        statusLabels,
        fetchAccounts,
        fetchSearch,
        create,
        rename,
        update,
        remove,
        batchRemove,
        setLevel,
        fetchStats,
        fetchHistory,
    }
})