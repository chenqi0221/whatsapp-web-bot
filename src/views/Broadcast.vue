<template>
  <div class="broadcast">
    <el-row :gutter="20">
      <el-col :span="16">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>群发消息</span>
            </div>
          </template>
          
          <el-form :model="form" label-position="top">
            <el-form-item
              v-for="i in 5"
              :key="i"
              :label="`消息模板 ${i}`"
            >
              <el-input
                v-model="form.messages[i-1]"
                type="textarea"
                :rows="3"
                :placeholder="i === 1 ? '输入要发送的消息... 使用 {name} 插入联系人名字' : '可选'"
              />
            </el-form-item>
            
            <el-form-item label="发送间隔 (毫秒)">
              <el-input-number v-model="form.interval" :min="1000" :step="1000" />
            </el-form-item>
            
            <el-form-item>
              <el-checkbox v-model="form.randomInterval">随机间隔（更像真人）</el-checkbox>
            </el-form-item>
            <el-form-item>
              <el-checkbox v-model="form.randomizeMsg">随机化消息内容（防检测）</el-checkbox>
            </el-form-item>
            <el-form-item>
              <el-checkbox v-model="form.lengthRandomize">消息长度随机化</el-checkbox>
            </el-form-item>
            <el-form-item>
              <el-checkbox v-model="form.simulateTyping">模拟打字输入</el-checkbox>
            </el-form-item>
            <el-form-item>
              <el-checkbox v-model="form.simulateMouse">模拟鼠标移动</el-checkbox>
            </el-form-item>
            <el-form-item>
              <el-checkbox v-model="form.respectHours">只在合理时间发送（9:00-22:00）</el-checkbox>
            </el-form-item>
            <el-form-item>
              <el-checkbox v-model="form.randomPause">随机暂停</el-checkbox>
            </el-form-item>
            <el-form-item>
              <el-checkbox v-model="form.excludeGroups">排除群组</el-checkbox>
            </el-form-item>
            <el-form-item>
              <el-checkbox v-model="form.personalize">自动插入联系人名字</el-checkbox>
            </el-form-item>
            
            <el-form-item label="账号安全级别">
              <el-select v-model="form.accountLevel">
                <el-option label="新账号（每天30条）" value="new" />
                <el-option label="稳定账号（每天80条）" value="established" />
                <el-option label="老账号（每天150条）" value="mature" />
              </el-select>
            </el-form-item>
            
            <el-form-item label="群发对象">
              <el-select v-model="form.targetType">
                <el-option label="已有聊天记录" value="chats" />
                <el-option label="所有联系人" value="contacts" />
                <el-option label="未聊天联系人" value="nohistory" />
                <el-option label="手动输入号码" value="manual" />
              </el-select>
            </el-form-item>
            
            <el-form-item v-if="form.targetType === 'manual'" label="手机号码列表">
              <el-input
                v-model="form.manualNumbers"
                type="textarea"
                :rows="5"
                placeholder="86138xxxxxxx|张三"
              />
            </el-form-item>
          </el-form>
          
          <div class="actions">
            <el-button
              type="primary"
              size="large"
              :loading="isRunning"
              @click="startBroadcast"
            >
              开始群发
            </el-button>
            <el-button
              type="danger"
              size="large"
              :disabled="!isRunning"
              @click="stopBroadcast"
            >
              停止
            </el-button>
          </div>
        </el-card>
      </el-col>
      
      <el-col :span="8">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>发送进度</span>
            </div>
          </template>
          
          <div v-if="progress" class="progress-section">
            <el-progress
              :percentage="progressPercentage"
              :status="progressStatus"
            />
            <div class="progress-info">
              <p>当前: {{ progress.current }} / {{ progress.total }}</p>
              <p>今日发送: {{ progress.daily_sent }} / {{ progress.daily_limit }}</p>
              <p>剩余配额: {{ progress.remaining }}</p>
            </div>
          </div>
          
          <div v-else class="empty-state">
            尚未开始群发
          </div>
        </el-card>
        
        <el-card style="margin-top: 20px">
          <template #header>
            <div class="card-header">
              <span>发送结果</span>
            </div>
          </template>
          <div class="results-list">
            <div
              v-for="(result, index) in results"
              :key="index"
              class="result-item"
              :class="result.status"
            >
              <span>{{ result.name }}</span>
              <el-tag :type="result.status === 'success' ? 'success' : 'danger'" size="small">
                {{ result.status === 'success' ? '成功' : '失败' }}
              </el-tag>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { broadcastApi, systemApi } from '@/api/tauri'

const form = ref({
    messages: ['', '', '', '', ''],
    interval: 10000,
    randomInterval: true,
    randomizeMsg: true,
    lengthRandomize: true,
    simulateTyping: false,
    simulateMouse: false,
    respectHours: true,
    randomPause: true,
    excludeGroups: true,
    personalize: true,
    targetType: 'chats',
    manualNumbers: '',
    accountLevel: 'new'
})

const isRunning = ref(false)
const progress = ref<any>(null)
const results = ref<any[]>([])
let pollTimer: ReturnType<typeof setInterval> | null = null

const progressPercentage = computed(() => {
    if (!progress.value || progress.value.total === 0) return 0
    return Math.round((progress.value.current / progress.value.total) * 100)
})

const progressStatus = computed(() => {
    if (!isRunning.value && progress.value?.current === progress.value?.total) {
        return 'success'
    }
    return ''
})

const startBroadcast = async () => {
    try {
        const messages = form.value.messages.filter(m => m.trim())
        if (messages.length === 0) {
            ElMessage.warning('请至少输入一条消息')
            return
        }
        
        await systemApi.setAccountLevel(form.value.accountLevel)
        
        const options = {
            message: messages,
            interval: form.value.interval,
            random_interval: form.value.randomInterval,
            randomize_msg: form.value.randomizeMsg,
            length_randomize: form.value.lengthRandomize,
            simulate_typing: form.value.simulateTyping,
            simulate_mouse: form.value.simulateMouse,
            respect_hours: form.value.respectHours,
            random_pause: form.value.randomPause,
            exclude_groups: form.value.excludeGroups,
            personalize: form.value.personalize,
            target_type: form.value.targetType,
            manual_numbers: form.value.manualNumbers || null,
            account_level: form.value.accountLevel
        }
        
        await broadcastApi.start(options)
        isRunning.value = true
        ElMessage.success('群发已开始')
        startPolling()
    } catch (e: any) {
        ElMessage.error('启动失败: ' + e.message)
    }
}

const stopBroadcast = async () => {
    try {
        await broadcastApi.stop()
        isRunning.value = false
        ElMessage.info('群发已停止')
    } catch (e: any) {
        ElMessage.error('停止失败: ' + e.message)
    }
}

const startPolling = () => {
    pollTimer = setInterval(async () => {
        try {
            const status: any = await broadcastApi.getStatus()
            progress.value = status
            if (status.results) {
                results.value = status.results
            }
            if (!status.running && isRunning.value) {
                isRunning.value = false
                clearInterval(pollTimer!)
            }
        } catch (e) {
            console.error('Poll error:', e)
        }
    }, 1000)
}

onUnmounted(() => {
    if (pollTimer) clearInterval(pollTimer)
})
</script>

<style scoped>
.broadcast {
  padding: 0;
}

.card-header {
  font-weight: bold;
}

.actions {
  margin-top: 20px;
  display: flex;
  gap: 10px;
}

.progress-section {
  padding: 10px;
}

.progress-info {
  margin-top: 15px;
}

.progress-info p {
  margin: 5px 0;
  color: #666;
}

.results-list {
  max-height: 400px;
  overflow-y: auto;
}

.result-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  border-bottom: 1px solid #eee;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #999;
}
</style>
