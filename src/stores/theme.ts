import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

type ThemeName = 'default' | 'purple' | 'green' | 'orange'

const STORAGE_KEY_THEME = 'wa-theme'
const STORAGE_KEY_MODE = 'wa-mode'

const THEME_LABELS: Record<ThemeName, string> = {
  default: '深蓝',
  purple: '极紫',
  green: '翠绿',
  orange: '暖橙'
}

function loadTheme(): ThemeName {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_THEME)
    if (stored && ['default', 'purple', 'green', 'orange'].includes(stored)) {
      return stored as ThemeName
    }
  } catch {}
  return 'default'
}

function saveTheme(name: ThemeName) {
  try {
    localStorage.setItem(STORAGE_KEY_THEME, name)
  } catch {}
}

function loadMode(): 'dark' | 'light' {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_MODE)
    if (stored === 'dark' || stored === 'light') {
      return stored
    }
  } catch {}
  return 'dark'
}

function saveMode(mode: 'dark' | 'light') {
  try {
    localStorage.setItem(STORAGE_KEY_MODE, mode)
  } catch {}
}

function applyTheme(name: ThemeName) {
  document.documentElement.setAttribute('data-theme', name)
}

function applyMode(mode: 'dark' | 'light') {
  document.documentElement.setAttribute('data-mode', mode)
  if (mode === 'dark') {
    document.documentElement.classList.add('dark')
    document.documentElement.classList.remove('light')
  } else {
    document.documentElement.classList.add('light')
    document.documentElement.classList.remove('dark')
  }
}

export const useThemeStore = defineStore('theme', () => {
  const currentTheme = ref<ThemeName>(loadTheme())
  const currentMode = ref<'dark' | 'light'>(loadMode())

  const isDark = computed(() => currentMode.value === 'dark')
  const isLight = computed(() => currentMode.value === 'light')

  const themeLabel = computed(() => {
    const modeLabel = currentMode.value === 'dark' ? '深色' : '浅色'
    return `${THEME_LABELS[currentTheme.value]} · ${modeLabel}`
  })

  const themeOptions = computed(() =>
    (Object.entries(THEME_LABELS) as [ThemeName, string][]).map(([value, label]) => ({
      value,
      label
    }))
  )

  applyTheme(currentTheme.value)
  applyMode(currentMode.value)

  watch(currentTheme, (newVal) => {
    saveTheme(newVal)
    applyTheme(newVal)
  })

  watch(currentMode, (newVal) => {
    saveMode(newVal)
    applyMode(newVal)
  })

  function setTheme(name: ThemeName) {
    currentTheme.value = name
  }

  function setMode(mode: 'dark' | 'light') {
    currentMode.value = mode
  }

  function toggleMode() {
    currentMode.value = currentMode.value === 'dark' ? 'light' : 'dark'
  }

  return {
    currentTheme,
    currentMode,
    isDark,
    isLight,
    themeLabel,
    themeOptions,
    setTheme,
    setMode,
    toggleMode
  }
})