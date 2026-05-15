<template>
  <div class="stats">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>数据统计</span>
          <el-button type="primary" @click="loadStats">刷新统计</el-button>
        </div>
      </template>
      <el-empty v-if="!stats.totalChats" description="点击刷新查看统计" />
      <el-row v-else :gutter="20">
        <el-col :span="8">
          <div class="stat-item">
            <div class="stat-value">{{ stats.totalChats }}</div>
            <div class="stat-label">总聊天数</div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="stat-item">
            <div class="stat-value">{{ stats.totalContacts }}</div>
            <div class="stat-label">总联系人数</div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="stat-item">
            <div class="stat-value">{{ stats.totalGroups }}</div>
            <div class="stat-label">群组数</div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="stat-item">
            <div class="stat-value">{{ stats.totalPrivateChats }}</div>
            <div class="stat-label">私聊数</div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="stat-item">
            <div class="stat-value">{{ stats.totalUnreadMessages }}</div>
            <div class="stat-label">未读消息数</div>
          </div>
        </el-col>
      </el-row>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

const stats = ref<any>({})

const loadStats = async () => {
  try {
    const response = await fetch('http://localhost:3003/api/stats')
    const data = await response.json()
    stats.value = data.stats || {}
  } catch (e: any) {
    ElMessage.error('加载统计失败: ' + e.message)
  }
}

onMounted(() => {
  loadStats()
})
</script>

<style scoped>
.stats {
  padding: 24px 28px;
  max-width: 1200px;
  margin: 0 auto;
}

.stats :deep(.el-card) {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  box-shadow: var(--shadow-md);
  transition: box-shadow 0.2s ease;
}

.stats :deep(.el-card:hover) {
  box-shadow: var(--shadow-lg);
}

.stats :deep(.el-card__header) {
  border-bottom-color: var(--border-default);
  padding: 16px 24px;
}

.stats :deep(.el-card__body) {
  padding: 20px 24px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: bold;
}
.stat-item {
  text-align: center;
  padding: 24px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 14px;
  margin-bottom: 20px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.stat-item:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
}
.stat-value {
  font-size: 32px;
  font-weight: bold;
  color: var(--accent);
}
.stat-label {
  margin-top: 5px;
  color: var(--text-secondary);
}
</style>
