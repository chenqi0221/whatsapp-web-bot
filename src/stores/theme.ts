import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

type ThemeName = 'default' | 'purple' | 'green' | 'orange'

const STORAGE_KEY = 'wa-theme'

const THEME_LABELS: Record<ThemeName, string> = {
  default: '深蓝',
  purple: '极紫',
  green: '翠绿',
  orange: '暖橙'
}

function loadTheme(): ThemeName {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && ['default', 'purple', 'green', 'orange'].includes(stored)) {
      return stored as ThemeName
    }
  } catch {}
  return 'default'
}

function saveTheme(name: ThemeName) {
  try {
    localStorage.setItem(STORAGE_KEY, name)
  } catch {}
}

function applyTheme(name: ThemeName) {
  document.documentElement.setAttribute('data-theme', name)
}

export const useThemeStore = defineStore('theme', () => {
  const current = ref<ThemeName>(loadTheme())

  const themeLabel = computed(() => THEME_LABELS[current.value])

  const themeOptions = computed(() =>
    (Object.entries(THEME_LABELS) as [ThemeName, string][]).map(([value, label]) => ({
      value,
      label
    }))
  )

  applyTheme(current.value)

  watch(current, (newVal) => {
    saveTheme(newVal)
    applyTheme(newVal)
  })

  function setTheme(name: ThemeName) {
    current.value = name
  }

  return {
    current,
    themeLabel,
    themeOptions,
    setTheme
  }
})