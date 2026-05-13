<template>
  <div class="messages">
    <el-row :gutter="20">
      <el-col :span="8">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>聊天列表</span>
            </div>
          </template>
          <div class="chat-list">
            <div
              v-for="chat in chats"
              :key="chat.id"
              class="chat-item"
              :class="{ active: selectedChat?.id === chat.id }"
              @click="selectChat(chat)"
            >
              <div class="chat-name">{{ chat.name }}</div>
              <div class="chat-preview">{{ chat.lastMessage || '无消息' }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="16">
        <el-card v-if="selectedChat">
          <template #header>
            <div class="card-header">
              <span>{{ selectedChat.name }}</span>
            </div>
          </template>
          <div class="message-list" v-loading="loading">
            <div
              v-for="msg in messages"
              :key="msg.id"
              class="message-item"
              :class="{ self: msg.fromMe }"
            >
              <div class="message-content">{{ msg.body }}</div>
              <div class="message-time">{{ formatTime(msg.timestamp) }}</div>
            </div>
          </div>
          <div class="message-input">
            <el-input
              v-model="newMessage"
              placeholder="输入消息..."
              @keyup.enter="sendMessage"
            >
              <template #append>
                <el-button @click="sendMessage">发送</el-button>
              </template>
            </el-input>
          </div>
        </el-card>
        <el-empty v-else description="选择一个聊天查看消息" />
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

const chats = ref<any[]>([])
const selectedChat = ref<any>(null)
const messages = ref<any[]>([])
const newMessage = ref('')
const loading = ref(false)

const loadChats = async () => {
  try {
    const response = await fetch('http://localhost:3003/api/chats')
    const data = await response.json()
    chats.value = data.chats || []
  } catch (e) {
    console.error('Failed to load chats:', e)
  }
}

const selectChat = async (chat: any) => {
  selectedChat.value = chat
  loading.value = true
  try {
    const response = await fetch(`http://localhost:3003/api/chat/${chat.id}/messages?limit=50`)
    const data = await response.json()
    messages.value = data.messages || []
  } catch (e) {
    console.error('Failed to load messages:', e)
  } finally {
    loading.value = false
  }
}

const sendMessage = async () => {
  if (!newMessage.value.trim() || !selectedChat.value) return

  try {
    const response = await fetch('http://localhost:3003/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: selectedChat.value.id,
        message: newMessage.value
      })
    })
    const data = await response.json()
    if (data.success) {
      newMessage.value = ''
      selectChat(selectedChat.value)
    }
  } catch (e: any) {
    ElMessage.error('发送失败: ' + e.message)
  }
}

const formatTime = (timestamp: number) => {
  return new Date(timestamp * 1000).toLocaleString()
}

onMounted(() => {
  loadChats()
})
</script>

<style scoped>
.messages {
  padding: 0;
}
.card-header {
  font-weight: bold;
}
.chat-list {
  max-height: 600px;
  overflow-y: auto;
}
.chat-item {
  padding: 12px;
  border-bottom: 1px solid #eee;
  cursor: pointer;
  transition: background 0.3s;
}
.chat-item:hover, .chat-item.active {
  background: #f5f5f5;
}
.chat-name {
  font-weight: bold;
  margin-bottom: 4px;
}
.chat-preview {
  font-size: 12px;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.message-list {
  max-height: 500px;
  overflow-y: auto;
  padding: 10px;
}
.message-item {
  margin-bottom: 10px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.message-item.self {
  align-items: flex-end;
}
.message-content {
  background: #f5f5f5;
  padding: 8px 12px;
  border-radius: 8px;
  max-width: 70%;
}
.message-item.self .message-content {
  background: #409EFF;
  color: white;
}
.message-time {
  font-size: 11px;
  color: #999;
  margin-top: 2px;
}
.message-input {
  margin-top: 10px;
}
</style>
