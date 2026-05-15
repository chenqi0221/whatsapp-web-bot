<template>
  <div class="broadcast">
    <!-- 第一行：模板管理 -->
    <el-row :gutter="20" class="row-gap">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>模板管理</span>
              <div class="template-actions">
                <el-button size="small" @click="handleSaveTemplate">保存模板</el-button>
                <el-button size="small" @click="handleExportTemplate">导出模板</el-button>
                <el-button size="small" type="success" @click="triggerImport">导入模板</el-button>
                <el-button size="small" type="warning" @click="openImportDialog">
                  <el-icon><Upload /></el-icon>
                  导入联系人
                </el-button>
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

          <div v-if="savedTemplates.length === 0" class="empty-state-small">
            暂无保存的模板，编辑消息后点击「保存模板」
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 第二行：消息编辑(左) + 功能设置(右) -->
    <el-row :gutter="20" class="row-gap">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>消息编辑</span>
              <el-tooltip content="使用 {name} 插入联系人名字">
                <el-icon class="hint-icon"><Info-Filled /></el-icon>
              </el-tooltip>
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
                :rows="2"
                :placeholder="i === 1 ? '输入要发送的消息... 使用 {name} 插入联系人名字' : '可选'"
              />
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>功能设置</span>
            </div>
          </template>

          <el-row :gutter="16">
            <el-col :span="12">
              <el-form :model="form" label-position="top">
                <el-form-item label="发送间隔 (毫秒)">
                  <el-input-number v-model="form.interval" :min="1000" :step="1000" style="width: 100%" />
                </el-form-item>
                <el-form-item label="账号安全级别">
                  <el-select v-model="form.accountLevel" style="width: 100%">
                    <el-option label="新账号（每天30条）" value="new" />
                    <el-option label="稳定账号（每天80条）" value="established" />
                    <el-option label="老账号（每天150条）" value="mature" />
                  </el-select>
                </el-form-item>
                <el-form-item label="群发对象">
                  <el-select v-model="form.targetType" style="width: 100%">
                    <el-option label="已有聊天记录" value="chats">
                      <span>已有聊天记录</span>
                      <el-tag v-if="targetCounts.chats > 0" type="success" size="small" style="margin-left: 8px">
                        {{ targetCounts.chats }}
                      </el-tag>
                    </el-option>
                    <el-option label="所有联系人" value="contacts">
                      <span>所有联系人</span>
                      <el-tag v-if="targetCounts.contacts > 0" type="success" size="small" style="margin-left: 8px">
                        {{ targetCounts.contacts }}
                      </el-tag>
                    </el-option>
                    <el-option label="未聊天联系人" value="nohistory">
                      <span>未聊天联系人</span>
                      <el-tag v-if="targetCounts.nohistory > 0" type="success" size="small" style="margin-left: 8px">
                        {{ targetCounts.nohistory }}
                      </el-tag>
                    </el-option>
                    <el-option label="手动输入号码" value="manual" />
                    <el-option label="导入的联系人" value="imported">
                      <span>导入的联系人</span>
                      <el-tag v-if="importedContacts.length > 0" type="success" size="small" style="margin-left: 8px">
                        {{ importedContacts.length }}
                      </el-tag>
                    </el-option>
                  </el-select>
                </el-form-item>
                <el-form-item v-if="form.targetType === 'imported'">
                  <div class="imported-contacts-info">
                    <el-tag v-if="importedContacts.length > 0" type="info" size="small">
                      已导入 {{ importedContacts.length }} 条联系人
                    </el-tag>
                    <el-tag v-else type="warning" size="small">
                      尚未导入联系人
                    </el-tag>
                    <el-button
                      v-if="importedContacts.length > 0"
                      size="small"
                      type="danger"
                      link
                      @click="clearImportedContacts"
                    >
                      清除
                    </el-button>
                  </div>
                </el-form-item>
                <el-form-item v-if="form.targetType === 'manual'" label="手机号码列表">
                  <el-input
                    v-model="form.manualNumbers"
                    type="textarea"
                    :rows="3"
                    placeholder="86138xxxxxxx|张三"
                  />
                </el-form-item>
              </el-form>
            </el-col>
            <el-col :span="12">
              <div class="feature-toggles">
                <div class="feature-group-title">发送策略</div>
                <el-form :model="form" label-position="top">
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
                    <el-checkbox v-model="form.respectHours">只在合理时间发送（9:00-22:00）</el-checkbox>
                  </el-form-item>
                  <el-form-item>
                    <el-checkbox v-model="form.randomPause">随机暂停</el-checkbox>
                  </el-form-item>
                </el-form>
                <div class="feature-group-title" style="margin-top: 8px;">模拟行为</div>
                <el-form :model="form" label-position="top">
                  <el-form-item>
                    <el-checkbox v-model="form.simulateTyping">模拟打字输入</el-checkbox>
                  </el-form-item>
                  <el-form-item>
                    <el-checkbox v-model="form.simulateMouse">模拟鼠标移动</el-checkbox>
                  </el-form-item>
                </el-form>
                <div class="feature-group-title" style="margin-top: 8px;">过滤选项</div>
                <el-form :model="form" label-position="top">
                  <el-form-item>
                    <el-checkbox v-model="form.excludeGroups">排除群组</el-checkbox>
                  </el-form-item>
                  <el-form-item>
                    <el-checkbox v-model="form.personalize">自动插入联系人名字</el-checkbox>
                  </el-form-item>
                </el-form>
              </div>
            </el-col>
          </el-row>
        </el-card>
      </el-col>
    </el-row>

    <!-- 第三行：发送控制 + 进度 + 结果 -->
    <el-row :gutter="20" class="row-gap">
      <el-col :span="8">
        <el-card class="control-card">
          <template #header>
            <div class="card-header">
              <span>发送控制</span>
            </div>
          </template>

          <div class="control-actions">
            <el-button
              type="primary"
              size="large"
              :loading="isRunning"
              @click="startBroadcast"
              class="control-btn start-btn"
            >
              <el-icon><Promotion /></el-icon>
              开始群发
            </el-button>
            <el-button
              type="danger"
              size="large"
              :disabled="!isRunning"
              @click="stopBroadcast"
              class="control-btn stop-btn"
            >
              <el-icon><Circle-Close /></el-icon>
              停止发送
            </el-button>
          </div>

          <div v-if="progress" class="quick-stats">
            <div class="quick-stat-item">
              <span class="quick-stat-label">当前进度</span>
              <span class="quick-stat-value">{{ progress.current }} / {{ progress.total }}</span>
            </div>
            <div class="quick-stat-item">
              <span class="quick-stat-label">今日发送</span>
              <span class="quick-stat-value">{{ progress.daily_sent }} / {{ progress.daily_limit }}</span>
            </div>
            <div class="quick-stat-item">
              <span class="quick-stat-label">剩余配额</span>
              <span class="quick-stat-value">{{ progress.remaining }}</span>
            </div>
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
              :stroke-width="18"
              type="line"
            />
            <div class="progress-info">
              <div class="progress-info-row">
                <span class="progress-info-label">当前进度</span>
                <span class="progress-info-value">{{ progress.current }} / {{ progress.total }}</span>
              </div>
              <div class="progress-info-row">
                <span class="progress-info-label">今日发送</span>
                <span class="progress-info-value">{{ progress.daily_sent }} / {{ progress.daily_limit }}</span>
              </div>
              <div class="progress-info-row">
                <span class="progress-info-label">剩余配额</span>
                <span class="progress-info-value">{{ progress.remaining }}</span>
              </div>
            </div>
          </div>

          <div v-else class="empty-state">
            <el-icon :size="48" class="empty-icon"><Timer /></el-icon>
            <p>尚未开始群发</p>
          </div>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>发送结果</span>
              <el-tag v-if="results.length > 0" type="info" size="small">{{ results.length }} 条</el-tag>
            </div>
          </template>
          <div class="results-list">
            <div
              v-for="(result, index) in results"
              :key="index"
              class="result-item"
              :class="result.status"
            >
              <span class="result-name">{{ result.name }}</span>
              <el-tag :type="result.status === 'success' ? 'success' : 'danger'" size="small">
                {{ result.status === 'success' ? '成功' : '失败' }}
              </el-tag>
            </div>
          </div>
          <div v-if="results.length === 0" class="empty-state">
            <el-icon :size="48" class="empty-icon"><Document /></el-icon>
            <p>暂无发送结果</p>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 导入联系人弹窗 -->
    <el-dialog
      v-model="importDialogVisible"
      title="导入联系人"
      width="600px"
      :close-on-click-modal="false"
    >
      <div class="import-dialog-content">
        <div class="import-section">
          <div class="section-label">选择 CSV 文件</div>
          <el-select
            v-model="selectedCsvFile"
            placeholder="请选择 CSV 文件"
            style="width: 100%"
            :loading="isScanning"
          >
            <el-option
              v-for="file in csvFiles"
              :key="file"
              :label="file"
              :value="file"
            />
          </el-select>
          <div v-if="csvFiles.length === 0 && !isScanning" class="no-files-hint">
            未找到 CSV 文件，请确保项目根目录有 CSV 文件
          </div>
        </div>

        <div class="import-actions" style="margin-top: 16px">
          <el-button type="primary" @click="handlePreviewCsv" :disabled="!selectedCsvFile">
            预览数据
          </el-button>
        </div>

        <div v-if="csvPreview.length > 0" class="preview-section">
          <div class="section-label">
            数据预览 (共 {{ csvPreview.length }} 条)
            <el-tag v-if="importStats.skipped > 0" type="warning" size="small" style="margin-left: 8px">
              跳过 {{ importStats.skipped }} 条无效数据
            </el-tag>
          </div>
          <el-table :data="csvPreview.slice(0, 10)" size="small" style="width: 100%">
            <el-table-column prop="name" label="联系人名称" min-width="120" />
            <el-table-column prop="phone" label="电话号码" min-width="120" />
            <el-table-column prop="source" label="来源" min-width="100" />
          </el-table>
          <div v-if="csvPreview.length > 10" class="preview-more">
            还有 {{ csvPreview.length - 10 }} 条数据...
          </div>
        </div>
      </div>

      <template #footer>
        <el-button @click="importDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="isImporting"
          :disabled="csvPreview.length === 0"
          @click="handleImportCsv"
        >
          确认导入
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onActivated, onDeactivated } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Edit, Delete, InfoFilled, Promotion, CircleClose, Timer, Document, Upload } from '@element-plus/icons-vue'
import { broadcastApi, systemApi, importedContactsApi, contactsApi } from '@/api/tauri'
import type { ImportedContact } from '@/api/tauri'

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

// ===================== 目标人数统计 =====================

const targetCounts = ref({
    chats: 0,
    contacts: 0,
    nohistory: 0,
})

async function loadTargetCounts() {
    try {
        const [chatsRes, contactsRes, unchattedRes] = await Promise.all([
            contactsApi.getChats(),
            contactsApi.getContacts(),
            contactsApi.getUnchatted(),
        ])
        console.log('loadTargetCounts:', { chatsRes, contactsRes, unchattedRes })
        if (chatsRes.success !== false) {
            targetCounts.value.chats = chatsRes.chats?.length || 0
        }
        if (contactsRes.success !== false) {
            targetCounts.value.contacts = contactsRes.contacts?.length || 0
        }
        // 使用后端 /api/contacts/unchatted 接口获取准确的未聊天联系人数量
        if (unchattedRes.success !== false) {
            targetCounts.value.nohistory = unchattedRes.total || 0
        }
        console.log('targetCounts:', targetCounts.value)
    } catch (e) {
        console.error('加载目标人数失败:', e)
    }
}

// ===================== 导入联系人 =====================

const importDialogVisible = ref(false)
const csvFiles = ref<string[]>([])
const selectedCsvFile = ref('')
const csvPreview = ref<ImportedContact[]>([])
const importedContacts = ref<ImportedContact[]>([])
const isImporting = ref(false)
const isScanning = ref(false)
const importStats = ref({ total: 0, imported: 0, skipped: 0 })

async function openImportDialog() {
    importDialogVisible.value = true
    csvFiles.value = []
    selectedCsvFile.value = ''
    csvPreview.value = []
    isScanning.value = true
    try {
        const res: any = await importedContactsApi.scanCsv()
        if (res.success && res.files) {
            csvFiles.value = res.files
            if (res.files.length === 0) {
                ElMessage.info('未在根目录找到 CSV 文件')
            }
        } else {
            ElMessage.error(res.error || '扫描失败')
        }
    } catch (e: any) {
        ElMessage.error('扫描 CSV 失败: ' + e.message)
    } finally {
        isScanning.value = false
    }
}

async function handlePreviewCsv() {
    if (!selectedCsvFile.value) {
        ElMessage.warning('请先选择一个 CSV 文件')
        return
    }
    try {
        const res: any = await importedContactsApi.previewCsv(selectedCsvFile.value)
        if (res.success && res.contacts) {
            csvPreview.value = res.contacts
            importStats.value = { total: res.total || 0, imported: res.imported || 0, skipped: res.skipped || 0 }
        } else {
            ElMessage.error(res.error || '预览失败')
        }
    } catch (e: any) {
        ElMessage.error('预览失败: ' + e.message)
    }
}

async function handleImportCsv() {
    if (!selectedCsvFile.value) {
        ElMessage.warning('请先选择一个 CSV 文件')
        return
    }
    if (csvPreview.value.length === 0) {
        ElMessage.warning('没有可导入的联系人，请先预览')
        return
    }
    isImporting.value = true
    try {
        const res: any = await importedContactsApi.importCsv(selectedCsvFile.value)
        if (res.success) {
            importedContacts.value = res.contacts || []
            ElMessage.success(`成功导入 ${res.imported || importedContacts.value.length} 条联系人`)
            importDialogVisible.value = false
        } else {
            ElMessage.error(res.error || '导入失败')
        }
    } catch (e: any) {
        ElMessage.error('导入失败: ' + e.message)
    } finally {
        isImporting.value = false
    }
}

async function loadImportedContacts() {
    try {
        const res: any = await importedContactsApi.getImported()
        if (res.success && res.contacts) {
            importedContacts.value = res.contacts
        }
    } catch (e) {
        console.error('加载导入联系人失败:', e)
    }
}

async function clearImportedContacts() {
    try {
        await ElMessageBox.confirm('确定要清除已导入的联系人吗？', '确认清除', {
            confirmButtonText: '清除',
            cancelButtonText: '取消',
            type: 'warning',
        })
        const res: any = await importedContactsApi.clearImported()
        if (res.success) {
            importedContacts.value = []
            ElMessage.success('已清除导入的联系人')
        }
    } catch (e: any) {
        if (e !== 'cancel') {
            ElMessage.error('清除失败: ' + e.message)
        }
    }
}

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
            existing.name = name.trim()
            existing.updatedAt = new Date().toISOString()
            existing.formData = exportCurrentForm()
            templateName.value = name.trim()
        } else {
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
    loadImportedContacts()
    loadTargetCounts()
    checkBroadcastStatus()
})

onDeactivated(() => {
    stopPolling()
})
</script>

<style scoped>
.broadcast {
    padding: 24px 28px;
    max-width: 1200px;
    margin: 0 auto;
}

.row-gap {
    margin-bottom: 20px;
}

.broadcast :deep(.el-card) {
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: 16px;
    box-shadow: var(--shadow-md);
    transition: box-shadow 0.2s ease;
    height: 100%;
}

.broadcast :deep(.el-card:hover) {
    box-shadow: var(--shadow-lg);
}

.broadcast :deep(.el-card__header) {
    border-bottom-color: var(--border-default);
    padding: 16px 24px;
}

.broadcast :deep(.el-card__body) {
    padding: 20px 24px;
}

.card-header {
    font-weight: bold;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.hint-icon {
    color: var(--text-muted);
    cursor: help;
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
  padding: 12px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 12px;
}

.template-selector-label {
    font-size: 13px;
    color: var(--text-secondary);
    white-space: nowrap;
}

.template-name-tag {
    margin-bottom: 12px;
}

.empty-state-small {
    text-align: center;
    padding: 30px;
    color: var(--text-muted);
    font-size: 13px;
}

/* 发送控制卡片 */
.control-card :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
}

.control-actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 20px;
}

.control-btn {
    width: 100%;
    height: 48px;
    font-size: 16px;
    border-radius: 12px;
}

.control-btn .el-icon {
    margin-right: 8px;
    font-size: 18px;
}

.start-btn {
    background: linear-gradient(135deg, var(--accent) 0%, var(--accent-light) 100%);
    border: none;
}

.stop-btn {
    border-radius: 12px;
}

.quick-stats {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 16px;
    border-top: 1px solid var(--border-default);
}

.quick-stat-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.quick-stat-label {
    font-size: 13px;
    color: var(--text-secondary);
}

.quick-stat-value {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
}

/* 进度卡片 */
.progress-section {
    padding: 10px 0;
}

.progress-info {
    margin-top: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.progress-info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--bg-secondary);
    border-radius: 10px;
}

.progress-info-label {
    font-size: 13px;
    color: var(--text-secondary);
}

.progress-info-value {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
}

/* 结果卡片 */
.results-list {
    max-height: 320px;
    overflow-y: auto;
}

.result-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-default);
  transition: background 0.2s ease;
}

.result-item:hover {
    background: var(--bg-secondary);
    border-radius: 8px;
}

.result-name {
    font-size: 14px;
    color: var(--text-primary);
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 30px;
  color: var(--text-muted);
}

.empty-state .empty-icon {
    margin-bottom: 12px;
    color: var(--border-hover);
}

.empty-state p {
    margin: 0;
    font-size: 14px;
}

/* 功能设置 - 分组标题 */
.feature-toggles {
    padding: 4px 0;
}

.feature-group-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
    padding-left: 4px;
}

.feature-toggles :deep(.el-form-item) {
    margin-bottom: 8px;
}

.feature-toggles :deep(.el-checkbox__label) {
	font-size: 13px;
	color: var(--text-primary);
}

/* 导入联系人信息 */
.imported-contacts-info {
	display: flex;
	align-items: center;
	gap: 8px;
	flex-wrap: wrap;
}

/* 导入弹窗 */
.import-dialog-content {
	padding: 8px 0;
}

.import-section {
	margin-bottom: 16px;
}

.section-label {
	font-size: 14px;
	font-weight: 600;
	color: var(--text-primary);
	margin-bottom: 8px;
}

.no-files-hint {
	margin-top: 8px;
	padding: 12px;
	background: var(--bg-secondary);
	border-radius: 8px;
	color: var(--text-muted);
	font-size: 13px;
	text-align: center;
}

.preview-section {
	margin-top: 16px;
	padding-top: 16px;
	border-top: 1px solid var(--border-default);
}

.preview-more {
	text-align: center;
	padding: 8px;
	color: var(--text-muted);
	font-size: 13px;
}
</style>
