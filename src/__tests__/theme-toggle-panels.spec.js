import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Guards that every panel which does not use StoreLayout's profile menu still
 * offers the light/dark switch. Those shells (cashier/bartender, store manager,
 * superadmin, owner) shipped the dark stylesheet but no way to reach it, so the
 * setting looked absent on exactly those roles. They all share one ThemeToggle
 * component wired to the single theme store.
 */

const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')

const component = read('src/components/ThemeToggle.vue')

const PANELS = {
  'cashier / bartender': 'src/layouts/CashierLayout.vue',
  'store manager / inventory': 'src/layouts/StoreManagerLayout.vue',
  superadmin: 'src/layouts/SuperadminLayout.vue',
  owner: 'src/layouts/OwnerLayout.vue',
}

describe('shared ThemeToggle component', () => {
  it('drives the one theme store', () => {
    expect(component).toMatch(/import \{ useThemeStore \} from '@\/stores\/theme'/)
    expect(component).toMatch(/const themeStore = useThemeStore\(\)/)
    expect(component).toMatch(/@click="themeStore\.toggleTheme\(\)"/)
    expect(component).toMatch(/:aria-pressed="themeStore\.isDark"/)
  })

  it('flips the icon and label between dark and light', () => {
    expect(component).toMatch(/themeStore\.isDark \? 'fas fa-sun' : 'fas fa-moon'/)
    expect(component).toMatch(/themeStore\.isDark \? \$t\('topBar\.lightMode'\) : \$t\('topBar\.darkMode'\)/)
  })
})

describe.each(Object.entries(PANELS))('%s panel has the theme switch', (_label, path) => {
  const layout = read(path)

  it('imports the ThemeToggle component', () => {
    expect(layout).toMatch(/import ThemeToggle from '@\/components\/ThemeToggle\.vue'/)
  })

  it('renders it in the shell', () => {
    expect(layout).toContain('<ThemeToggle />')
  })
})
