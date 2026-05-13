<template>
  <div class="contacts">
    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="8">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-item">
            <el-icon class="stat-icon all"><UserFilled /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ stats.total }}</div>
              <div class="stat-label">全部联系人</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-item">
            <el-icon class="stat-icon chatted"><ChatDotRound /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ stats.chatted }}</div>
              <div class="stat-label">已聊天</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-item">
            <el-icon class="stat-icon unchatted"><User /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ stats.unchatted }}</div>
              <div class="stat-label">未聊天</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 联系人列表 -->
    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>联系人管理</span>
              <div class="header-actions">
                <el-radio-group v-model="filterType" size="small">
                  <el-radio-button label="all">全部</el-radio-button>
                  <el-radio-button label="chatted">已聊天</el-radio-button>
                  <el-radio-button label="unchatted">未聊天</el-radio-button>
                </el-radio-group>
                <el-button type="success" size="small" @click="loadContacts">
                  <el-icon><Refresh /></el-icon>
                  刷新
                </el-button>
                <el-button type="primary" size="small" @click="exportContacts">
                  <el-icon><Download /></el-icon>
                  导出 CSV
                </el-button>
              </div>
            </div>
          </template>

          <el-table
            :data="filteredContacts"
            style="width: 100%"
            v-loading="loading"
            stripe
          >
            <el-table-column type="index" width="60" />
            <el-table-column prop="name" label="姓名" width="200">
              <template #default="{ row }">
                <div class="contact-name">
                  <el-icon v-if="row.hasChat" class="chat-icon"><ChatDotRound /></el-icon>
                  <el-icon v-else class="no-chat-icon"><User /></el-icon>
                  <span>{{ row.name }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="number" label="手机号" width="180" />
            <el-table-column prop="id" label="WhatsApp ID" />
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.hasChat" type="success" size="small">已聊天</el-tag>
                <el-tag v-else type="info" size="small">未聊天</el-tag>
              </template>
            </el-table-column>
          </el-table>

          <div class="pagination" v-if="filteredContacts.length > 0">
            <el-pagination
              v-model:current-page="currentPage"
              :page-size="pageSize"
              :total="filteredContacts.length"
              layout="total, prev, pager, next"
              @current-change="handlePageChange"
            />
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { contactsApi } from '@/api/tauri'

const contacts = ref<any[]>([])
const chats = ref<any[]>([])
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(50)
const filterType = ref('all')

// 构建聊天记录的 ID 集合（多种格式）- 与原版逻辑保持一致
const chatSets = computed(() => {
  const chatNumbers = new Set<string>()
  const chatLids = new Set<string>()
  const chatNames = new Set<string>()
  
  for (const chat of chats.value) {
    const chatId = chat.id
    if (chatId && typeof chatId === 'string') {
      const match = chatId.match(/^(\d+)@/)
      if (match) chatNumbers.add(match[1])
      const lidMatch = chatId.match(/^(\d+)@lid/)
      if (lidMatch) chatLids.add(lidMatch[1])
    }
    if (chat.name) {
      chatNames.add(chat.name.toLowerCase().trim())
    }
  }
  
  return { chatNumbers, chatLids, chatNames }
})

const isContactInChats = (contact: any) => {
  const { chatNumbers, chatLids, chatNames } = chatSets.value
  
  const inChatsByLid = contact.lid && (chatNumbers.has(contact.lid) || chatLids.has(contact.lid))
  const inChatsByNumber = contact.number && chatNumbers.has(contact.number)
  const inChatsById = contact.id && chatNumbers.has(contact.id.split('@')[0])
  const nameMatch = contact.name ? chatNames.has(contact.name.toLowerCase().trim()) : false
  
  return inChatsByLid || inChatsByNumber || inChatsById || nameMatch
}

const stats = computed(() => {
  const total = contacts.value.length
  const chatted = contacts.value.filter(c => isContactInChats(c)).length
  return {
    total,
    chatted,
    unchatted: total - chatted
  }
})

const filteredContacts = computed(() => {
  let result = contacts.value.map(contact => ({
    ...contact,
    hasChat: isContactInChats(contact)
  }))
  
  if (filterType.value === 'chatted') {
    result = result.filter(c => c.hasChat)
  } else if (filterType.value === 'unchatted') {
    result = result.filter(c => !c.hasChat)
  }
  
  return result
})

const loadContacts = async () => {
  loading.value = true
  try {
    const [contactsResult, chatsResult] = await Promise.all([
      contactsApi.getContacts(),
      contactsApi.getChats()
    ])
    contacts.value = contactsResult || []
    chats.value = chatsResult || []
  } catch (e: any) {
    ElMessage.error('加载联系人失败: ' + e.message)
  } finally {
    loading.value = false
  }
}

const exportContacts = async () => {
  try {
    const csv: any = await contactsApi.exportContacts()
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'contacts.csv'
    link.click()
    URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch (e: any) {
    ElMessage.error('导出失败: ' + e.message)
  }
}

const handlePageChange = (page: number) => {
  currentPage.value = page
}

onMounted(() => {
  loadContacts()
})
</script>

<style scoped>
.contacts {
  padding: 0;
}

.stats-row {
  margin-bottom: 10px;
}

.stat-card {
  transition: transform 0.3s;
}

.stat-card:hover {
  transform: translateY(-5px);
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 10px;
}

.stat-icon {
  font-size: 40px;
  padding: 15px;
  border-radius: 10px;
}

.stat-icon.all {
  background: #e6f7ff;
  color: #1890ff;
}

.stat-icon.chatted {
  background: #f6ffed;
  color: #52c41a;
}

.stat-icon.unchatted {
  background: #f5f5f5;
  color: #8c8c8c;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #333;
}

.stat-label {
  font-size: 14px;
  color: #666;
  margin-top: 5px;
}

.card-header {
  font-weight: bold;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.contact-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chat-icon {
  color: #52c41a;
}

.no-chat-icon {
  color: #8c8c8c;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}
</style>
