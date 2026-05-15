<template>
  <el-container class="main-layout">
    <el-aside :width="isCollapsed ? '64px' : '220px'" class="sidebar">
      <div class="logo">
        <div class="logo-icon">
          <el-icon :size="20"><ChatDotRound /></el-icon>
        </div>
        <span v-show="!isCollapsed" class="logo-text">WhatsApp Bot</span>
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
    </el-aside>
    <el-container class="right-container">
      <el-header class="header">
        <div class="header-left">
          <el-button
            class="collapse-btn"
            :icon="isCollapsed ? Expand : Fold"
            text
            @click="toggleCollapse"
          />
        </div>
        <div class="header-right">
          <el-dropdown trigger="click" @command="handleThemeChange">
            <span class="theme-trigger">
              <el-icon><Brush /></el-icon>
              <span class="theme-label">{{ themeStore.themeLabel }}</span>
              <el-icon class="arrow"><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="opt in themeStore.themeOptions"
                  :key="opt.value"
                  :command="opt.value"
                  :class="{ 'is-active': themeStore.current === opt.value }"
                >
                  <span class="theme-dot" :class="'dot-' + opt.value"></span>
                  {{ opt.label }}
                  <el-icon v-if="themeStore.current === opt.value" class="check"><Check /></el-icon>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
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
  Brush,
  ArrowDown,
  Check
} from '@element-plus/icons-vue'
import { useWhatsAppStore } from '@/stores/whatsapp'
import { useThemeStore } from '@/stores/theme'

const store = useWhatsAppStore()
const themeStore = useThemeStore()

const isCollapsed = ref(false)

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value
}

function handleThemeChange(name: string) {
  themeStore.setTheme(name as any)
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
})

onUnmounted(() => {
  store.stopPolling()
})
</script>

<style scoped>
.main-layout {
  height: 100vh;
  overflow: hidden;
}

.sidebar {
  background: linear-gradient(180deg, var(--sidebar-bg) 0%, var(--sidebar-bg-end) 100%);
  color: #fff;
  overflow: hidden;
  transition: width var(--transition-duration) ease;
  display: flex;
  flex-direction: column;
  box-shadow: 2px 0 24px rgba(0, 0, 0, 0.15);
  z-index: 10;
}

.logo {
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  height: var(--header-height);
  border-bottom: 1px solid var(--sidebar-divider);
  flex-shrink: 0;
  overflow: hidden;
  white-space: nowrap;
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
}

.sidebar-menu:deep(.el-menu-item),
.sidebar-menu:deep(.el-sub-menu__title) {
  color: var(--sidebar-text);
  transition: all 0.2s ease;
  margin: 2px 8px;
  border-radius: var(--radius-sm);
}

.sidebar-menu:deep(.el-menu-item:hover),
.sidebar-menu:deep(.el-sub-menu__title:hover) {
  background: var(--sidebar-hover);
  color: var(--sidebar-text-active);
}

.sidebar-menu:deep(.el-menu-item.is-active) {
  background: var(--sidebar-active);
  color: var(--sidebar-text-active);
  border-radius: var(--radius-sm);
}

.sidebar-menu:deep(.el-menu--collapse) {
  width: 64px;
}

.sidebar-menu:deep(.el-menu--collapse .el-sub-menu__title) {
  padding-right: 0;
}

.right-container {
  flex-direction: column;
  min-width: 0;
}

.header {
  background: var(--header-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--header-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  height: var(--header-height);
  flex-shrink: 0;
  z-index: 5;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.collapse-btn {
  font-size: 20px;
  color: var(--text-secondary);
  transition: color 0.2s;
}

.collapse-btn:hover {
  color: var(--accent);
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