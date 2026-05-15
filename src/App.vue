<template>
  <router-view />
</template>

<script setup lang="ts">
</script>

<style>
@import '@/styles/themes.css';
@import 'element-plus/theme-chalk/dark/css-vars.css';

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
  overflow: hidden;
}

body {
  font-family: var(--font-body);
  font-size: 14px;
  background: var(--bg-primary);
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Override Element Plus dark mode menu backgrounds */
html.dark .el-menu,
html.dark .el-sub-menu,
html.dark .el-menu-item:not(.is-active),
html.dark .el-sub-menu__title {
  background: transparent !important;
}

/* Glass surfaces */
.glass {
  background: var(--bg-glass);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--border-glass);
}

/* Cards */
.card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
  transition: all var(--transition-duration) ease;
}

.card:hover {
  background: var(--card-hover);
  border-color: var(--border-hover);
}

.card-glass {
  background: var(--bg-glass);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--card-border-glass);
  border-radius: var(--radius);
  box-shadow: var(--shadow-glass);
  transition: all var(--transition-duration) ease;
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--border-default);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--border-hover);
}
</style>