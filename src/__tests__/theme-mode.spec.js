import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createPinia, setActivePinia } from 'pinia'
import {
  THEMES,
  THEME_STORAGE_KEY,
  resolveStoredTheme,
  applyTheme,
  useThemeStore,
} from '@/stores/theme'

/**
 * Guards the panel's light/dark mode.
 *
 * The switch is a single persisted preference that repaints the shell through
 * <html data-theme="dark">. Two things are easy to break and invisible in a
 * smoke test: the choice not surviving a reload (the key name drifting), and
 * the switch sitting below the language buttons instead of above them, which is
 * exactly where the client asked for it. Both are asserted here, plus the
 * stylesheet actually keying off the attribute.
 */

const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')
const layout = read('src/layouts/StoreLayout.vue')
const themeCss = read('src/assets/theme.css')
const main = read('src/main.js')
const en = JSON.parse(read('src/locales/en.json'))
const sw = JSON.parse(read('src/locales/sw.json'))

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  delete document.documentElement.dataset.theme
})

describe('theme store', () => {
  it('defaults to light when nothing is stored', () => {
    expect(resolveStoredTheme()).toBe('light')
  })

  it('reads back a stored choice and ignores junk', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    expect(resolveStoredTheme()).toBe('dark')
    localStorage.setItem(THEME_STORAGE_KEY, 'sepia')
    expect(resolveStoredTheme()).toBe('light')
  })

  it('persists the choice and applies it to the root element', () => {
    const store = useThemeStore()
    store.setTheme('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })

  it('toggles between the two themes and remembers each', () => {
    const store = useThemeStore()
    expect(store.isDark).toBe(false)
    store.toggleTheme()
    expect(store.theme).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    store.toggleTheme()
    expect(store.theme).toBe('light')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
  })

  it('falls back to light for an unknown theme name', () => {
    const store = useThemeStore()
    store.setTheme('nope')
    expect(store.theme).toBe('light')
  })

  it('only knows two themes', () => {
    expect(THEMES).toEqual(['light', 'dark'])
  })

  it('applies a theme directly, for the pre-mount paint', () => {
    applyTheme('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})

describe('theme toggle sits above the translation buttons', () => {
  const menu = layout.slice(
    layout.indexOf('class="profile-menu-panel"'),
    layout.indexOf('<div class="profile-menu-lang"'),
  )

  it('renders the switch inside the profile menu, before the language group', () => {
    expect(menu).toMatch(/class="profile-menu-link theme-toggle"/)
    // The theme switch is the last thing before the EN/SW buttons.
    expect(menu.trimEnd()).toMatch(/theme-toggle[\s\S]*<\/button>$/)
  })

  it('flips the label between dark and light', () => {
    expect(layout).toMatch(/themeStore\.isDark \? \$t\('topBar\.lightMode'\) : \$t\('topBar\.darkMode'\)/)
    expect(layout).toMatch(/@click="themeStore\.toggleTheme\(\)"/)
    expect(layout).toMatch(/:aria-pressed="themeStore\.isDark"/)
  })

  it('offers the switch in the mobile drawer too, above the language link', () => {
    const drawer = layout.slice(layout.indexOf('id="mobile-menu"'))
    const themeAt = drawer.indexOf('mobile-link theme-toggle')
    const langAt = drawer.indexOf('@click="toggleLocale"')
    expect(themeAt).toBeGreaterThan(-1)
    expect(langAt).toBeGreaterThan(-1)
    expect(themeAt).toBeLessThan(langAt)
  })

  it('imports and instantiates the theme store', () => {
    expect(layout).toMatch(/import \{ useThemeStore \} from '@\/stores\/theme'/)
    expect(layout).toMatch(/const themeStore = useThemeStore\(\)/)
  })
})

describe('dark theme stylesheet', () => {
  it('keys every dark rule off the root attribute', () => {
    expect(themeCss).toMatch(/html\[data-theme='dark'\]/)
    expect(themeCss).toMatch(/html\[data-theme='dark'\] body \{/)
  })

  it('repaints the shared surfaces and the panel shell', () => {
    for (const sel of ['.card', '.table', '.modal', '.profile-menu-panel', '.lang-option.active']) {
      expect(themeCss).toContain(sel)
    }
  })

  it('makes the reports browser paper a dark surface with light text', () => {
    // The white .rb-paper inherited the dark theme's light body colour, which is
    // what made the report text read as faint grey on a white sheet.
    expect(themeCss).toMatch(/html\[data-theme='dark'\] \.rb-paper,[\s\S]*?background: #111c2e/)
    expect(themeCss).toContain('html[data-theme=\'dark\'] .rb-paper')
    expect(themeCss).toMatch(/html\[data-theme='dark'\] \.rb-loading,[\s\S]*?color: #cbd5e1/)
    expect(themeCss).toMatch(/html\[data-theme='dark'\] \.rb-report-head h2,[\s\S]*?color: #f1f5f9/)
  })

  it('repaints the other report pages too', () => {
    expect(themeCss).toContain("html[data-theme='dark'] .rp-section")
    expect(themeCss).toContain("html[data-theme='dark'] .tab-btn")
    expect(themeCss).toMatch(/--text-muted: #94a3b8/)
  })

  it('keeps the staff sign-in page dark-on-light in dark mode', () => {
    expect(themeCss).toMatch(/html\[data-theme='dark'\] \.auth-card \.auth-header h1 \{[\s\S]*?color: #0b1f33/)
    expect(themeCss).toContain("html[data-theme='dark'] .auth-card .form-group label")
    expect(themeCss).toMatch(/html\[data-theme='dark'\] \.auth-card \.form-group input,[\s\S]*?color: #111827/)
  })

  it('is loaded and applied before the app mounts', () => {
    expect(main).toMatch(/import '\.\/assets\/theme\.css'/)
    const applyAt = main.indexOf('applyTheme(resolveStoredTheme())')
    const mountAt = main.indexOf("app.mount('#app')")
    expect(applyAt).toBeGreaterThan(-1)
    expect(applyAt).toBeLessThan(mountAt)
  })
})

describe('theme labels are translated', () => {
  it('has both keys in both languages', () => {
    expect(en.topBar.darkMode).toBeTruthy()
    expect(en.topBar.lightMode).toBeTruthy()
    expect(sw.topBar.darkMode).toBeTruthy()
    expect(sw.topBar.lightMode).toBeTruthy()
  })
})
