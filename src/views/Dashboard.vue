<template>
    <div class="dashboard">
        <div class="page-header">
            <h2 class="page-title">仪表盘</h2>
            <el-button type="primary" @click="refreshAll" :loading="refreshing">
                <el-icon><Refresh /></el-icon>
                刷新
            </el-button>
        </div>

        <div class="dashboard-grid">
            <div class="profile-card">
                <div class="profile-header">
                    <div class="avatar-wrapper">
                        <el-avatar :size="72" :src="profile.avatarUrl || undefined">
                            {{ avatarFallback }}
                        </el-avatar>
                        <span class="status-dot" :class="statusClass"></span>
                    </div>
                    <div class="profile-info">
                        <h3 class="profile-name">{{ profile.name || '未连接' }}</h3>
                        <p class="profile-phone" v-if="profile.number">
                            <el-icon><Phone /></el-icon>
                            +{{ profile.number }}
                        </p>
                        <div class="profile-meta">
                            <el-tag :type="statusTagType" size="small" effect="dark">
                                {{ statusLabel }}
                            </el-tag>
                            <span class="connected-time" v-if="profile.connectedAt && profile.status === 'ready'">
                                已在线 {{ connectedDuration }}
                            </span>
                        </div>
                        <p class="profile-level" v-if="profile.accountLevel">
                            账号等级: <strong>{{ profile.accountLevel }}</strong>
                        </p>
                    </div>
                </div>

                <div class="profile-account-row">
                    <el-select
                        v-model="selectedAccountId"
                        placeholder="选择账号"
                        size="small"
                        class="account-select"
                        @change="handleAccountSelect"
                        :disabled="profile.status === 'ready'"
                    >
                        <el-option
                            v-for="acc in accountsStore.accounts"
                            :key="acc.id"
                            :label="acc.name"
                            :value="acc.id"
                        >
                            <span>{{ acc.name }}</span>
                            <span class="account-last-used" v-if="acc.lastUsed">
                                {{ formatAccountLastUsed(acc) }}
                            </span>
                        </el-option>
                        <el-option
                            :value="NEW_ACCOUNT_MARKER"
                            label="+ 新建账号"
                            class="new-account-option"
                        />
                    </el-select>

                    <el-button
                        v-if="profile.status !== 'ready'"
                        type="primary"
                        size="small"
                        @click="handleConnect"
                        :loading="connecting"
                        :disabled="!selectedAccountId"
                    >
                        连接
                    </el-button>
                    <el-button
                        v-else
                        type="danger"
                        size="small"
                        @click="handleDisconnect"
                        :loading="disconnecting"
                    >
                        断开
                    </el-button>
                </div>

                <p v-if="profile.status === 'ready'" class="account-switch-hint">
                    先断开连接才能切换账号
                </p>
            </div>

            <div class="stats-section">
                <div class="stat-card">
                    <div class="stat-icon chats-icon"><el-icon><ChatDotRound /></el-icon></div>
                    <div class="stat-content">
                        <span class="stat-value">{{ stats.chatCount }}</span>
                        <span class="stat-label">聊天总数</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon contacts-icon"><el-icon><UserFilled /></el-icon></div>
                    <div class="stat-content">
                        <span class="stat-value">{{ stats.contactCount }}</span>
                        <span class="stat-label">联系人数</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon groups-icon"><el-icon><Grid /></el-icon></div>
                    <div class="stat-content">
                        <span class="stat-value">{{ stats.groupCount }}</span>
                        <span class="stat-label">群组数</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon sends-icon"><el-icon><Message /></el-icon></div>
                    <div class="stat-content">
                        <span class="stat-value">
                            {{ stats.dailyStats.sent }}<small>/{{ stats.dailyStats.dailyMax }}</small>
                        </span>
                        <span class="stat-label">今日发送</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="feature-cards">
            <div class="feature-card">
                <div class="feature-card-header">
                    <div class="feature-icon broadcast-feature"><el-icon><Promotion /></el-icon></div>
                    <div class="feature-title-group">
                        <h4>群发消息</h4>
                        <el-tag v-if="broadcastProgress?.running" type="warning" size="small" effect="dark">运行中</el-tag>
                        <el-tag v-else size="small" type="info">待命</el-tag>
                    </div>
                </div>

                <el-select
                    v-model="selectedBroadcastTemplate"
                    placeholder="选择群发模板"
                    clearable
                    size="small"
                    class="template-select-full"
                    @change="onBroadcastTemplateChange"
                    :disabled="broadcastProgress?.running"
                >
                    <el-option
                        v-for="tpl in broadcastTemplates"
                        :key="tpl.id"
                        :label="tpl.name"
                        :value="tpl.id"
                    />
                </el-select>

                <div v-if="broadcastProgress?.running" class="card-progress">
                    <el-progress
                        :percentage="broadcastPercentage"
                        :stroke-width="12"
                        :status="broadcastProgressStatus"
                    />
                    <p class="card-progress-text">{{ broadcastProgress.current }}/{{ broadcastProgress.total }}</p>
                </div>

                <div class="feature-card-actions">
                    <el-button
                        v-if="broadcastProgress?.running"
                        type="danger"
                        size="small"
                        @click="handleStopBroadcast"
                        :loading="stoppingBroadcast"
                    >
                        停止群发
                    </el-button>
                    <el-button
                        v-else
                        type="primary"
                        size="small"
                        @click="handleQuickBroadcast"
                        :disabled="!activeTemplate || profile.status !== 'ready'"
                        :loading="startingBroadcast"
                    >
                        开始群发
                    </el-button>
                    <el-button size="small" @click="$router.push('/broadcast')">
                        完整功能
                    </el-button>
                </div>
            </div>

            <div class="feature-card">
                <div class="feature-card-header">
                    <div class="feature-icon autoreply-feature"><el-icon><Cpu /></el-icon></div>
                    <div class="feature-title-group">
                        <h4>自动回复</h4>
                        <el-switch
                            v-model="autoreplyEnabled"
                            size="small"
                            @change="handleToggleAutoreply"
                            :disabled="profile.status !== 'ready'"
                        />
                    </div>
                </div>

                <div class="feature-card-body">
                    <div class="card-stat-row">
                        <span class="card-stat-label">已配置规则</span>
                        <span class="card-stat-value">{{ autoreplyRules.length }} 条</span>
                    </div>

                    <div class="quick-add-form">
                        <el-input
                            v-model="newAutoreplyKeyword"
                            placeholder="关键词"
                            size="small"
                            :disabled="!autoreplyEnabled"
                        />
                        <el-input
                            v-model="newAutoreplyReply"
                            placeholder="回复内容"
                            size="small"
                            :disabled="!autoreplyEnabled"
                        />
                        <el-button
                            type="primary"
                            size="small"
                            @click="handleAddAutoreply"
                            :disabled="!newAutoreplyKeyword || !newAutoreplyReply || !autoreplyEnabled"
                            :loading="addingAutoreply"
                        >
                            添加
                        </el-button>
                    </div>
                </div>

                <div class="feature-card-actions">
                    <el-button size="small" @click="$router.push('/autoreply')">管理规则</el-button>
                </div>
            </div>

            <div class="feature-card">
                <div class="feature-card-header">
                    <div class="feature-icon schedule-feature"><el-icon><Clock /></el-icon></div>
                    <div class="feature-title-group">
                        <h4>定时任务</h4>
                    </div>
                </div>

                <div class="feature-card-body">
                    <div class="card-stat-row">
                        <span class="card-stat-label">待执行任务</span>
                        <span class="card-stat-value">{{ scheduledTasks.length }} 个</span>
                    </div>

                    <div v-if="nextScheduleTask" class="card-stat-row next-task">
                        <el-icon><Timer /></el-icon>
                        <span>下一次: {{ formatNextRun(nextScheduleTask.nextRun) }}</span>
                    </div>
                    <div v-else-if="scheduledTasks.length === 0" class="card-stat-row next-task empty-hint">
                        暂无定时任务
                    </div>

                    <div class="quick-add-form">
                        <el-input
                            v-model="newScheduleTime"
                            placeholder="时间 如 09:00"
                            size="small"
                        />
                        <el-input
                            v-model="newScheduleMsg"
                            placeholder="消息内容"
                            size="small"
                        />
                        <el-button
                            type="primary"
                            size="small"
                            @click="handleCreateSchedule"
                            :disabled="!newScheduleTime || !newScheduleMsg"
                            :loading="creatingSchedule"
                        >
                            创建
                        </el-button>
                    </div>
                </div>

                <div class="feature-card-actions">
                    <el-button size="small" @click="$router.push('/schedule')">管理任务</el-button>
                </div>
            </div>

            <div class="feature-card">
                <div class="feature-card-header">
                    <div class="feature-icon quick-feature"><el-icon><Connection /></el-icon></div>
                    <div class="feature-title-group">
                        <h4>快捷操作</h4>
                    </div>
                </div>

                <div class="feature-card-body">
                    <div class="quick-add-form">
                        <el-input
                            v-model="quickSendPhone"
                            placeholder="手机号"
                            size="small"
                        />
                        <el-input
                            v-model="quickSendMsg"
                            placeholder="消息内容"
                            size="small"
                        />
                        <el-button
                            type="primary"
                            size="small"
                            @click="handleQuickSend"
                            :disabled="!quickSendPhone || !quickSendMsg || profile.status !== 'ready'"
                            :loading="quickSending"
                        >
                            发送
                        </el-button>
                    </div>

                    <div class="quick-add-form">
                        <el-input
                            v-model="joinGroupLink"
                            placeholder="群邀请链接"
                            size="small"
                        />
                        <el-button
                            type="success"
                            size="small"
                            @click="handleJoinGroup"
                            :disabled="!joinGroupLink || profile.status !== 'ready'"
                            :loading="joiningGroup"
                        >
                            加入群组
                        </el-button>
                    </div>
                </div>

                <div class="feature-card-actions">
                    <el-button size="small" @click="handleExportContacts" :loading="exportingContacts">
                        <el-icon><Download /></el-icon>导出通讯录
                    </el-button>
                    <el-button size="small" @click="$router.push('/contacts')">联系人</el-button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import {
    Refresh, Phone, ChatDotRound, UserFilled, Grid, Message,
    Promotion, Cpu, Clock, Timer, Connection, Download,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
    profileApi, contactsApi, broadcastApi,
    autoreplyApi, scheduleApi, chatApi,
    whatsappApi,
} from '@/api/tauri'
import { exportContacts } from '@/api/tauri'
import { useAccountsStore } from '@/stores/accounts'

defineOptions({ name: 'Dashboard' })

const accountsStore = useAccountsStore()

const NEW_ACCOUNT_MARKER = '__new__'

const TEMPLATES_KEY = 'broadcast_templates'

const profile = reactive<any>({
    status: 'disconnected',
    connectedAt: null,
    name: null,
    number: null,
    avatarUrl: null,
    accountLevel: null,
    dailyStats: { sent: 0, failed: 0, dailyMax: 30 },
})

const stats = reactive({
    chatCount: 0,
    contactCount: 0,
    groupCount: 0,
    dailyStats: { sent: 0, failed: 0, dailyMax: 30 },
})

const broadcastProgress = ref<any>(null)
const broadcastTemplates = ref<any[]>([])
const selectedBroadcastTemplate = ref('')
const activeTemplate = ref<any>(null)
const autoreplyEnabled = ref(false)
const autoreplyRules = ref<any[]>([])
const scheduledTasks = ref<any[]>([])

const newAutoreplyKeyword = ref('')
const newAutoreplyReply = ref('')
const newScheduleTime = ref('')
const newScheduleMsg = ref('')
const quickSendPhone = ref('')
const quickSendMsg = ref('')
const joinGroupLink = ref('')

const selectedAccountId = ref('')
const connecting = ref(false)
const disconnecting = ref(false)

const refreshing = ref(false)
const stoppingBroadcast = ref(false)
const startingBroadcast = ref(false)
const addingAutoreply = ref(false)
const creatingSchedule = ref(false)
const quickSending = ref(false)
const joiningGroup = ref(false)
const exportingContacts = ref(false)

let pollTimer: ReturnType<typeof setInterval> | null = null

const statusClass = computed(() => {
    if (profile.status === 'ready') return 'online'
    if (profile.status === 'qr') return 'qr'
    return 'offline'
})

const statusTagType = computed(() => {
    if (profile.status === 'ready') return 'success'
    if (profile.status === 'qr') return 'warning'
    if (profile.status === 'authenticated') return 'primary'
    return 'info'
})

const statusLabel = computed(() => {
    switch (profile.status) {
        case 'ready': return '已连接'
        case 'qr': return '等待扫码'
        case 'authenticated': return '认证中'
        case 'auth_failure': return '认证失败'
        default: return '未连接'
    }
})

const avatarFallback = computed(() => {
    if (profile.name) return profile.name.charAt(0).toUpperCase()
    if (profile.number) return '+' + profile.number.slice(-3)
    return 'WA'
})

const connectedDuration = computed(() => {
    if (!profile.connectedAt) return ''
    const diff = Date.now() - profile.connectedAt
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(mins / 60)
    if (hours > 0) return `${hours} 小时 ${mins % 60} 分钟`
    if (mins > 0) return `${mins} 分钟`
    return '刚刚'
})

const broadcastPercentage = computed(() => {
    if (!broadcastProgress.value?.total) return 0
    return Math.round((broadcastProgress.value.current / broadcastProgress.value.total) * 100)
})

const broadcastProgressStatus = computed(() => {
    if (!broadcastProgress.value?.running && broadcastProgress.value?.current >= broadcastProgress.value?.total) {
        return 'success'
    }
    return undefined
})

const nextScheduleTask = computed(() => {
    return scheduledTasks.value
        .filter((t: any) => t.enabled && t.nextRun)
        .sort((a: any, b: any) => new Date(a.nextRun).getTime() - new Date(b.nextRun).getTime())[0] || null
})

function formatNextRun(dateStr: string) {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    const now = new Date()
    const diff = d.getTime() - now.getTime()
    if (diff < 0) return '已过期'
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins} 分钟后`
    const hours = Math.floor(mins / 60)
    const remainingMins = mins % 60
    if (hours < 24) return `${hours} 小时 ${remainingMins} 分钟后`
    return d.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function loadBroadcastTemplates() {
    try {
        const raw = localStorage.getItem(TEMPLATES_KEY)
        broadcastTemplates.value = raw ? JSON.parse(raw) : []
    } catch {
        broadcastTemplates.value = []
    }
}

function onBroadcastTemplateChange(templateId: string) {
    if (!templateId) {
        activeTemplate.value = null
        return
    }
    activeTemplate.value = broadcastTemplates.value.find((t) => t.id === templateId) || null
}

async function handleQuickBroadcast() {
    if (!activeTemplate.value) {
        ElMessage.warning('请先选择群发模板')
        return
    }
    startingBroadcast.value = true
    try {
        const tpl = activeTemplate.value
        const fd = tpl.formData || {}
        const res: any = await broadcastApi.start({
            message: fd.messages,
            interval: fd.interval || 10000,
            randomInterval: fd.randomInterval !== false,
            randomizeMsg: fd.randomizeMsg !== false,
            lengthRandomize: fd.lengthRandomize !== false,
            simulateTyping: fd.simulateTyping !== false,
            simulateMouse: fd.simulateMouse || false,
            respectHours: fd.respectHours !== false,
            randomPause: fd.randomPause !== false,
            excludeGroups: fd.excludeGroups !== false,
            personalize: fd.personalize !== false,
            targetType: fd.targetType || 'chats',
            manualNumbers: fd.manualNumbers || '',
            accountLevel: fd.accountLevel || 'new',
        })
        if (res && res.success) {
            ElMessage.success('群发已启动')
        } else {
            ElMessage.error((res && res.error) || '启动失败')
        }
    } catch (e: any) {
        ElMessage.error('启动失败: ' + e.message)
    } finally {
        startingBroadcast.value = false
    }
}

async function handleStopBroadcast() {
    stoppingBroadcast.value = true
    try {
        await broadcastApi.stop()
        broadcastProgress.value = { ...broadcastProgress.value, running: false }
        ElMessage.success('群发已停止')
    } catch (e: any) {
        ElMessage.error('停止失败: ' + e.message)
    } finally {
        stoppingBroadcast.value = false
    }
}

async function handleToggleAutoreply(val: boolean) {
    try {
        await autoreplyApi.toggle(val)
        ElMessage.success(val ? '自动回复已开启' : '自动回复已关闭')
    } catch (e: any) {
        autoreplyEnabled.value = !val
        ElMessage.error('操作失败: ' + e.message)
    }
}

async function handleAddAutoreply() {
    addingAutoreply.value = true
    try {
        const res: any = await autoreplyApi.addRule({
            keyword: newAutoreplyKeyword.value,
            reply: newAutoreplyReply.value,
            matchType: 'keyword',
        })
        if (res && res.success) {
            ElMessage.success('规则已添加')
            newAutoreplyKeyword.value = ''
            newAutoreplyReply.value = ''
            loadAutoreplyStatus()
        } else {
            ElMessage.error((res && res.error) || '添加失败')
        }
    } catch (e: any) {
        ElMessage.error('添加失败: ' + e.message)
    } finally {
        addingAutoreply.value = false
    }
}

async function handleCreateSchedule() {
    creatingSchedule.value = true
    try {
        const res: any = await scheduleApi.createTask({
            name: '定时消息',
            type: 'daily',
            dailyTime: newScheduleTime.value,
            message: newScheduleMsg.value,
            target: 'all',
        })
        if (res && res.success) {
            ElMessage.success('定时任务已创建')
            newScheduleTime.value = ''
            newScheduleMsg.value = ''
            loadScheduleTasks()
        } else {
            ElMessage.error((res && res.error) || '创建失败')
        }
    } catch (e: any) {
        ElMessage.error('创建失败: ' + e.message)
    } finally {
        creatingSchedule.value = false
    }
}

async function handleQuickSend() {
    quickSending.value = true
    try {
        const res: any = await chatApi.send(quickSendPhone.value + '@c.us', quickSendMsg.value)
        if (res && res.success) {
            ElMessage.success('消息已发送')
            quickSendMsg.value = ''
        } else {
            ElMessage.error((res && res.error) || '发送失败')
        }
    } catch (e: any) {
        ElMessage.error('发送失败: ' + e.message)
    } finally {
        quickSending.value = false
    }
}

async function handleJoinGroup() {
    joiningGroup.value = true
    try {
        const res = await fetch('http://127.0.0.1:3003/api/join-group', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inviteCode: joinGroupLink.value }),
        })
        const data = await res.json()
        if (data.success) {
            ElMessage.success('已加入群组')
            joinGroupLink.value = ''
        } else {
            ElMessage.error(data.error || '加入失败')
        }
    } catch (e: any) {
        ElMessage.error('加入失败: ' + e.message)
    } finally {
        joiningGroup.value = false
    }
}

async function handleExportContacts() {
    exportingContacts.value = true
    try {
        await exportContacts()
        ElMessage.success('通讯录已导出')
    } catch (e: any) {
        ElMessage.error('导出失败: ' + e.message)
    } finally {
        exportingContacts.value = false
    }
}

async function loadAccounts() {
    try {
        await accountsStore.fetchAccounts()
    } catch (e) {
        console.error('Failed to load accounts:', e)
    }
}

function handleAccountSelect(val: string) {
    if (val === NEW_ACCOUNT_MARKER) {
        selectedAccountId.value = ''
        handleCreateAccount()
    }
}

async function handleCreateAccount() {
    try {
        const { value: name } = await ElMessageBox.prompt('请输入新账号名称', '新建账号', {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            inputPattern: /\S+/,
            inputErrorMessage: '名称不能为空',
        })
        if (!name) return
        connecting.value = true
        const res: any = await whatsappApi.connect({ forceNew: true, accountName: name.trim() })
        if (res && res.success) {
            ElMessage.success('新账号已创建，请扫码登录')
            selectedAccountId.value = res.clientId || ''
            loadAccounts()
        } else {
            ElMessage.error((res && res.error) || '创建失败')
        }
    } catch (e: any) {
        if (e !== 'cancel') {
            ElMessage.error('创建失败: ' + (e.message || ''))
        }
    } finally {
        connecting.value = false
    }
}

async function handleConnect() {
    if (!selectedAccountId.value) {
        ElMessage.warning('请先选择一个账号')
        return
    }
    connecting.value = true
    try {
        const res: any = await whatsappApi.connect({
            clientId: selectedAccountId.value,
            forceNew: false,
        })
        if (res && res.success) {
            ElMessage.success('正在连接，请扫码')
        } else {
            ElMessage.error((res && res.error) || '连接失败')
        }
    } catch (e: any) {
        ElMessage.error('连接失败: ' + (e.message || ''))
    } finally {
        connecting.value = false
    }
}

async function handleDisconnect() {
    if (profile.status !== 'ready') {
        ElMessage.warning('当前未连接')
        return
    }
    disconnecting.value = true
    try {
        await whatsappApi.disconnect()
        profile.status = 'disconnected'
        profile.connectedAt = null
        selectedAccountId.value = ''
        ElMessage.success('已断开连接')
    } catch (e: any) {
        ElMessage.error('断开失败: ' + (e.message || ''))
    } finally {
        disconnecting.value = false
    }
}

function formatAccountLastUsed(account: any) {
    if (!account.lastUsed) return ''
    const d = new Date(account.lastUsed)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
    if (diffDays === 0) return '今天'
    if (diffDays === 1) return '昨天'
    if (diffDays < 7) return `${diffDays} 天前`
    return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

async function loadProfile() {
    try {
        const data: any = await profileApi.getProfile()
        Object.assign(profile, data)
        if (data.dailyStats) {
            stats.dailyStats = data.dailyStats
        }
    } catch (e) {
        console.error('Failed to load profile:', e)
    }
}

async function loadStats() {
    try {
        const [chatsRes, contactsRes]: any[] = await Promise.all([
            contactsApi.getChats(),
            contactsApi.getContacts(),
        ])
        if (chatsRes?.chats) {
            stats.chatCount = chatsRes.chats.length
            stats.groupCount = chatsRes.chats.filter((c: any) => c.isGroup).length
        }
        if (contactsRes) {
            stats.contactCount = contactsRes.total || contactsRes.contacts?.length || 0
        }
    } catch (e) {
        console.error('Failed to load stats:', e)
    }
}

async function loadBroadcastStatus() {
    try {
        const data: any = await broadcastApi.getStatus()
        broadcastProgress.value = data
    } catch (e) {
        console.error('Failed to load broadcast status:', e)
    }
}

async function loadAutoreplyStatus() {
    try {
        const data: any = await autoreplyApi.getRules()
        autoreplyEnabled.value = data.enabled
        autoreplyRules.value = data.rules || []
    } catch (e) {
        console.error('Failed to load autoreply status:', e)
    }
}

async function loadScheduleTasks() {
    try {
        const data: any = await scheduleApi.getTasks()
        scheduledTasks.value = data.tasks || []
    } catch (e) {
        console.error('Failed to load schedule tasks:', e)
    }
}

async function refreshAll() {
    refreshing.value = true
    try {
        loadBroadcastTemplates()
        await Promise.all([
            loadProfile(),
            loadStats(),
            loadBroadcastStatus(),
            loadAutoreplyStatus(),
            loadScheduleTasks(),
            loadAccounts(),
        ])
    } finally {
        refreshing.value = false
    }
}

function startPolling() {
    stopPolling()
    pollTimer = setInterval(async () => {
        if (profile.status === 'ready') {
            loadBroadcastStatus()
        }
        loadProfile()
        loadAutoreplyStatus()
        loadScheduleTasks()
    }, 5000)
}

function stopPolling() {
    if (pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
    }
}

onMounted(async () => {
    await refreshAll()
    startPolling()
})

onUnmounted(() => {
    stopPolling()
})
</script>

<style scoped>
.dashboard {
    padding: 24px 28px;
    max-width: 1200px;
    margin: 0 auto;
}

.page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
}

.page-title {
    font-size: 22px;
    font-weight: 700;
    color: #1a1a2e;
    margin: 0;
}

.dashboard-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-bottom: 24px;
}

@media (max-width: 800px) {
    .dashboard-grid {
        grid-template-columns: 1fr;
    }
}

.profile-card {
    background: #fff;
    border-radius: 16px;
    padding: 24px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.profile-header {
    display: flex;
    align-items: center;
    gap: 20px;
}

.avatar-wrapper {
    position: relative;
    flex-shrink: 0;
}

.status-dot {
    position: absolute;
    bottom: 4px;
    right: 4px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 3px solid #fff;
}

.status-dot.online { background: #67c23a; }
.status-dot.qr { background: #e6a23c; animation: pulse 1.5s infinite; }
.status-dot.offline { background: #909399; }

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
}

.profile-info { min-width: 0; }

.profile-name {
    font-size: 20px;
    font-weight: 700;
    color: #1a1a2e;
    margin: 0 0 6px 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.profile-phone {
    font-size: 14px;
    color: #606266;
    margin: 0 0 10px 0;
    display: flex;
    align-items: center;
    gap: 4px;
}

.profile-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 6px;
}

.connected-time { font-size: 13px; color: #909399; }

.profile-level { font-size: 13px; color: #606266; margin: 0; }
.profile-level strong { color: #409eff; }

.profile-account-row {
    display: flex;
    gap: 10px;
    align-items: center;
    margin-top: 18px;
    padding-top: 16px;
    border-top: 1px solid #f0f0f0;
}

.account-select {
    flex: 1;
    min-width: 0;
}

.account-last-used {
    float: right;
    font-size: 12px;
    color: #909399;
    line-height: 28px;
}

.new-account-option {
    color: #409eff;
    font-weight: 500;
}

.account-switch-hint {
    font-size: 12px;
    color: #c0c4cc;
    margin: 10px 0 0 0;
}

.stats-section {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
}

.stat-card {
    background: #fff;
    border-radius: 14px;
    padding: 20px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
    display: flex;
    align-items: center;
    gap: 16px;
    transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.stat-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    flex-shrink: 0;
}

.chats-icon { background: #e6f7ff; color: #1890ff; }
.contacts-icon { background: #f6ffed; color: #52c41a; }
.groups-icon { background: #fff7e6; color: #fa8c16; }
.sends-icon { background: #f0f0ff; color: #722ed1; }

.stat-content { display: flex; flex-direction: column; }

.stat-value {
    font-size: 26px;
    font-weight: 700;
    color: #1a1a2e;
    line-height: 1.2;
}

.stat-value small { font-size: 14px; font-weight: 400; color: #909399; }
.stat-label { font-size: 13px; color: #909399; margin-top: 2px; }

.feature-cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
}

@media (max-width: 800px) {
    .feature-cards { grid-template-columns: 1fr; }
}

.feature-card {
    background: #fff;
    border-radius: 16px;
    padding: 20px 24px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
    display: flex;
    flex-direction: column;
    transition: box-shadow 0.2s;
}

.feature-card:hover { box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1); }

.feature-card-header {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 16px;
}

.feature-icon {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    flex-shrink: 0;
}

.broadcast-feature { background: #e6f7ff; color: #1890ff; }
.autoreply-feature { background: #f0f0ff; color: #722ed1; }
.schedule-feature { background: #fff7e6; color: #fa8c16; }
.quick-feature { background: #f6ffed; color: #52c41a; }

.feature-title-group {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
}

.feature-title-group h4 {
    font-size: 16px;
    font-weight: 700;
    color: #1a1a2e;
    margin: 0;
}

.template-select-full { width: 100%; margin-bottom: 8px; }

.template-preview {
    font-size: 12px;
    color: #909399;
    margin: 0 0 10px 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.card-progress { margin-bottom: 8px; }
.card-progress-text {
    font-size: 12px;
    color: #606266;
    margin: 4px 0 0 0;
    text-align: right;
}

.feature-card-body { flex: 1; }

.card-stat-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 0;
    border-bottom: 1px solid #f0f0f0;
}

.card-stat-row.next-task {
    gap: 6px;
    justify-content: flex-start;
    font-size: 13px;
    color: #606266;
}

.card-stat-row.empty-hint {
    color: #c0c4cc;
    font-size: 13px;
}

.card-stat-label { font-size: 13px; color: #606266; }
.card-stat-value { font-size: 14px; font-weight: 600; color: #1a1a2e; }

.quick-add-form {
    display: flex;
    gap: 8px;
    margin-top: 10px;
    align-items: center;
    flex-wrap: wrap;
}

.quick-add-form .el-input { flex: 1; min-width: 100px; }

.feature-card-actions {
    display: flex;
    gap: 8px;
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid #f0f0f0;
    flex-wrap: wrap;
}
</style>