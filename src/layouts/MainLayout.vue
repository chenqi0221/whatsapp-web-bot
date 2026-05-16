<template>
  <el-container class="main-layout">
    <el-aside :width="isCollapsed ? '64px' : '220px'" class="sidebar" :class="{ collapsed: isCollapsed }">
      <div class="logo">
        <div class="logo-brand">
          <div class="logo-icon">
            <el-icon :size="20"><ChatDotRound /></el-icon>
          </div>
          <span class="logo-text" :class="{ collapsed: isCollapsed }">WhatsApp Bot</span>
        </div>
        <button
          class="collapse-btn"
          @click="toggleCollapse"
          :title="isCollapsed ? '展开侧边栏' : '收起侧边栏'"
        >
          {{ '←' }}
        </button>
      </div>
      <el-menu
        :default-active="$route.path"
        :collapse="isCollapsed"
        :collapse-transition="false"
        router
        class="sidebar-menu"
      >
        <el-menu-item index="/">
          <el-icon><Monitor /></el-icon>
          <template #title>仪表盘</template>
        </el-menu-item>
        <el-menu-item index="/accounts">
          <el-icon><User /></el-icon>
          <template #title>账号管理</template>
        </el-menu-item>

        <el-sub-menu index="1">
          <template #title>
            <el-icon><Promotion /></el-icon>
            <span>消息功能</span>
          </template>
          <el-menu-item index="/broadcast">
            <el-icon><ChatLineRound /></el-icon>
            <template #title>群发消息</template>
          </el-menu-item>
          <el-menu-item index="/autoreply">
            <el-icon><ChatDotSquare /></el-icon>
            <template #title>自动回复</template>
          </el-menu-item>
          <el-menu-item index="/schedule">
            <el-icon><Timer /></el-icon>
            <template #title>定时任务</template>
          </el-menu-item>
          <el-menu-item index="/media">
            <el-icon><Picture /></el-icon>
            <template #title>发送媒体</template>
          </el-menu-item>
          <el-menu-item index="/messages">
            <el-icon><Message /></el-icon>
            <template #title>消息记录</template>
          </el-menu-item>
          <el-menu-item index="/search">
            <el-icon><Search /></el-icon>
            <template #title>搜索消息</template>
          </el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="2">
          <template #title>
            <el-icon><UserFilled /></el-icon>
            <span>联系人</span>
          </template>
          <el-menu-item index="/contacts">
            <el-icon><User /></el-icon>
            <template #title>联系人管理</template>
          </el-menu-item>
          <el-menu-item index="/groups">
            <el-icon><UserFilled /></el-icon>
            <template #title>群管理</template>
          </el-menu-item>
          <el-menu-item index="/chatmanage">
            <el-icon><ChatSquare /></el-icon>
            <template #title>聊天管理</template>
          </el-menu-item>
          <el-menu-item index="/contact-lookup">
            <el-icon><ZoomIn /></el-icon>
            <template #title>联系人查询</template>
          </el-menu-item>
          <el-menu-item index="/imported-contacts">
            <el-icon><Upload /></el-icon>
            <template #title>导入联系人</template>
          </el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="3">
          <template #title>
            <el-icon><DataLine /></el-icon>
            <span>数据</span>
          </template>
          <el-menu-item index="/stats">
            <el-icon><TrendCharts /></el-icon>
            <template #title>数据统计</template>
          </el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="4">
          <template #title>
            <el-icon><Tools /></el-icon>
            <span>设置</span>
          </template>
          <el-menu-item index="/profile">
            <el-icon><Avatar /></el-icon>
            <template #title>个人信息</template>
          </el-menu-item>
          <el-menu-item index="/settings">
            <el-icon><Setting /></el-icon>
            <template #title>系统设置</template>
          </el-menu-item>
        </el-sub-menu>
      </el-menu>
      <div class="sidebar-footer">
        <button
          class="theme-toggle-btn"
          @click="themeStore.toggleMode()"
          :title="themeStore.isDark ? '切换到浅色模式' : '切换到深色模式'"
        >
          <el-icon :size="16"><Sunny v-if="themeStore.isDark" /><Moon v-else /></el-icon>
          <span v-show="!isCollapsed" class="theme-toggle-text">
            {{ themeStore.isDark ? '浅色模式' : '深色模式' }}
          </span>
        </button>
      </div>
    </el-aside>
    <el-container class="right-container">
      <el-header class="header">
        <div class="header-right">
          <el-dropdown trigger="click" @command="handleThemeChange">
            <span class="theme-trigger">
              <span class="theme-dot" :class="'dot-' + themeStore.currentTheme"></span>
              <span class="theme-label">{{ themeStore.themeLabel }}</span>
              <el-icon class="arrow"><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="opt in themeStore.themeOptions"
                  :key="opt.value"
                  :command="opt.value"
                  :class="{ 'is-active': themeStore.currentTheme === opt.value }"
                >
                  <span class="theme-dot" :class="'dot-' + opt.value"></span>
                  {{ opt.label }}
                  <el-icon v-if="themeStore.currentTheme === opt.value" class="check"><Check /></el-icon>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-divider direction="vertical" />
          <div class="backend-status" :class="{ dead: backendDead }" @click="backendDead && handleRestartBackend()" :title="backendDead ? '点击重启后端服务' : '后端服务运行正常'">
            <span class="status-dot" :class="{ alive: !backendDead, dead: backendDead }"></span>
            <span class="status-text">{{ backendDead ? '后端已停止' : '后端正常' }}</span>
            <button
              v-if="backendDead"
              class="restart-btn"
              @click.stop="handleRestartBackend"
            >
              <el-icon :size="14"><Refresh /></el-icon>
              重启
            </button>
          </div>
          <el-divider direction="vertical" />
          <el-tag
            :type="connectionStatus.type"
            effect="plain"
            round
            size="small"
          >
            {{ connectionStatus.text }}
          </el-tag>
        </div>
      </el-header>
      <el-main class="main-content">
        <router-view v-slot="{ Component }">
          <keep-alive>
            <component :is="Component" />
          </keep-alive>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  Fold,
  Expand,
  Moon,
  Sunny,
  ArrowDown,
  Check,
  Upload,
  Refresh,
} from '@element-plus/icons-vue'
import { useWhatsAppStore } from '@/stores/whatsapp'
import { useThemeStore } from '@/stores/theme'
import { backendApi } from '@/api/tauri'

const store = useWhatsAppStore()
const themeStore = useThemeStore()

const isCollapsed = ref(false)
const backendDead = ref(false)
let healthTimer: ReturnType<typeof setInterval> | null = null

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value
}

function handleThemeChange(name: string) {
  themeStore.setTheme(name as any)
}

async function checkBackendHealth() {
  try {
    const result = await backendApi.checkHealth()
    console.log('[HealthCheck] result:', result)
    backendDead.value = result === 'dead'
  } catch (e) {
    console.error('[HealthCheck] error:', e)
    backendDead.value = true
  }
}

async function handleRestartBackend() {
  backendDead.value = true
  await backendApi.restart()
  // Wait and check again
  setTimeout(async () => {
    await checkBackendHealth()
  }, 3000)
}

const connectionStatus = computed(() => {
  switch (store.status) {
    case 'ready': return { type: 'success' as const, text: '已连接' }
    case 'qr': return { type: 'warning' as const, text: '等待扫码' }
    case 'authenticated': return { type: 'info' as const, text: '认证中' }
    case 'disconnected': return { type: 'danger' as const, text: '未连接' }
    default: return { type: 'info' as const, text: store.status }
  }
})

onMounted(() => {
  store.startPolling()
  checkBackendHealth()
  healthTimer = setInterval(checkBackendHealth, 5000)
})

onUnmounted(() => {
  store.stopPolling()
  if (healthTimer) {
    clearInterval(healthTimer)
    healthTimer = null
  }
})
</script>

<style scoped>
.main-layout {
  height: 100vh;
  overflow: hidden;
}

.sidebar {
  background: var(--sidebar-bg) !important;
  color: var(--sidebar-text);
  overflow: hidden;
  transition: width var(--transition-duration) ease;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
  z-index: 10;
}

.sidebar:deep(.el-aside) {
  background: var(--sidebar-bg) !important;
}

.logo {
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--header-height);
  border-bottom: 1px solid var(--sidebar-divider);
  flex-shrink: 0;
  overflow: hidden;
}

.logo-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  overflow: hidden;
  min-width: 0;
}

.logo-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  background: linear-gradient(135deg, var(--accent), var(--accent-dark));
  color: #fff;
  flex-shrink: 0;
}

.logo-text {
  font-family: var(--font-heading);
  font-size: 16px;
  font-weight: 700;
  color: var(--sidebar-text-active);
  letter-spacing: -0.02em;
  white-space: nowrap;
  overflow: hidden;
  transition: opacity 0.2s ease, width 0.2s ease;
}

.sidebar.collapsed .logo-text {
  opacity: 0;
  width: 0;
}

.sidebar.collapsed .logo {
  justify-content: center;
  padding: 16px 0;
}

.sidebar.collapsed .logo-brand {
  display: none;
}

.sidebar-menu {
  border-right: none;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.sidebar-menu:deep(.el-menu) {
  background: transparent;
  border-right: none;
  --el-menu-text-color: var(--sidebar-text);
  --el-menu-hover-text-color: var(--sidebar-text-active);
  --el-menu-active-color: var(--sidebar-text-active);
  --el-menu-bg-color: transparent;
  --el-menu-hover-bg-color: var(--sidebar-hover);
}

.sidebar-menu:deep(.el-menu-item),
.sidebar-menu:deep(.el-sub-menu__title) {
  color: var(--sidebar-text) !important;
  transition: all 0.2s ease;
  margin: 2px 8px;
  border-radius: var(--radius-sm);
  position: relative;
  overflow: hidden;
}

/* 左侧亮条伪元素 */
.sidebar-menu:deep(.el-menu-item)::before,
.sidebar-menu:deep(.el-sub-menu__title)::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%) scaleY(0);
  width: 3px;
  height: 60%;
  background: linear-gradient(180deg, var(--accent), transparent);
  border-radius: 0 2px 2px 0;
  transition: transform 0.25s ease;
}

.sidebar-menu:deep(.el-menu-item:hover),
.sidebar-menu:deep(.el-sub-menu__title:hover) {
  background: var(--sidebar-hover);
  color: var(--sidebar-text-active) !important;
}

.sidebar-menu:deep(.el-menu-item.is-active) {
  background: var(--sidebar-active);
  color: var(--sidebar-text-active) !important;
  border-radius: var(--radius-sm);
}

.sidebar-menu:deep(.el-menu-item.is-active)::before {
  transform: translateY(-50%) scaleY(1);
}

.sidebar-menu:deep(.el-sub-menu.is-active .el-sub-menu__title) {
  color: var(--sidebar-text-active) !important;
}

.sidebar-menu:deep(.el-sub-menu.is-active .el-sub-menu__title)::before {
  transform: translateY(-50%) scaleY(1);
}

.sidebar-menu:deep(.el-menu--collapse) {
  width: 64px;
}

.sidebar-menu:deep(.el-menu--collapse .el-sub-menu__title) {
  padding-right: 0;
}

.sidebar-footer {
  padding: 0.75rem;
  border-top: 1px solid var(--sidebar-divider);
  flex-shrink: 0;
}

.theme-toggle-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-default);
  background: var(--bg-secondary);
  color: var(--sidebar-text);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.theme-toggle-btn:hover {
  border-color: var(--border-active);
  background: var(--sidebar-active);
  color: var(--sidebar-text-active);
}

.theme-toggle-text {
  font-weight: 500;
}

.right-container {
  flex-direction: column;
  min-width: 0;
}

.collapse-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--sidebar-text);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease, transform 0.3s ease;
  flex-shrink: 0;
}

.collapse-btn:hover {
  border-color: var(--accent);
  background: var(--accent-faint);
  color: var(--accent);
}

.sidebar.collapsed .collapse-btn {
  transform: rotate(180deg);
}

.header {
  background: var(--header-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--header-border);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 20px;
  height: var(--header-height);
  flex-shrink: 0;
  z-index: 5;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.theme-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 13px;
  transition: all 0.2s;
  user-select: none;
}

.theme-trigger:hover {
  background: var(--accent-faint);
  color: var(--accent);
}

.theme-label {
  font-weight: 500;
}

.arrow {
  font-size: 12px;
  transition: transform 0.2s;
}

.backend-status {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  transition: all 0.2s;
  user-select: none;
}

.backend-status.dead {
  cursor: pointer;
  background: rgba(239, 68, 68, 0.08);
  color: #ef4444;
}

.backend-status.dead:hover {
  background: rgba(239, 68, 68, 0.15);
}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  transition: all 0.3s;
}

.status-dot.alive {
  background: #22c55e;
  box-shadow: 0 0 6px rgba(34, 197, 94, 0.5);
}

.status-dot.dead {
  background: #ef4444;
  box-shadow: 0 0 6px rgba(239, 68, 68, 0.5);
  animation: pulse-dead 2s infinite;
}

@keyframes pulse-dead {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.status-text {
  white-space: nowrap;
}

.restart-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid #ef4444;
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.restart-btn:hover {
  background: #ef4444;
  color: #fff;
}

.theme-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 8px;
  flex-shrink: 0;
}

.dot-default { background: #2563eb; }
.dot-purple { background: #7c3aed; }
.dot-green { background: #059669; }
.dot-orange { background: #ea580c; }

.check {
  margin-left: auto;
  color: var(--accent);
}

.main-content {
  background: var(--content-bg);
  padding: 20px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}
</style>