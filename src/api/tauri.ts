import { invoke } from '@tauri-apps/api'

export const whatsappApi = {
    connect: (forceNew: boolean, clientId?: string, accountName?: string) =>
        invoke('connect', { request: { force_new: forceNew, client_id: clientId, account_name: accountName } }),
    disconnect: () => invoke('disconnect'),
    getStatus: () => invoke('get_status'),
}

export const contactsApi = {
    getChats: () => invoke('get_chats'),
    getContacts: () => invoke('get_contacts'),
    exportContacts: () => invoke('export_contacts'),
}

export const broadcastApi = {
    start: (options: any) => invoke('start_broadcast', { options }),
    stop: () => invoke('stop_broadcast'),
    getStatus: () => invoke('get_broadcast_status'),
}

export const systemApi = {
    getSessions: () => invoke('get_sessions'),
    saveAccount: (clientId: string, name: string) => invoke('save_account', { clientId, name }),
    renameAccount: (id: string, name: string) => invoke('rename_account', { id, name }),
    deleteAccount: (id: string) => invoke('delete_account', { id }),
    setAccountLevel: (level: string) => invoke('set_account_level', { level }),
    getDailyStats: () => invoke('get_daily_stats'),
}
