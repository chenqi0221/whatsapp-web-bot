<template>
  <div class="broadcast">
    <el-row :gutter="20">
      <el-col :span="16">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>群发消息</span>
              <div class="template-actions">
                <el-button size="small" @click="handleSaveTemplate">保存模板</el-button>
                <el-button size="small" @click="handleExportTemplate">导出模板</el-button>
                <el-button size="small" type="success" @click="triggerImport">导入模板</el-button>
                <input
                  ref="fileInputRef"
                  type="file"
                  accept=".json"
                  style="display: none"
                  @change="handleImportTemplate"
                />
              </div>
            </div>
          </template>

          <div v-if="savedTemplates.length > 0" class="template-selector">
            <span class="template-selector-label">已保存模板：</span>
            <el-select
              v-model="activeTemplateId"
              placeholder="选择模板"
              clearable
              @change="handleSwitchTemplate"
              style="width: 240px"
            >
              <el-option
                v-for="tpl in savedTemplates"
                :key="tpl.id"
                :label="tpl.name"
                :value="tpl.id"
              />
            </el-select>
            <el-button
              v-if="activeTemplateId"
              size="small"
              circle
              @click="handleRenameTemplate"
              title="重命名模板"
            >
              <el-icon><Edit /></el-icon>
            </el-button>
            <el-button
              v-if="activeTemplateId"
              size="small"
              circle
              type="danger"
              @click="handleDeleteTemplate"
              title="删除模板"
            >
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>

          <div v-if="templateName" class="template-name-tag">
            <el-tag closable type="info" @close="clearTemplate">
              当前模板: {{ templateName }}
              <el-button link size="small" @click.stop="handleRenameCurrent" style="margin-left: 4px;">
                <el-icon><Edit /></el-icon>
              </el-button>
            </el-tag>
          </div>

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
          <div v-if="results.length === 0" class="empty-state">
            暂无发送结果
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, onActivated, onDeactivated } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Edit, Delete } from '@element-plus/icons-vue'
import { broadcastApi, systemApi } from '@/api/tauri'

defineOptions({ name: 'Broadcast' })

interface BroadcastTemplate {
    id: string
    name: string
    createdAt: string
    updatedAt: string
    formData: {
        messages: string[]
        interval: number
        randomInterval: boolean
        randomizeMsg: boolean
        lengthRandomize: boolean
        simulateTyping: boolean
        simulateMouse: boolean
        respectHours: boolean
        randomPause: boolean
        excludeGroups: boolean
        personalize: boolean
        targetType: string
        manualNumbers: string
        accountLevel: string
    }
}

const TEMPLATES_KEY = 'broadcast_templates'

const form = ref({
    messages: ['', '', '', '', ''],
    interval: 10000,
    randomInterval: true,
    randomizeMsg: true,
    lengthRandomize: true,
    simulateTyping: true,
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
const broadcastStarted = ref(false)
const progress = ref<any>(null)
const results = ref<any[]>([])
const templateName = ref('')
const activeTemplateId = ref('')
const savedTemplates = ref<BroadcastTemplate[]>([])
const fileInputRef = ref<HTMLInputElement | null>(null)
let pollTimer: ReturnType<typeof setInterval> | null = null
let pollTimeoutId: ReturnType<typeof setTimeout> | null = null

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

// ===================== localStorage 模板管理 =====================

function getLocalTemplates(): BroadcastTemplate[] {
    try {
        const raw = localStorage.getItem(TEMPLATES_KEY)
        return raw ? JSON.parse(raw) : []
    } catch {
        return []
    }
}

function saveLocalTemplates(templates: BroadcastTemplate[]) {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates))
}

function loadTemplates() {
    savedTemplates.value = getLocalTemplates()
}

function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9)
}

function exportCurrentForm() {
    return {
        messages: [...form.value.messages],
        interval: form.value.interval,
        randomInterval: form.value.randomInterval,
        randomizeMsg: form.value.randomizeMsg,
        lengthRandomize: form.value.lengthRandomize,
        simulateTyping: form.value.simulateTyping,
        simulateMouse: form.value.simulateMouse,
        respectHours: form.value.respectHours,
        randomPause: form.value.randomPause,
        excludeGroups: form.value.excludeGroups,
        personalize: form.value.personalize,
        targetType: form.value.targetType,
        manualNumbers: form.value.manualNumbers,
        accountLevel: form.value.accountLevel,
    }
}

function applyFormData(data: BroadcastTemplate['formData']) {
    form.value = {
        messages: data.messages?.length === 5 ? [...data.messages] : ['', '', '', '', ''],
        interval: data.interval ?? 10000,
        randomInterval: data.randomInterval ?? true,
        randomizeMsg: data.randomizeMsg ?? true,
        lengthRandomize: data.lengthRandomize ?? true,
        simulateTyping: data.simulateTyping ?? true,
        simulateMouse: data.simulateMouse ?? false,
        respectHours: data.respectHours ?? true,
        randomPause: data.randomPause ?? true,
        excludeGroups: data.excludeGroups ?? true,
        personalize: data.personalize ?? true,
        targetType: data.targetType ?? 'chats',
        manualNumbers: data.manualNumbers ?? '',
        accountLevel: data.accountLevel ?? 'new',
    }
}

// ===================== 模板切换 =====================

function handleSwitchTemplate(templateId: string) {
    if (!templateId) {
        activeTemplateId.value = ''
        templateName.value = ''
        return
    }
    const tpl = savedTemplates.value.find((t) => t.id === templateId)
    if (!tpl) return
    applyFormData(tpl.formData)
    templateName.value = tpl.name
    activeTemplateId.value = tpl.id
    ElMessage.success(`已切换到模板「${tpl.name}」`)
}

// ===================== 模板保存 =====================

function handleSaveTemplate() {
    const messages = form.value.messages.filter((m) => m.trim())
    if (messages.length === 0) {
        ElMessage.warning('请至少输入一条消息后再保存模板')
        return
    }

    ElMessageBox.prompt('请输入模板名称', '保存模板', {
        confirmButtonText: '保存',
        cancelButtonText: '取消',
        inputValue: templateName.value || '我的模板',
    }).then(({ value: name }) => {
        if (!name || !name.trim()) {
            ElMessage.warning('模板名称不能为空')
            return
        }

        const existing = savedTemplates.value.find((t) => t.id === activeTemplateId.value)
        if (existing) {
            // 更新已有模板
            existing.name = name.trim()
            existing.updatedAt = new Date().toISOString()
            existing.formData = exportCurrentForm()
            templateName.value = name.trim()
        } else {
            // 创建新模板
            const newTpl: BroadcastTemplate = {
                id: generateId(),
                name: name.trim(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                formData: exportCurrentForm(),
            }
            savedTemplates.value.push(newTpl)
            activeTemplateId.value = newTpl.id
            templateName.value = name.trim()
        }

        saveLocalTemplates(savedTemplates.value)
        ElMessage.success(existing ? '模板已更新' : '模板已保存')
    }).catch(() => {})
}

// ===================== 模板重命名 =====================

function handleRenameTemplate() {
    const tpl = savedTemplates.value.find((t) => t.id === activeTemplateId.value)
    if (!tpl) return

    ElMessageBox.prompt('请输入新的模板名称', '重命名模板', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputValue: tpl.name,
    }).then(({ value: newName }) => {
        if (!newName || !newName.trim()) {
            ElMessage.warning('模板名称不能为空')
            return
        }
        tpl.name = newName.trim()
        tpl.updatedAt = new Date().toISOString()
        templateName.value = newName.trim()
        saveLocalTemplates(savedTemplates.value)
        ElMessage.success('模板已重命名')
    }).catch(() => {})
}

function handleRenameCurrent() {
    if (!templateName.value) return
    ElMessageBox.prompt('请输入新的模板名称', '重命名模板', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputValue: templateName.value,
    }).then(({ value: newName }) => {
        if (!newName || !newName.trim()) {
            ElMessage.warning('模板名称不能为空')
            return
        }
        templateName.value = newName.trim()
        if (activeTemplateId.value) {
            const tpl = savedTemplates.value.find((t) => t.id === activeTemplateId.value)
            if (tpl) {
                tpl.name = newName.trim()
                tpl.updatedAt = new Date().toISOString()
                saveLocalTemplates(savedTemplates.value)
            }
        }
        ElMessage.success('模板已重命名')
    }).catch(() => {})
}

// ===================== 模板删除 =====================

function handleDeleteTemplate() {
    const tpl = savedTemplates.value.find((t) => t.id === activeTemplateId.value)
    if (!tpl) return

    ElMessageBox.confirm(`确定要删除模板「${tpl.name}」吗？`, '确认删除', {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
    }).then(() => {
        savedTemplates.value = savedTemplates.value.filter((t) => t.id !== activeTemplateId.value)
        saveLocalTemplates(savedTemplates.value)
        activeTemplateId.value = ''
        templateName.value = ''
        ElMessage.success('模板已删除')
    }).catch(() => {})
}

// ===================== 模板导入导出 =====================

function buildTemplateData() {
    return {
        name: templateName.value || '未命名模板',
        version: 1,
        createdAt: new Date().toISOString(),
        messages: form.value.messages,
        interval: form.value.interval,
        randomInterval: form.value.randomInterval,
        randomizeMsg: form.value.randomizeMsg,
        lengthRandomize: form.value.lengthRandomize,
        simulateTyping: form.value.simulateTyping,
        simulateMouse: form.value.simulateMouse,
        respectHours: form.value.respectHours,
        randomPause: form.value.randomPause,
        excludeGroups: form.value.excludeGroups,
        personalize: form.value.personalize,
        targetType: form.value.targetType,
        manualNumbers: form.value.manualNumbers,
        accountLevel: form.value.accountLevel,
    }
}

function handleExportTemplate() {
    const messages = form.value.messages.filter((m) => m.trim())
    if (messages.length === 0) {
        ElMessage.warning('请至少输入一条消息后再导出模板')
        return
    }

    const data = buildTemplateData()
    const jsonStr = JSON.stringify(data, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    const safeName = (data.name || 'broadcast-template').replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_')
    a.download = `${safeName}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    templateName.value = data.name
    ElMessage.success('模板已导出')
}

function triggerImport() {
    fileInputRef.value?.click()
}

function handleImportTemplate(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target?.result as string)

            if (!data.messages || !Array.isArray(data.messages)) {
                ElMessage.error('无效的模板文件：缺少消息列表')
                return
            }

            const messages = ['', '', '', '', '']
            data.messages.slice(0, 5).forEach((msg: string, i: number) => {
                messages[i] = msg
            })

            const formData = {
                messages,
                interval: data.interval ?? 10000,
                randomInterval: data.randomInterval ?? true,
                randomizeMsg: data.randomizeMsg ?? true,
                lengthRandomize: data.lengthRandomize ?? true,
                simulateTyping: data.simulateTyping ?? true,
                simulateMouse: data.simulateMouse ?? false,
                respectHours: data.respectHours ?? true,
                randomPause: data.randomPause ?? true,
                excludeGroups: data.excludeGroups ?? true,
                personalize: data.personalize ?? true,
                targetType: data.targetType ?? 'chats',
                manualNumbers: data.manualNumbers ?? '',
                accountLevel: data.accountLevel ?? 'new',
            }

            applyFormData(formData)
            templateName.value = data.name || '导入的模板'
            activeTemplateId.value = ''
            ElMessage.success(`模板「${templateName.value}」已加载`)
        } catch (err) {
            ElMessage.error('模板文件解析失败，请检查 JSON 格式')
        }
    }
    reader.readAsText(file)

    input.value = ''
}

function clearTemplate() {
    templateName.value = ''
    activeTemplateId.value = ''
}

// ===================== 群发控制 =====================

function startBroadcast() {
    const messages = form.value.messages.filter((m) => m.trim())
    if (messages.length === 0) {
        ElMessage.warning('请至少输入一条消息')
        return
    }

    isRunning.value = true
    broadcastStarted.value = false
    const hadPrevProgress = progress.value && progress.value.running
    if (!hadPrevProgress) {
        results.value = []
    }
    startPolling()

    systemApi.setAccountLevel(form.value.accountLevel).then(() => {
        return broadcastApi.start({
            message: messages,
            interval: form.value.interval,
            randomInterval: form.value.randomInterval,
            randomizeMsg: form.value.randomizeMsg,
            lengthRandomize: form.value.lengthRandomize,
            simulateTyping: form.value.simulateTyping,
            simulateMouse: form.value.simulateMouse,
            respectHours: form.value.respectHours,
            randomPause: form.value.randomPause,
            excludeGroups: form.value.excludeGroups,
            personalize: form.value.personalize,
            targetType: form.value.targetType,
            manualNumbers: form.value.manualNumbers || null,
            accountLevel: form.value.accountLevel,
        })
    }).then((result: any) => {
        if (result.success === false) {
            ElMessage.error('启动失败: ' + (result.error || '未知错误'))
            isRunning.value = false
            broadcastStarted.value = false
            stopPolling()
            return
        }
        ElMessage.success('群发已开始')
        broadcastStarted.value = true
    }).catch((e: any) => {
        isRunning.value = false
        broadcastStarted.value = false
        stopPolling()
        ElMessage.error('启动失败: ' + e.message)
    })
}

async function stopBroadcast() {
    const wasRunning = isRunning.value
    const prevProgress = progress.value
    const prevResults = results.value

    isRunning.value = false
    broadcastStarted.value = false
    stopPolling()

    try {
        await broadcastApi.stop()
        progress.value = null
        results.value = []
        ElMessage.info('群发已停止')
    } catch (e: any) {
        isRunning.value = wasRunning
        broadcastStarted.value = wasRunning
        progress.value = prevProgress
        results.value = prevResults
        if (wasRunning) {
            startPolling()
        }
        ElMessage.error('停止失败: ' + e.message)
    }
}

function stopPolling() {
    if (pollTimeoutId) {
        clearTimeout(pollTimeoutId)
        pollTimeoutId = null
    }
    if (pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
    }
}

function startPolling() {
    stopPolling()
    pollTimeoutId = setTimeout(() => {
        pollTimer = setInterval(async () => {
            try {
                const status: any = await broadcastApi.getStatus()
                if (!status) return
                progress.value = status
                if (status.results) {
                    results.value = status.results
                }
                if (!status.running && isRunning.value && broadcastStarted.value) {
                    isRunning.value = false
                    broadcastStarted.value = false
                    stopPolling()
                    if (progress.value && progress.value.current >= progress.value.total) {
                        ElMessage.success('群发已完成')
                    }
                }
            } catch (e) {
                console.error('Poll error:', e)
            }
        }, 1000)
    }, 1000)
}

// ===================== 生命周期 =====================

function checkBroadcastStatus() {
    broadcastApi.getStatus().then((status: any) => {
        if (!status) return
        if (status.running) {
            isRunning.value = true
            broadcastStarted.value = true
            progress.value = status
            if (status.results) {
                results.value = status.results
            }
            startPolling()
        } else if (isRunning.value && broadcastStarted.value) {
            isRunning.value = false
            broadcastStarted.value = false
            progress.value = status
            if (status.results) {
                results.value = status.results
            }
        }
    }).catch((e) => {
        console.error('Failed to check broadcast status:', e)
    })
}

onActivated(() => {
    loadTemplates()
    checkBroadcastStatus()
})

onDeactivated(() => {
    stopPolling()
})
</script>

<style scoped>
.broadcast {
    padding: 0;
}

.card-header {
    font-weight: bold;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.template-actions {
    display: flex;
    gap: 8px;
}

.template-selector {
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: #f5f7fa;
    border-radius: 4px;
}

.template-selector-label {
    font-size: 13px;
    color: #606266;
    white-space: nowrap;
}

.template-name-tag {
    margin-bottom: 12px;
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