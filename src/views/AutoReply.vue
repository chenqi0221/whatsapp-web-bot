<template>
  <div class="autoreply">
    <el-row :gutter="20">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>自动回复规则</span>
              <el-switch
                v-model="enabled"
                active-text="启用"
                inactive-text="禁用"
                @change="toggleAutoReply"
              />
            </div>
          </template>

          <el-form :model="form" label-position="top">
            <el-form-item label="关键词">
              <el-input
                v-model="form.keyword"
                placeholder="触发关键词"
              />
            </el-form-item>
            <el-form-item label="匹配方式">
              <el-select v-model="form.matchType">
                <el-option label="包含关键词" value="keyword" />
                <el-option label="完全匹配" value="exact" />
                <el-option label="正则表达式" value="regex" />
              </el-select>
            </el-form-item>
            <el-form-item label="回复内容">
              <el-input
                v-model="form.reply"
                type="textarea"
                :rows="3"
                placeholder="自动回复的消息内容..."
              />
            </el-form-item>
            <el-button type="primary" @click="addRule">
              添加规则
            </el-button>
          </el-form>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>规则列表</span>
            </div>
          </template>

          <el-empty v-if="rules.length === 0" description="暂无规则" />
          <div v-else class="rule-list">
            <div
              v-for="rule in rules"
              :key="rule.id"
              class="rule-item"
            >
              <div class="rule-info">
                <el-tag size="small">{{ getMatchTypeLabel(rule.matchType) }}</el-tag>
                <span class="keyword">{{ rule.keyword }}</span>
                <span class="reply">→ {{ rule.reply }}</span>
              </div>
              <el-button
                type="danger"
                size="small"
                @click="deleteRule(rule.id)"
              >
                删除
              </el-button>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

const enabled = ref(false)
const rules = ref<any[]>([])
const form = ref({
  keyword: '',
  reply: '',
  matchType: 'keyword'
})

const getMatchTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    keyword: '包含',
    exact: '完全匹配',
    regex: '正则'
  }
  return labels[type] || type
}

const loadRules = async () => {
  try {
    const response = await fetch('http://localhost:3003/api/auto-reply')
    const data = await response.json()
    rules.value = data.rules || []
    enabled.value = data.enabled || false
  } catch (e) {
    console.error('Failed to load rules:', e)
  }
}

const addRule = async () => {
  if (!form.value.keyword || !form.value.reply) {
    ElMessage.warning('请填写关键词和回复内容')
    return
  }

  try {
    const response = await fetch('http://localhost:3003/api/auto-reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value)
    })
    const data = await response.json()
    if (data.success) {
      ElMessage.success('规则添加成功')
      form.value = { keyword: '', reply: '', matchType: 'keyword' }
      loadRules()
    } else {
      ElMessage.error(data.error)
    }
  } catch (e: any) {
    ElMessage.error('添加失败: ' + e.message)
  }
}

const deleteRule = async (id: string) => {
  try {
    const response = await fetch(`http://localhost:3003/api/auto-reply/${id}`, {
      method: 'DELETE'
    })
    const data = await response.json()
    if (data.success) {
      ElMessage.success('规则删除成功')
      loadRules()
    }
  } catch (e: any) {
    ElMessage.error('删除失败: ' + e.message)
  }
}

const toggleAutoReply = async () => {
  try {
    const response = await fetch('http://localhost:3003/api/auto-reply/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: enabled.value })
    })
    const data = await response.json()
    if (data.success) {
      ElMessage.success(enabled.value ? '自动回复已启用' : '自动回复已禁用')
    }
  } catch (e: any) {
    ElMessage.error('切换失败: ' + e.message)
  }
}

onMounted(() => {
  loadRules()
})
</script>

<style scoped>
.autoreply {
  padding: 24px 28px;
  max-width: 1200px;
  margin: 0 auto;
}

.autoreply :deep(.el-card) {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  box-shadow: var(--shadow-md);
  transition: box-shadow 0.2s ease;
}

.autoreply :deep(.el-card:hover) {
  box-shadow: var(--shadow-lg);
}

.autoreply :deep(.el-card__header) {
  border-bottom-color: var(--border-default);
  padding: 16px 24px;
}

.autoreply :deep(.el-card__body) {
  padding: 20px 24px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.rule-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.rule-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 12px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.rule-item:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.rule-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.keyword {
  font-weight: bold;
  color: var(--accent);
}

.reply {
  color: var(--text-secondary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
