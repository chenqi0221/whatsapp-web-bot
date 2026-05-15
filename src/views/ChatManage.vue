<template>
  <div class="chat-manage">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>聊天管理</span>
        </div>
      </template>

      <el-table :data="chats" style="width: 100%" v-loading="loading">
        <el-table-column prop="name" label="名称" />
        <el-table-column prop="id" label="ID" show-overflow-tooltip />
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="row.isGroup ? 'warning' : 'success'">
              {{ row.isGroup ? '群组' : '私聊' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="未读" width="80">
          <template #default="{ row }">
            <el-badge :value="row.unreadCount" v-if="row.unreadCount > 0" />
            <span v-else>0</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="400">
          <template #default="{ row }">
            <el-button-group>
              <el-button size="small" @click="markSeen(row.id)">已读</el-button>
              <el-button size="small" @click="pinChat(row.id, true)">置顶</el-button>
              <el-button size="small" @click="pinChat(row.id, false)">取消置顶</el-button>
              <el-button size="small" @click="archiveChat(row.id)">归档</el-button>
              <el-button size="small" @click="muteChat(row.id)">静音</el-button>
              <el-button size="small" @click="unmuteChat(row.id)">取消静音</el-button>
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

const chats = ref<any[]>([])
const loading = ref(false)

const loadChats = async () => {
  loading.value = true
  try {
    const response = await fetch('http://localhost:3003/api/chats')
    const data = await response.json()
    chats.value = data.chats || []
  } catch (e) {
    console.error('Failed to load chats:', e)
  } finally {
    loading.value = false
  }
}

const markSeen = async (id: string) => {
  try {
    const response = await fetch(`http://localhost:3003/api/chat/${id}/mark-seen`, {
      method: 'POST'
    })
    const data = await response.json()
    if (data.success) ElMessage.success('已标记为已读')
  } catch (e: any) {
    ElMessage.error('操作失败: ' + e.message)
  }
}

const pinChat = async (id: string, pin: boolean) => {
  try {
    const response = await fetch(`http://localhost:3003/api/chat/${id}/pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    })
    const data = await response.json()
    if (data.success) ElMessage.success(pin ? '已置顶' : '已取消置顶')
  } catch (e: any) {
    ElMessage.error('操作失败: ' + e.message)
  }
}

const archiveChat = async (id: string) => {
  try {
    const response = await fetch(`http://localhost:3003/api/chat/${id}/archive`, {
      method: 'POST'
    })
    const data = await response.json()
    if (data.success) ElMessage.success('已归档')
  } catch (e: any) {
    ElMessage.error('操作失败: ' + e.message)
  }
}

const muteChat = async (id: string) => {
  try {
    const response = await fetch(`http://localhost:3003/api/chat/${id}/mute`, {
      method: 'POST'
    })
    const data = await response.json()
    if (data.success) ElMessage.success('已静音')
  } catch (e: any) {
    ElMessage.error('操作失败: ' + e.message)
  }
}

const unmuteChat = async (id: string) => {
  try {
    const response = await fetch(`http://localhost:3003/api/chat/${id}/mute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unmute: true })
    })
    const data = await response.json()
    if (data.success) ElMessage.success('已取消静音')
  } catch (e: any) {
    ElMessage.error('操作失败: ' + e.message)
  }
}

onMounted(() => {
  loadChats()
})
</script>

<style scoped>
.chat-manage {
  padding: 24px 28px;
  max-width: 1200px;
  margin: 0 auto;
}

.chat-manage :deep(.el-card) {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  box-shadow: var(--shadow-md);
  transition: box-shadow 0.2s ease;
}

.chat-manage :deep(.el-card:hover) {
  box-shadow: var(--shadow-lg);
}

.chat-manage :deep(.el-card__header) {
  border-bottom-color: var(--border-default);
  padding: 16px 24px;
}

.chat-manage :deep(.el-card__body) {
  padding: 20px 24px;
}

.card-header {
  font-weight: bold;
}
</style>
