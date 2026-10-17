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
    expect(themeCss).toMatch(/html\[data-theme='dark'\] \.rb-paper,[\s\S]*?background: #202c33/)
    expect(themeCss).toContain('html[data-theme=\'dark\'] .rb-paper')
    expect(themeCss).toMatch(/html\[data-theme='dark'\] \.rb-loading,[\s\S]*?color: #aebac1/)
    expect(themeCss).toMatch(/html\[data-theme='dark'\] \.rb-report-head h2,[\s\S]*?color: #e9edef/)
  })

  it('repaints the Back Office detail, whose heading is a soft near-white', () => {
    // The detail title ships #0f172a (near-black); on the dark sheet it would
    // vanish. It is lifted to the palette near-white on purpose — not #fff,
    // which the client found too bright.
    expect(themeCss).toMatch(/html\[data-theme='dark'\] \.bo-detail-title \{ color:#e9edef; \}/)
    expect(themeCss).toContain("html[data-theme='dark'] .bo-detail-icon")
    expect(themeCss).toContain("html[data-theme='dark'] .bo-detail-desc")
    expect(themeCss).not.toMatch(/html\[data-theme='dark'\] \.bo-detail-title \{ color:#fff/)
  })

  it('repaints the other report pages too', () => {
    expect(themeCss).toContain("html[data-theme='dark'] .rp-section")
    expect(themeCss).toContain("html[data-theme='dark'] .tab-btn")
    expect(themeCss).toMatch(/--text-muted: #95a3ab/)
  })

  it('uses the WhatsApp-style dark palette', () => {
    expect(themeCss).toMatch(/--bg: #0b141a/)
    expect(themeCss).toMatch(/--card: #202c33/)
    expect(themeCss).toMatch(/--text: #e9edef/)
    expect(themeCss).toMatch(/--muted: #95a3ab/)
  })

  it('repaints the sign-in pages dark too', () => {
    expect(themeCss).toContain("html[data-theme='dark'] .auth-page")
    expect(themeCss).toContain("html[data-theme='dark'] .guest-login-page")
    expect(themeCss).toMatch(/html\[data-theme='dark'\] \.form-group input,[\s\S]*?background: #2a3942/)
  })

  it('repaints the take-order pad, which was white panels with white text', () => {
    // The pad ships its own hardcoded light surfaces that the shared primitives
    // never reach, so in dark mode it used to show white cards with near-white
    // text — the cards were unreadable. The panels and the food/table cards are
    // repainted here; the gold/blue accents are left to win.
    expect(themeCss).toMatch(/html\[data-theme='dark'\] \.cat-panel,[\s\S]*?background: #202c33/)
    expect(themeCss).toContain("html[data-theme='dark'] .table-map")
    expect(themeCss).toContain("html[data-theme='dark'] .inline-items")
    expect(themeCss).toMatch(/html\[data-theme='dark'\] \.cat-item \{[\s\S]*?background: #202c33/)
    expect(themeCss).toMatch(/html\[data-theme='dark'\] \.cat-search,[\s\S]*?background: #2a3942/)
  })

  it('repaints the reception stay view, which stayed a white tape chart', () => {
    // The stay view is a second self-contained world of white surfaces: the
    // board, its day/room/type columns, and the booking-bar modals. Left alone
    // it rendered as a bright white chart against the dark shell.
    expect(themeCss).toMatch(/html\[data-theme='dark'\] \.stayview-page \{[\s\S]*?background: #0b141a/)
    expect(themeCss).toMatch(/html\[data-theme='dark'\] \.sv-chart \{[\s\S]*?background: #202c33/)
    expect(themeCss).toMatch(/html\[data-theme='dark'\] \.sv-modal \{[\s\S]*?background: #202c33/)
    expect(themeCss).toMatch(/html\[data-theme='dark'\] \.sv-room-cell \{[\s\S]*?background: #202c33/)
    expect(themeCss).toMatch(/html\[data-theme='dark'\] \.sv-day-head \{[\s\S]*?background: #2a3942/)
    for (const sel of ['.sv-type-cell', '.sv-footer-day', '.sv-search', '.sv-dropdown-menu', '.sv-panel-card']) {
      expect(themeCss).toContain(`html[data-theme='dark'] ${sel}`)
    }
  })

  it('repaints the shared neutral buttons, which were the last white surfaces', () => {
    expect(themeCss).toMatch(/html\[data-theme='dark'\] \.btn-secondary \{[\s\S]*?background: #2a3942/)
    expect(themeCss).toContain("html[data-theme='dark'] .btn-white")
    expect(themeCss).toContain("html[data-theme='dark'] .btn-outline")
  })

  it('repaints the cashier POS + store panels and the chat', () => {
    // The POS/store panels are a whole light design system; the chat is the
    // WhatsApp-style column. All of them used to stay white in dark mode.
    for (const sel of [
      '.pos-topbar', '.pos-table', '.waiter-row', '.outlet-option', '.sm-topbar',
      '.panel', '.sa-header', '.chat-shell', '.chat-messages', '.bubble.theirs',
    ]) {
      expect(themeCss).toContain(`html[data-theme='dark'] ${sel}`)
    }
    expect(themeCss).toMatch(/html\[data-theme='dark'\] \.chat-messages \{[\s\S]*?background: #0b141a/)
  })

  it('repaints the marketing, portal and report-browser leftovers', () => {
    // These shipped hardcoded light surfaces the shared primitives never reach:
    // the marketing header, the portal page title, the report help-table's dark
    // first column, the POS/store page shells and the mobile logout link.
    expect(themeCss).toMatch(/html\[data-theme='dark'\] \.mkt-header \{ background:\s*#202c33/)
    expect(themeCss).toContain("html[data-theme='dark'] .sa-page-title")
    expect(themeCss).toContain("html[data-theme='dark'] .rb-help-table td:first-child")
    expect(themeCss).toMatch(/html\[data-theme='dark'\] \.pos-layout \{[\s\S]*?background: #0b141a/)
    expect(themeCss).toMatch(/html\[data-theme='dark'\] \.sm-layout \{[\s\S]*?background: #0b141a/)
    expect(themeCss).toContain("html[data-theme='dark'] .mobile-link.logout")
  })

  it('turns the sidebars near-black in dark mode', () => {
    // The brand-blue drawer and the POS/store/superadmin rails all go black so
    // the whole chrome matches the dark shell instead of a bright blue slab.
    for (const sel of ['.staff-drawer', '.pos-sidebar', '.sm-sidebar', '.sa-sidebar']) {
      expect(themeCss).toContain(`html[data-theme='dark'] ${sel}`)
    }
    expect(themeCss).toMatch(/html\[data-theme='dark'\] \.staff-drawer,[\s\S]*?background: #0b141a/)
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
