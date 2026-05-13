<template>
  <el-container class="main-layout">
    <el-aside width="220px" class="sidebar">
      <div class="logo">
        <el-icon><ChatDotRound /></el-icon>
        <span>WhatsApp Bot</span>
      </div>
      <el-menu
        :default-active="$route.path"
        router
        class="sidebar-menu"
        background-color="#1a1a2e"
        text-color="#fff"
        active-text-color="#409EFF"
      >
        <el-menu-item index="/">
          <el-icon><HomeFilled /></el-icon>
          <span>控制台</span>
        </el-menu-item>

        <el-sub-menu index="1">
          <template #title>
            <el-icon><Promotion /></el-icon>
            <span>消息功能</span>
          </template>
          <el-menu-item index="/broadcast">
            <el-icon><ChatLineRound /></el-icon>
            <span>群发消息</span>
          </el-menu-item>
          <el-menu-item index="/autoreply">
            <el-icon><ChatDotSquare /></el-icon>
            <span>自动回复</span>
          </el-menu-item>
          <el-menu-item index="/schedule">
            <el-icon><Timer /></el-icon>
            <span>定时任务</span>
          </el-menu-item>
          <el-menu-item index="/media">
            <el-icon><Picture /></el-icon>
            <span>发送媒体</span>
          </el-menu-item>
          <el-menu-item index="/messages">
            <el-icon><Message /></el-icon>
            <span>消息记录</span>
          </el-menu-item>
          <el-menu-item index="/search">
            <el-icon><Search /></el-icon>
            <span>搜索消息</span>
          </el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="2">
          <template #title>
            <el-icon><UserFilled /></el-icon>
            <span>联系人</span>
          </template>
          <el-menu-item index="/contacts">
            <el-icon><User /></el-icon>
            <span>联系人管理</span>
          </el-menu-item>
          <el-menu-item index="/groups">
            <el-icon><UserFilled /></el-icon>
            <span>群管理</span>
          </el-menu-item>
          <el-menu-item index="/chatmanage">
            <el-icon><ChatSquare /></el-icon>
            <span>聊天管理</span>
          </el-menu-item>
          <el-menu-item index="/contact-lookup">
            <el-icon><ZoomIn /></el-icon>
            <span>联系人查询</span>
          </el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="3">
          <template #title>
            <el-icon><DataLine /></el-icon>
            <span>数据</span>
          </template>
          <el-menu-item index="/stats">
            <el-icon><TrendCharts /></el-icon>
            <span>数据统计</span>
          </el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="4">
          <template #title>
            <el-icon><Tools /></el-icon>
            <span>设置</span>
          </template>
          <el-menu-item index="/profile">
            <el-icon><Avatar /></el-icon>
            <span>个人信息</span>
          </el-menu-item>
          <el-menu-item index="/settings">
            <el-icon><Setting /></el-icon>
            <span>系统设置</span>
          </el-menu-item>
        </el-sub-menu>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <div class="header-right">
          <el-tag :type="connectionStatus.type">
            {{ connectionStatus.text }}
          </el-tag>
        </div>
      </el-header>
      <el-main class="main-content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useWhatsAppStore } from '@/stores/whatsapp'

const store = useWhatsAppStore()

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
</script>

<style scoped>
.main-layout {
  height: 100vh;
}

.sidebar {
  background: #1a1a2e;
  color: #fff;
}

.logo {
  padding: 20px;
  font-size: 18px;
  font-weight: bold;
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid #333;
}

.sidebar-menu {
  border-right: none;
}

.header {
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.main-content {
  background: #f5f5f5;
  padding: 20px;
  overflow-y: auto;
}
</style>
