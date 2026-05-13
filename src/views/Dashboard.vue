<template>
  <div class="dashboard">
    <el-row :gutter="20">
      <el-col :span="16">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>连接状态</span>
            </div>
          </template>
          
          <div v-if="store.status === 'qr'" class="qr-section">
            <p>请使用 WhatsApp 扫描下方二维码</p>
            <img :src="qrCodeUrl" alt="QR Code" class="qr-image" />
          </div>
          
          <div v-else-if="store.status === 'ready'" class="status-ready">
            <el-result
              icon="success"
              title="已连接"
              sub-title="WhatsApp 连接正常"
            />
          </div>
          
          <div v-else class="status-disconnected">
            <el-result
              icon="info"
              title="未连接"
              :sub-title="statusMessage"
            >
              <template #extra>
                <el-button type="primary" @click="handleConnect">
                  连接 WhatsApp
                </el-button>
              </template>
            </el-result>
          </div>
        </el-card>
        
        <el-card style="margin-top: 20px">
          <template #header>
            <div class="card-header">
              <span>今日统计</span>
            </div>
          </template>
          <el-row :gutter="20">
            <el-col :span="8">
              <div class="stat-item">
                <div class="stat-value">{{ dailyStats.sent || 0 }}</div>
                <div class="stat-label">已发送</div>
              </div>
            </el-col>
            <el-col :span="8">
              <div class="stat-item">
                <div class="stat-value">{{ dailyStats.failed || 0 }}</div>
                <div class="stat-label">失败</div>
              </div>
            </el-col>
            <el-col :span="8">
              <div class="stat-item">
                <div class="stat-value">{{ dailyStats.remaining || 0 }}</div>
                <div class="stat-label">剩余配额</div>
              </div>
            </el-col>
          </el-row>
        </el-card>
      </el-col>
      
      <el-col :span="8">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>账号管理</span>
            </div>
          </template>
          <div class="account-list">
            <div
              v-for="account in sessions"
              :key="account.id"
              class="account-item"
            >
              <span>{{ account.name }}</span>
              <el-button
                type="primary"
                size="small"
                @click="switchAccount(account.id)"
              >
                切换
              </el-button>
            </div>
          </div>
          <el-button
            type="success"
            style="width: 100%; margin-top: 10px"
            @click="createNewAccount"
          >
            新建账号
          </el-button>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useWhatsAppStore } from '@/stores/whatsapp'
import { systemApi } from '@/api/tauri'

const store = useWhatsAppStore()
const sessions = ref<any[]>([])
const dailyStats = ref<any>({})

const qrCodeUrl = computed(() => {
    if (store.qr) {
        return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(store.qr)}`
    }
    return ''
})

const statusMessage = computed(() => {
    switch (store.status) {
        case 'disconnected': return '点击连接按钮开始'
        case 'retrying': return '正在重试...'
        case 'auth_failure': return '认证失败，请重试'
        default: return store.status
    }
})

const handleConnect = async () => {
    await store.connect(false)
}

const switchAccount = async (clientId: string) => {
    await store.connect(false, clientId)
}

const createNewAccount = async () => {
    await store.connect(true)
}

const loadSessions = async () => {
    try {
        const result: any = await systemApi.getSessions()
        sessions.value = result.sessions || []
    } catch (e) {
        console.error('Failed to load sessions:', e)
    }
}

const loadDailyStats = async () => {
    try {
        dailyStats.value = await systemApi.getDailyStats()
    } catch (e) {
        console.error('Failed to load daily stats:', e)
    }
}

onMounted(() => {
    loadSessions()
    loadDailyStats()
})
</script>

<style scoped>
.dashboard {
  padding: 0;
}

.card-header {
  font-weight: bold;
}

.qr-section {
  text-align: center;
  padding: 20px;
}

.qr-image {
  width: 200px;
  height: 200px;
  margin-top: 10px;
}

.stat-item {
  text-align: center;
  padding: 20px;
}

.stat-value {
  font-size: 32px;
  font-weight: bold;
  color: #409EFF;
}

.stat-label {
  margin-top: 5px;
  color: #666;
}

.account-list {
  max-height: 300px;
  overflow-y: auto;
}

.account-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  border-bottom: 1px solid #eee;
}
</style>
