<template>
  <div class="search">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>搜索消息</span>
        </div>
      </template>
      <el-input
        v-model="query"
        placeholder="输入搜索关键词..."
        @keyup.enter="search"
      >
        <template #append>
          <el-button @click="search">搜索</el-button>
        </template>
      </el-input>
      <el-empty v-if="results.length === 0 && searched" description="未找到结果" />
      <div v-if="results.length > 0" class="results">
        <div
          v-for="msg in results"
          :key="msg.id"
          class="result-item"
        >
          <div class="result-chat">{{ msg.chatName }}</div>
          <div class="result-body">{{ msg.body }}</div>
          <div class="result-time">{{ formatTime(msg.timestamp) }}</div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

const query = ref('')
const results = ref<any[]>([])
const searched = ref(false)

const search = async () => {
  if (!query.value.trim()) {
    ElMessage.warning('请输入搜索关键词')
    return
  }

  try {
    const response = await fetch(`http://localhost:3003/api/search?query=${encodeURIComponent(query.value)}`)
    const data = await response.json()
    results.value = data.messages || []
    searched.value = true
  } catch (e: any) {
    ElMessage.error('搜索失败: ' + e.message)
  }
}

const formatTime = (timestamp: number) => {
  return new Date(timestamp * 1000).toLocaleString()
}
</script>

<style scoped>
.search {
  padding: 24px 28px;
  max-width: 1200px;
  margin: 0 auto;
}

.search :deep(.el-card) {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  box-shadow: var(--shadow-md);
  transition: box-shadow 0.2s ease;
}

.search :deep(.el-card:hover) {
  box-shadow: var(--shadow-lg);
}

.search :deep(.el-card__header) {
  border-bottom-color: var(--border-default);
  padding: 16px 24px;
}

.search :deep(.el-card__body) {
  padding: 20px 24px;
}

.card-header {
  font-weight: bold;
}
.results {
  margin-top: 20px;
}
.result-item {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-default);
  transition: background 0.2s ease;
}

.result-item:hover {
  background: var(--bg-secondary);
}
.result-chat {
  font-weight: bold;
  color: var(--accent);
  margin-bottom: 4px;
}
.result-body {
  margin-bottom: 4px;
}
.result-time {
  font-size: 12px;
  color: var(--text-muted);
}
</style>
