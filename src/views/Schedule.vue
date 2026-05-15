<template>
  <div class="schedule">
    <el-row :gutter="20">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>添加定时任务</span>
            </div>
          </template>

          <el-form :model="form" label-position="top">
            <el-form-item label="任务名称">
              <el-input v-model="form.name" placeholder="任务名称" />
            </el-form-item>
            <el-form-item label="任务类型">
              <el-select v-model="form.type" @change="handleTypeChange">
                <el-option label="执行一次" value="once" />
                <el-option label="每天执行" value="daily" />
              </el-select>
            </el-form-item>
            <el-form-item v-if="form.type === 'once'" label="执行时间">
              <el-date-picker
                v-model="form.time"
                type="datetime"
                placeholder="选择执行时间"
                style="width: 100%"
              />
            </el-form-item>
            <el-form-item v-else label="执行时间 (小时:分钟)">
              <el-time-picker
                v-model="form.dailyTime"
                format="HH:mm"
                placeholder="选择时间"
                style="width: 100%"
              />
            </el-form-item>
            <el-form-item label="消息内容">
              <el-input
                v-model="form.message"
                type="textarea"
                :rows="3"
                placeholder="定时发送的消息内容..."
              />
            </el-form-item>
            <el-form-item label="发送对象">
              <el-select v-model="form.target">
                <el-option label="所有聊天" value="all" />
                <el-option label="仅私聊" value="private" />
                <el-option label="仅群组" value="groups" />
              </el-select>
            </el-form-item>
            <el-button type="primary" @click="addTask">
              添加任务
            </el-button>
          </el-form>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>任务列表</span>
            </div>
          </template>

          <el-empty v-if="tasks.length === 0" description="暂无定时任务" />
          <div v-else class="task-list">
            <div
              v-for="task in tasks"
              :key="task.id"
              class="task-item"
            >
              <div class="task-info">
                <div class="task-name">{{ task.name }}</div>
                <div class="task-detail">
                  <el-tag size="small">{{ task.type === 'once' ? '一次性' : '每天' }}</el-tag>
                  <span>{{ formatTime(task) }}</span>
                  <el-tag size="small" :type="task.enabled ? 'success' : 'info'">
                    {{ task.enabled ? '启用' : '禁用' }}
                  </el-tag>
                </div>
                <div class="task-message">{{ task.message }}</div>
              </div>
              <div class="task-actions">
                <el-switch
                  v-model="task.enabled"
                  @change="toggleTask(task.id, $event)"
                />
                <el-button
                  type="danger"
                  size="small"
                  @click="deleteTask(task.id)"
                >
                  删除
                </el-button>
              </div>
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

const tasks = ref<any[]>([])
const form = ref({
  name: '',
  type: 'once',
  time: null as Date | null,
  dailyTime: null as Date | null,
  message: '',
  target: 'all'
})

const handleTypeChange = () => {
  form.value.time = null
  form.value.dailyTime = null
}

const formatTime = (task: any) => {
  if (task.type === 'once' && task.time) {
    return new Date(task.time).toLocaleString()
  } else if (task.type === 'daily' && task.dailyTime) {
    return `每天 ${task.dailyTime}`
  }
  return '-'
}

const loadTasks = async () => {
  try {
    const response = await fetch('http://localhost:3003/api/scheduled-tasks')
    const data = await response.json()
    tasks.value = data.tasks || []
  } catch (e) {
    console.error('Failed to load tasks:', e)
  }
}

const addTask = async () => {
  if (!form.value.name || !form.value.message) {
    ElMessage.warning('请填写任务名称和消息内容')
    return
  }

  try {
    const body: any = {
      name: form.value.name,
      type: form.value.type,
      message: form.value.message,
      target: form.value.target
    }

    if (form.value.type === 'once' && form.value.time) {
      body.time = form.value.time.toISOString()
    } else if (form.value.type === 'daily' && form.value.dailyTime) {
      body.dailyTime = `${form.value.dailyTime.getHours().toString().padStart(2, '0')}:${form.value.dailyTime.getMinutes().toString().padStart(2, '0')}`
    }

    const response = await fetch('http://localhost:3003/api/scheduled-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const data = await response.json()
    if (data.success) {
      ElMessage.success('任务添加成功')
      form.value = { name: '', type: 'once', time: null, dailyTime: null, message: '', target: 'all' }
      loadTasks()
    } else {
      ElMessage.error(data.error)
    }
  } catch (e: any) {
    ElMessage.error('添加失败: ' + e.message)
  }
}

const deleteTask = async (id: string) => {
  try {
    const response = await fetch(`http://localhost:3003/api/scheduled-tasks/${id}`, {
      method: 'DELETE'
    })
    const data = await response.json()
    if (data.success) {
      ElMessage.success('任务删除成功')
      loadTasks()
    }
  } catch (e: any) {
    ElMessage.error('删除失败: ' + e.message)
  }
}

const toggleTask = async (id: string, enabled: boolean) => {
  try {
    const response = await fetch(`http://localhost:3003/api/scheduled-tasks/${id}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    })
    const data = await response.json()
    if (data.success) {
      ElMessage.success(enabled ? '任务已启用' : '任务已禁用')
    }
  } catch (e: any) {
    ElMessage.error('切换失败: ' + e.message)
  }
}

onMounted(() => {
  loadTasks()
})
</script>

<style scoped>
.schedule {
  padding: 24px 28px;
  max-width: 1200px;
  margin: 0 auto;
}

.schedule :deep(.el-card) {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  box-shadow: var(--shadow-md);
  transition: box-shadow 0.2s ease;
}

.schedule :deep(.el-card:hover) {
  box-shadow: var(--shadow-lg);
}

.schedule :deep(.el-card__header) {
  border-bottom-color: var(--border-default);
  padding: 16px 24px;
}

.schedule :deep(.el-card__body) {
  padding: 20px 24px;
}

.card-header {
  font-weight: bold;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.task-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 14px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 12px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.task-item:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.task-info {
  flex: 1;
}

.task-name {
  font-weight: bold;
  margin-bottom: 5px;
}

.task-detail {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 5px;
  font-size: 13px;
  color: var(--text-secondary);
}

.task-message {
  color: var(--text-muted);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-end;
}
</style>
