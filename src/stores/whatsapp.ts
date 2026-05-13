import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { whatsappApi } from '@/api/tauri'

export const useWhatsAppStore = defineStore('whatsapp', () => {
    const status = ref('disconnected')
    const qr = ref('')
    let pollTimer: ReturnType<typeof setInterval> | null = null

    const isConnected = computed(() => status.value === 'ready')
    const isWaitingForQr = computed(() => status.value === 'qr')

    const connect = async (forceNew = false, clientId?: string) => {
        try {
            const result: any = await whatsappApi.connect(forceNew, clientId)
            if (result.success) {
                startPolling()
            }
            return result
        } catch (e) {
            console.error('Connect error:', e)
            throw e
        }
    }

    const disconnect = async () => {
        try {
            await whatsappApi.disconnect()
            status.value = 'disconnected'
            qr.value = ''
            stopPolling()
        } catch (e) {
            console.error('Disconnect error:', e)
        }
    }

    const checkStatus = async () => {
        try {
            const result: any = await whatsappApi.getStatus()
            status.value = result.status
            qr.value = result.qr || ''
        } catch (e) {
            console.error('Status check error:', e)
        }
    }

    const startPolling = () => {
        if (pollTimer) clearInterval(pollTimer)
        pollTimer = setInterval(checkStatus, 2000)
    }

    const stopPolling = () => {
        if (pollTimer) {
            clearInterval(pollTimer)
            pollTimer = null
        }
    }

    return {
        status,
        qr,
        isConnected,
        isWaitingForQr,
        connect,
        disconnect,
        checkStatus,
        startPolling,
        stopPolling
    }
})
