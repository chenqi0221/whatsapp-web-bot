<template>
  <div class="imported-contacts-page">
    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-item">
            <el-icon class="stat-icon total"><UserFilled /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ stats.total }}</div>
              <div class="stat-label">全部导入</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-item">
            <el-icon class="stat-icon has-whatsapp"><CircleCheck /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ stats.hasWhatsApp }}</div>
              <div class="stat-label">有 WhatsApp</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-item">
            <el-icon class="stat-icon no-whatsapp"><CircleClose /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ stats.noWhatsApp }}</div>
              <div class="stat-label">无 WhatsApp</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-item">
            <el-icon class="stat-icon unchecked"><QuestionFilled /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ stats.unchecked }}</div>
              <div class="stat-label">待检查</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 操作栏 -->
    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>导入联系人管理</span>
              <div class="header-actions">
                <el-button type="primary" size="small" @click="openImportDialog">
                  <el-icon><Upload /></el-icon>
                  导入 CSV
                </el-button>
                <el-button
                  type="warning"
                  size="small"
                  :loading="isChecking"
                  :disabled="contacts.length === 0"
                  @click="checkAllWhatsApp"
                >
                  <el-icon><Check /></el-icon>
                  检查 WhatsApp
                </el-button>
                <el-button
                  type="danger"
                  size="small"
                  :disabled="contacts.length === 0"
                  @click="clearAll"
                >
                  <el-icon><Delete /></el-icon>
                  清空
                </el-button>
                <el-button type="success" size="small" @click="exportContacts">
                  <el-icon><Download /></el-icon>
                  导出
                </el-button>
              </div>
            </div>
          </template>

          <!-- 筛选 -->
          <div class="filter-bar">
            <el-radio-group v-model="filterStatus" size="small">
              <el-radio-button label="all">全部</el-radio-button>
              <el-radio-button label="has">有 WhatsApp</el-radio-button>
              <el-radio-button label="no">无 WhatsApp</el-radio-button>
              <el-radio-button label="unchecked">待检查</el-radio-button>
            </el-radio-group>
            <el-input
              v-model="searchQuery"
              placeholder="搜索名称或号码"
              size="small"
              style="width: 200px"
              clearable
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
          </div>

          <!-- 表格 -->
          <el-table
            :data="paginatedContacts"
            style="width: 100%; margin-top: 16px"
            v-loading="loading"
            stripe
          >
            <el-table-column type="index" width="60" />
            <el-table-column prop="name" label="联系人名称" min-width="150">
              <template #default="{ row }">
                <div class="contact-name-cell">
                  <el-avatar :size="28" :icon="UserFilled" class="name-avatar" />
                  <span>{{ row.name || '-' }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="phone" label="电话号码" min-width="140" />
            <el-table-column prop="source" label="来源文件" min-width="140">
              <template #default="{ row }">
                <el-tag size="small" type="info">{{ row.source }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="WhatsApp 状态" width="140" align="center">
              <template #default="{ row }">
                <el-tag
                  v-if="row.whatsappStatus === 'yes'"
                  type="success"
                  size="small"
                  effect="dark"
                >
                  <el-icon><Check /></el-icon>
                  有 WhatsApp
                </el-tag>
                <el-tag
                  v-else-if="row.whatsappStatus === 'no'"
                  type="danger"
                  size="small"
                  effect="dark"
                >
                  <el-icon><Close /></el-icon>
                  无 WhatsApp
                </el-tag>
                <el-tag
                  v-else
                  type="info"
                  size="small"
                >
                  待检查
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="检查时间" width="160">
              <template #default="{ row }">
                <span v-if="row.checkedAt" class="time-text">
                  {{ formatTime(row.checkedAt) }}
                </span>
                <span v-else class="time-text empty">-</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120" align="center">
              <template #default="{ row, $index }">
                <el-button
                  size="small"
                  type="primary"
                  link
                  :loading="row.checking"
                  @click="checkSingleWhatsApp(row, $index)"
                >
                  检查
                </el-button>
                <el-button
                  size="small"
                  type="danger"
                  link
                  @click="deleteContact($index)"
                >
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <!-- 分页 -->
          <div class="pagination" v-if="filteredContacts.length > 0">
            <el-pagination
              v-model:current-page="currentPage"
              :page-size="pageSize"
              :total="filteredContacts.length"
              layout="total, prev, pager, next"
            />
          </div>

          <div v-if="contacts.length === 0" class="empty-state">
            <el-icon :size="48" class="empty-icon"><Document /></el-icon>
            <p>暂无导入的联系人</p>
            <el-button type="primary" size="small" @click="openImportDialog" style="margin-top: 12px">
              导入 CSV
            </el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 导入弹窗 -->
    <el-dialog
      v-model="importDialogVisible"
      title="导入联系人"
      width="600px"
      :close-on-click-modal="false"
    >
      <div class="import-dialog-content">
        <div class="import-section">
          <div class="section-label">
            选择 CSV 文件
            <el-button
              type="primary"
              size="small"
              link
              @click="openFilePicker"
              style="margin-left: 8px"
            >
              <el-icon><FolderOpened /></el-icon>
              手动选择
            </el-button>
          </div>
          <el-select
            v-model="selectedCsvFile"
            placeholder="请选择 CSV 文件"
            style="width: 100%"
            :loading="isScanning"
          >
            <el-option
              v-for="file in csvFiles"
              :key="file.path"
              :label="file.name"
              :value="file.path"
            />
          </el-select>
          <div v-if="csvFiles.length === 0 && !isScanning" class="no-files-hint">
            <p>未在根目录找到 CSV 文件</p>
            <el-button type="primary" size="small" @click="openFilePicker" style="margin-top: 8px">
              <el-icon><FolderOpened /></el-icon>
              手动选择文件
            </el-button>
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
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  UserFilled,
  CircleCheck,
  CircleClose,
  QuestionFilled,
  Upload,
  Check,
  Delete,
  Download,
  Search,
  Close,
  Document,
  FolderOpened,
} from '@element-plus/icons-vue'
import { open } from '@tauri-apps/api/dialog'
import { importedContactsApi } from '@/api/tauri'
import type { ImportedContact } from '@/api/tauri'

defineOptions({ name: 'ImportedContacts' })

interface ContactWithStatus extends ImportedContact {
  whatsappStatus?: 'yes' | 'no' | null
  checkedAt?: string
  checking?: boolean
}

const contacts = ref<ContactWithStatus[]>([])
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(50)
const filterStatus = ref('all')
const searchQuery = ref('')
const isChecking = ref(false)

// 导入弹窗
const importDialogVisible = ref(false)
const csvFiles = ref<{ name: string; path: string }[]>([])
const selectedCsvFile = ref('')
const csvPreview = ref<ImportedContact[]>([])
const isImporting = ref(false)
const isScanning = ref(false)
const importStats = ref({ total: 0, imported: 0, skipped: 0 })

const stats = computed(() => {
  const total = contacts.value.length
  const hasWhatsApp = contacts.value.filter((c) => c.whatsappStatus === 'yes').length
  const noWhatsApp = contacts.value.filter((c) => c.whatsappStatus === 'no').length
  const unchecked = contacts.value.filter((c) => !c.whatsappStatus).length
  return { total, hasWhatsApp, noWhatsApp, unchecked }
})

const filteredContacts = computed(() => {
  let result = [...contacts.value]

  if (filterStatus.value === 'has') {
    result = result.filter((c) => c.whatsappStatus === 'yes')
  } else if (filterStatus.value === 'no') {
    result = result.filter((c) => c.whatsappStatus === 'no')
  } else if (filterStatus.value === 'unchecked') {
    result = result.filter((c) => !c.whatsappStatus)
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(
      (c) =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q))
    )
  }

  return result
})

const paginatedContacts = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredContacts.value.slice(start, start + pageSize.value)
})

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ===================== 加载数据 =====================

async function loadContacts() {
  loading.value = true
  try {
    const res: any = await importedContactsApi.getImported()
    if (res.success && res.contacts) {
      contacts.value = res.contacts.map((c: ImportedContact) => ({
        ...c,
        whatsappStatus: c.whatsappStatus || null,
        checkedAt: c.checkedAt || null,
        checking: false,
      }))
    }
  } catch (e: any) {
    ElMessage.error('加载导入联系人失败: ' + e.message)
  } finally {
    loading.value = false
  }
}

// ===================== 导入弹窗 =====================

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
      // 根目录没有 CSV 文件，自动打开文件选择器
      if (res.files.length === 0) {
        isScanning.value = false
        importDialogVisible.value = false
        await openFilePicker()
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

async function openFilePicker() {
  try {
    const selected = await open({
      multiple: false,
      filters: [
        { name: 'CSV 文件', extensions: ['csv'] },
        { name: '所有文件', extensions: ['*'] },
      ],
      title: '选择 CSV 文件',
    })
    if (selected && typeof selected === 'string') {
      selectedCsvFile.value = selected
      // 自动预览
      await handlePreviewCsv()
      // 如果预览成功且数据有效，自动打开导入弹窗显示预览
      if (csvPreview.value.length > 0) {
        importDialogVisible.value = true
      }
    }
  } catch (e: any) {
    ElMessage.error('打开文件选择器失败: ' + e.message)
  }
}

async function handlePreviewCsv() {
  if (!selectedCsvFile.value) {
    ElMessage.warning('请先选择一个 CSV 文件')
    return
  }
  try {
    const res: any = await importedContactsApi.previewCsv(selectedCsvFile.value)
    if (res.success && res.preview) {
      csvPreview.value = res.preview
      importStats.value = {
        total: res.total || 0,
        imported: res.preview.length,
        skipped: (res.total || 0) - res.preview.length,
      }
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
      await loadContacts()
      ElMessage.success(`成功导入 ${res.count || 0} 条联系人`)
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

// ===================== 删除 =====================

async function deleteContact(index: number) {
  const realIndex = (currentPage.value - 1) * pageSize.value + index
  const contact = contacts.value[realIndex]
  if (!contact) return

  try {
    await ElMessageBox.confirm(`确定删除「${contact.name || contact.phone}」吗？`, '确认删除', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    contacts.value.splice(realIndex, 1)
    // 更新后端
    await importedContactsApi.importContent(
      contactsToCsv(contacts.value),
      'imported-contacts.csv'
    )
    ElMessage.success('已删除')
  } catch (e: any) {
    if (e !== 'cancel') {
      ElMessage.error('删除失败: ' + e.message)
    }
  }
}

async function clearAll() {
  try {
    await ElMessageBox.confirm('确定要清空所有导入的联系人吗？', '确认清空', {
      confirmButtonText: '清空',
      cancelButtonText: '取消',
      type: 'warning',
    })
    const res: any = await importedContactsApi.clearImported()
    if (res.success) {
      contacts.value = []
      ElMessage.success('已清空')
    }
  } catch (e: any) {
    if (e !== 'cancel') {
      ElMessage.error('清空失败: ' + e.message)
    }
  }
}

// ===================== 检查 WhatsApp =====================

async function checkSingleWhatsApp(row: ContactWithStatus, index: number) {
  const realIndex = (currentPage.value - 1) * pageSize.value + index
  const contact = contacts.value[realIndex]
  if (!contact) return

  contact.checking = true
  try {
    const res: any = await importedContactsApi.checkWhatsApp(contact.phone)
    if (res.success) {
      contact.whatsappStatus = res.hasWhatsApp ? 'yes' : 'no'
      contact.checkedAt = new Date().toISOString()
      ElMessage.success(
        `${contact.name || contact.phone} ${res.hasWhatsApp ? '有' : '无'} WhatsApp`
      )
    } else {
      ElMessage.error(res.error || '检查失败')
    }
  } catch (e: any) {
    ElMessage.error('检查失败: ' + e.message)
  } finally {
    contact.checking = false
  }
}

async function checkAllWhatsApp() {
  const unchecked = contacts.value.filter((c) => !c.whatsappStatus)
  if (unchecked.length === 0) {
    ElMessage.info('所有联系人都已检查')
    return
  }

  isChecking.value = true
  let checked = 0
  let hasCount = 0

  for (const contact of unchecked) {
    contact.checking = true
    try {
      const res: any = await importedContactsApi.checkWhatsApp(contact.phone)
      if (res.success) {
        contact.whatsappStatus = res.hasWhatsApp ? 'yes' : 'no'
        contact.checkedAt = new Date().toISOString()
        if (res.hasWhatsApp) hasCount++
      }
    } catch (e) {
      console.error('Check error:', e)
    } finally {
      contact.checking = false
      checked++
    }

    // 每检查5个暂停一下，避免请求过快
    if (checked % 5 === 0) {
      await new Promise((r) => setTimeout(r, 1000))
    }
  }

  isChecking.value = false
  ElMessage.success(`检查完成: ${hasCount}/${checked} 有 WhatsApp`)
}

// ===================== 导出 =====================

function contactsToCsv(list: ContactWithStatus[]) {
  const headers = ['Name', 'Phone', 'Source', 'WhatsAppStatus', 'CheckedAt']
  const rows = list.map((c) => [
    c.name || '',
    c.phone || '',
    c.source || '',
    c.whatsappStatus || '',
    c.checkedAt || '',
  ])
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
}

function exportContacts() {
  if (contacts.value.length === 0) {
    ElMessage.warning('没有可导出的联系人')
    return
  }
  const csv = contactsToCsv(contacts.value)
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `imported-contacts-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('导出成功')
}

onMounted(() => {
  loadContacts()
})
</script>

<style scoped>
.imported-contacts-page {
  padding: 24px 28px;
  max-width: 1200px;
  margin: 0 auto;
}

.imported-contacts-page :deep(.el-card) {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  box-shadow: var(--shadow-md);
  transition: box-shadow 0.2s ease;
}

.imported-contacts-page :deep(.el-card:hover) {
  box-shadow: var(--shadow-lg);
}

.imported-contacts-page :deep(.el-card__header) {
  border-bottom-color: var(--border-default);
  padding: 16px 24px;
}

.imported-contacts-page :deep(.el-card__body) {
  padding: 20px 24px;
}

.stats-row {
  margin-bottom: 20px;
}

.stat-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
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
  border-radius: 12px;
}

.stat-icon.total {
  background: var(--accent-faint);
  color: var(--accent);
}

.stat-icon.has-whatsapp {
  background: rgba(16, 185, 129, 0.12);
  color: var(--success);
}

.stat-icon.no-whatsapp {
  background: rgba(239, 68, 68, 0.12);
  color: var(--danger);
}

.stat-icon.unchecked {
  background: var(--bg-secondary);
  color: var(--text-muted);
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: var(--text-primary);
}

.stat-label {
  font-size: 14px;
  color: var(--text-secondary);
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

.filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.contact-name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.name-avatar {
  background: var(--accent-faint);
  color: var(--accent);
}

.time-text {
  font-size: 13px;
  color: var(--text-secondary);
}

.time-text.empty {
  color: var(--text-muted);
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}

.empty-state {
  text-align: center;
  padding: 40px;
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
