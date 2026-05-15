<template>
  <div class="account-manage">
    <div class="page-header">
      <h1>账号管理</h1>
      <div class="header-actions">
        <div class="search-box">
          <input
            v-model="store.searchQuery"
            type="text"
            placeholder="搜索账号名称、手机号..."
            @input="debouncedSearch"
          />
          <span class="search-icon">🔍</span>
        </div>
        <button class="btn btn-primary" @click="showCreateDialog = true">+ 新建账号</button>
        <button class="btn btn-secondary" @click="refresh">刷新</button>
      </div>
    </div>

    <div class="stats-bar">
      <div class="stat-item">
        <span class="stat-value">{{ store.accounts.length }}</span>
        <span class="stat-label">总账号</span>
      </div>
      <div class="stat-item">
        <span class="stat-value online">{{ store.onlineCount }}</span>
        <span class="stat-label">在线</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">{{ store.accounts.length - store.onlineCount }}</span>
        <span class="stat-label">离线</span>
      </div>
    </div>

    <div v-if="store.loading" class="loading-overlay">
      <div class="spinner"></div>
    </div>

    <div v-if="store.error" class="error-banner">
      {{ store.error }}
      <button class="btn btn-sm" @click="store.error = null">✕</button>
    </div>

    <div v-if="selectedIds.length > 0" class="batch-bar">
      <span>已选 {{ selectedIds.length }} 个账号</span>
      <button class="btn btn-danger btn-sm" @click="confirmBatchDelete">批量删除</button>
      <button class="btn btn-sm" @click="selectedIds = []">取消选择</button>
    </div>

    <div v-if="store.filteredAccounts.length === 0 && !store.loading" class="empty-state">
      暂无账号，点击「新建账号」添加
    </div>

    <div class="account-list" v-else>
      <div
        v-for="account in store.filteredAccounts"
        :key="account.id"
        class="account-card"
        :class="{ selected: selectedIds.includes(account.id) }"
      >
        <div class="account-checkbox" @click="toggleSelect(account.id)">
          <span v-if="selectedIds.includes(account.id)">☑</span>
          <span v-else>☐</span>
        </div>

        <div class="account-main" @click="toggleExpand(account.id)">
          <div class="account-avatar" :class="account.status">
            {{ account.name.charAt(0).toUpperCase() }}
          </div>
          <div class="account-info">
            <div class="account-name">
              {{ account.name }}
              <span class="status-badge" :class="account.status">
                {{ store.statusLabels[account.status] || account.status }}
              </span>
              <span class="level-badge" :class="account.level">
                {{ store.levelLabels[account.level] || account.level }}
              </span>
            </div>
            <div class="account-meta">
              <span v-if="account.phone">{{ account.phone }}</span>
              <span>今日 {{ account.dailySent }}/{{ account.dailyLimit }}</span>
              <span>累计 {{ account.totalSent }}</span>
            </div>
          </div>
          <div class="account-actions" @click.stop>
            <button class="btn btn-sm" @click="openEdit(account)">编辑</button>
            <button class="btn btn-sm btn-danger" @click="confirmDelete(account)">删除</button>
          </div>
        </div>

        <div v-if="expandedId === account.id" class="account-detail">
          <div class="detail-grid">
            <div class="detail-item">
              <label>账号ID</label>
              <span>{{ account.id }}</span>
            </div>
            <div class="detail-item">
              <label>手机号</label>
              <span>{{ account.phone || '未绑定' }}</span>
            </div>
            <div class="detail-item">
              <label>等级</label>
              <span>{{ store.levelLabels[account.level] || account.level }}</span>
            </div>
            <div class="detail-item">
              <label>状态</label>
              <span>{{ store.statusLabels[account.status] || account.status }}</span>
            </div>
            <div class="detail-item">
              <label>今日已发</label>
              <span class="highlight">{{ account.dailySent }} / {{ account.dailyLimit }}</span>
            </div>
            <div class="detail-item">
              <label>累计发送</label>
              <span>{{ account.totalSent }}</span>
            </div>
            <div class="detail-item">
              <label>累计失败</label>
              <span>{{ account.totalFailed || 0 }}</span>
            </div>
            <div class="detail-item">
              <label>最后活跃</label>
              <span>{{ account.lastActive ? formatTime(account.lastActive) : '-' }}</span>
            </div>
          </div>

          <div class="detail-section" v-if="detailHistory.length > 0">
            <h4>最近操作记录</h4>
            <div class="history-list">
              <div v-for="h in detailHistory" :key="h.id" class="history-item">
                <span class="history-action">{{ h.action }}</span>
                <span class="history-detail" v-if="h.detail">{{ h.detail }}</span>
                <span class="history-time">{{ formatTime(h.created_at) }}</span>
              </div>
            </div>
          </div>

          <div class="detail-section">
            <h4>今日进度</h4>
            <div class="progress-bar">
              <div
                class="progress-fill"
                :style="{ width: Math.min(100, (account.dailySent / Math.max(1, account.dailyLimit)) * 100) + '%' }"
                :class="{ warning: account.dailySent > account.dailyLimit * 0.8 }"
              ></div>
              <span class="progress-text">{{ account.dailySent }} / {{ account.dailyLimit }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showCreateDialog" class="dialog-overlay" @click.self="showCreateDialog = false">
      <div class="dialog">
        <h3>新建账号</h3>
        <div class="form-group">
          <label>账号名称 *</label>
          <input v-model="createForm.name" placeholder="输入账号名称" />
        </div>
        <div class="form-group">
          <label>手机号</label>
          <input v-model="createForm.phone" placeholder="选填" />
        </div>
        <div class="dialog-actions">
          <button class="btn btn-secondary" @click="showCreateDialog = false">取消</button>
          <button class="btn btn-primary" @click="handleCreate" :disabled="!createForm.name">创建</button>
        </div>
      </div>
    </div>

    <div v-if="showEditDialog" class="dialog-overlay" @click.self="showEditDialog = false">
      <div class="dialog">
        <h3>编辑账号</h3>
        <div class="form-group">
          <label>账号名称</label>
          <input v-model="editForm.name" placeholder="输入账号名称" />
        </div>
        <div class="form-group">
          <label>手机号</label>
          <input v-model="editForm.phone" placeholder="手机号" />
        </div>
        <div class="form-group">
          <label>账号等级</label>
          <select v-model="editForm.level">
            <option value="NEW_ACCOUNT">新号 (30条/天)</option>
            <option value="ESTABLISHED_ACCOUNT">稳定号 (80条/天)</option>
            <option value="MATURE_ACCOUNT">成熟号 (150条/天)</option>
          </select>
        </div>
        <div class="dialog-actions">
          <button class="btn btn-secondary" @click="showEditDialog = false">取消</button>
          <button class="btn btn-primary" @click="handleEdit" :disabled="!editForm.name">保存</button>
        </div>
      </div>
    </div>

    <div v-if="showDeleteConfirm" class="dialog-overlay" @click.self="showDeleteConfirm = false">
      <div class="dialog dialog-sm">
        <h3>确认删除</h3>
        <p>确定要删除账号「{{ deleteTarget?.name }}」吗？此操作不可撤销。</p>
        <div class="dialog-actions">
          <button class="btn btn-secondary" @click="showDeleteConfirm = false">取消</button>
          <button class="btn btn-danger" @click="handleDelete">确认删除</button>
        </div>
      </div>
    </div>

    <div v-if="showBatchDeleteConfirm" class="dialog-overlay" @click.self="showBatchDeleteConfirm = false">
      <div class="dialog dialog-sm">
        <h3>批量删除确认</h3>
        <p>确定要删除选中的 {{ selectedIds.length }} 个账号吗？此操作不可撤销。</p>
        <div class="dialog-actions">
          <button class="btn btn-secondary" @click="showBatchDeleteConfirm = false">取消</button>
          <button class="btn btn-danger" @click="handleBatchDelete">确认删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAccountsStore } from '@/stores/accounts'
import type { Account, LoginHistory } from '@/api/tauri'

const store = useAccountsStore()

const showCreateDialog = ref(false)
const showEditDialog = ref(false)
const showDeleteConfirm = ref(false)
const showBatchDeleteConfirm = ref(false)
const selectedIds = ref<string[]>([])
const expandedId = ref<string | null>(null)
const detailHistory = ref<LoginHistory[]>([])
const deleteTarget = ref<Account | null>(null)

const createForm = ref({ name: '', phone: '' })
const editForm = ref({ name: '', phone: '', level: '', id: '' })

let searchTimer: ReturnType<typeof setTimeout> | null = null

function debouncedSearch(e: Event) {
    const target = e.target as HTMLInputElement
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
        store.searchQuery = target.value
    }, 300)
}

async function refresh() {
    await store.fetchAccounts()
}

function toggleSelect(id: string) {
    const idx = selectedIds.value.indexOf(id)
    if (idx !== -1) {
        selectedIds.value.splice(idx, 1)
    } else {
        selectedIds.value.push(id)
    }
}

async function toggleExpand(id: string) {
    if (expandedId.value === id) {
        expandedId.value = null
        detailHistory.value = []
        return
    }
    expandedId.value = id
    detailHistory.value = await store.fetchHistory(id, 10)
}

async function handleCreate() {
    const ok = await store.create(createForm.value.name.trim(), createForm.value.phone.trim() || undefined)
    if (ok) {
        showCreateDialog.value = false
        createForm.value = { name: '', phone: '' }
    }
}

function openEdit(account: Account) {
    editForm.value = {
        id: account.id,
        name: account.name,
        phone: account.phone || '',
        level: account.level,
    }
    showEditDialog.value = true
}

async function handleEdit() {
    const ok = await store.update(editForm.value.id, {
        name: editForm.value.name.trim(),
        phone: editForm.value.phone.trim() || undefined,
        level: editForm.value.level,
    })
    if (ok) {
        showEditDialog.value = false
    }
}

function confirmDelete(account: Account) {
    deleteTarget.value = account
    showDeleteConfirm.value = true
}

async function handleDelete() {
    if (!deleteTarget.value) return
    await store.remove(deleteTarget.value.id)
    showDeleteConfirm.value = false
    deleteTarget.value = null
}

function confirmBatchDelete() {
    showBatchDeleteConfirm.value = true
}

async function handleBatchDelete() {
    const ok = await store.batchRemove(selectedIds.value.slice())
    if (ok) {
        selectedIds.value = []
    }
    showBatchDeleteConfirm.value = false
}

function formatTime(s: string): string {
    if (!s) return '-'
    const d = new Date(s)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
    return d.toLocaleDateString('zh-CN') + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

onMounted(() => {
    store.fetchAccounts()
})
</script>

<style scoped>
.account-manage {
    padding: 24px 28px;
    height: 100%;
    overflow-y: auto;
    max-width: 1200px;
    margin: 0 auto;
}

.page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
}

.page-header h1 {
    font-size: 22px;
    font-weight: 700;
    color: var(--text-primary);
}

.header-actions {
    display: flex;
    gap: 10px;
    align-items: center;
}

.search-box {
    position: relative;
}

.search-box input {
    padding: 6px 32px 6px 12px;
    border: 1px solid var(--border-default);
    background: var(--bg-primary);
    color: var(--text-primary);
    border-radius: 6px;
    width: 220px;
    font-size: 13px;
}

.search-icon {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 14px;
}

.stats-bar {
    display: flex;
    gap: 20px;
    margin-bottom: 20px;
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: 16px;
    padding: 16px 24px;
    box-shadow: var(--shadow-md);
    transition: box-shadow 0.2s ease;
}

.stats-bar:hover {
    box-shadow: var(--shadow-lg);
}

.stat-item {
    display: flex;
    flex-direction: column;
}

.stat-value {
    font-size: 22px;
    font-weight: 700;
    color: var(--text-primary);
}

.stat-value.online {
    color: #10b981;
}

.stat-label {
    font-size: 12px;
    color: var(--text-muted);
}

.loading-overlay {
    display: flex;
    justify-content: center;
    padding: 40px;
}

.spinner {
    width: 36px;
    height: 36px;
    border: 3px solid #e0e0e0;
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.error-banner {
    background: rgba(239, 68, 68, 0.1);
    color: var(--danger);
    padding: 10px 16px;
    border-radius: 8px;
    margin-bottom: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
}

.batch-bar {
    background: var(--accent-faint);
    border: 1px solid var(--border-active);
    border-radius: 8px;
    padding: 10px 16px;
    margin-bottom: 14px;
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 13px;
    color: var(--text-primary);
}

.empty-state {
    text-align: center;
    padding: 60px;
    color: var(--text-muted);
    font-size: 15px;
}

.account-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.account-card {
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: 16px;
    overflow: hidden;
    box-shadow: var(--shadow-md);
    transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.15s;
}

.account-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
}

.account-card.selected {
    border-color: var(--accent);
    background: var(--accent-faint);
}

.account-main {
    display: flex;
    align-items: center;
    padding: 14px 16px;
    gap: 14px;
    cursor: pointer;
}

.account-checkbox {
    cursor: pointer;
    font-size: 18px;
    user-select: none;
    color: var(--text-muted);
    width: 24px;
    text-align: center;
}

.account-avatar {
    width: 42px;
    height: 42px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 16px;
    color: #fff;
    flex-shrink: 0;
}

.account-avatar.offline { background: #9ca3af; }
.account-avatar.qr { background: #f59e0b; }
.account-avatar.scanning { background: #f59e0b; }
.account-avatar.ready { background: #10b981; }
.account-avatar.error { background: #ef4444; }

.account-info {
    flex: 1;
    min-width: 0;
}

.account-name {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 8px;
}

.status-badge {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 10px;
    font-weight: 500;
}

.status-badge.offline { background: var(--bg-tertiary); color: var(--text-muted); }
.status-badge.ready { background: rgba(16, 185, 129, 0.15); color: var(--success); }
.status-badge.qr { background: rgba(245, 158, 11, 0.15); color: var(--warning); }
.status-badge.error { background: rgba(239, 68, 68, 0.15); color: var(--danger); }

.level-badge {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 8px;
}

.level-badge.NEW_ACCOUNT { background: rgba(245, 158, 11, 0.15); color: var(--warning); }
.level-badge.ESTABLISHED_ACCOUNT { background: var(--accent-faint); color: var(--accent); }
.level-badge.MATURE_ACCOUNT { background: rgba(16, 185, 129, 0.15); color: var(--success); }

.account-meta {
    font-size: 12px;
    color: var(--text-muted);
    display: flex;
    gap: 14px;
}

.account-actions {
    display: flex;
    gap: 6px;
}

.account-detail {
    border-top: 1px solid var(--border-default);
    padding: 16px 20px;
    background: var(--bg-secondary);
}

.detail-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
}

.detail-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.detail-item label {
    font-size: 11px;
    color: var(--text-muted);
}

.detail-item span {
    font-size: 13px;
    font-weight: 500;
}

.detail-item .highlight {
    color: #6366f1;
    font-weight: 600;
}

.detail-section {
    margin-top: 14px;
}

.detail-section h4 {
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--text-secondary);
}

.history-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 180px;
    overflow-y: auto;
}

.history-item {
    display: flex;
    gap: 12px;
    font-size: 12px;
    align-items: center;
}

.history-action {
    color: var(--accent);
    font-weight: 500;
    min-width: 50px;
}

.history-detail {
    color: var(--text-secondary);
    flex: 1;
}

.history-time {
    color: var(--text-muted);
    white-space: nowrap;
}

.progress-bar {
    height: 22px;
    background: var(--bg-tertiary);
    border-radius: 6px;
    overflow: hidden;
    position: relative;
}

.progress-fill {
    height: 100%;
    background: #6366f1;
    border-radius: 6px;
    transition: width 0.3s;
}

.progress-fill.warning {
    background: #f59e0b;
}

.progress-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
}

.dialog-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
}

.dialog {
    background: var(--card-bg);
    border-radius: 16px;
    padding: 24px;
    width: 420px;
    max-width: 90vw;
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--card-border);
}

.dialog-sm {
    width: 360px;
}

.dialog h3 {
    font-size: 17px;
    font-weight: 600;
    margin-bottom: 16px;
}

.dialog p {
    color: var(--text-secondary);
    margin-bottom: 16px;
    font-size: 14px;
}

.form-group {
    margin-bottom: 14px;
}

.form-group label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: 5px;
}

.form-group input,
.form-group select {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--border-default);
    background: var(--bg-primary);
    color: var(--text-primary);
    border-radius: 6px;
    font-size: 14px;
    box-sizing: border-box;
}

.dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 20px;
}

.btn {
    padding: 7px 16px;
    border-radius: 6px;
    border: 1px solid var(--border-default);
    background: var(--card-bg);
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
}

.btn-primary { background: #6366f1; color: #fff; border-color: #6366f1; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-secondary { background: var(--bg-secondary); color: var(--text-primary); }
.btn-danger { background: rgba(239, 68, 68, 0.15); color: var(--danger); border-color: rgba(239, 68, 68, 0.3); }
.btn-sm { padding: 4px 10px; font-size: 12px; }
</style>