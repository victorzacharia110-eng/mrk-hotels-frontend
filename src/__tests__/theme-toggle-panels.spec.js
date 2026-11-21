import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { avatarUrl } from '@/utils/format'

/**
 * Guards that every panel which does not use StoreLayout's profile menu still
 * offers the light/dark switch. Those shells (cashier/bartender, store manager,
 * superadmin, owner, the customer portal) shipped the dark stylesheet but no way
 * to reach it, so the setting looked absent on exactly those roles. They all
 * share one ThemeToggle component wired to the single theme store.
 */

const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')

const component = read('src/components/ThemeToggle.vue')

// Each shell reaches the switch its own way: the cashier and store manager
// panels put it inside their profile menu, wired straight to the theme store,
// while the remaining shells render the shared ThemeToggle component. The marks
// are what has to show up in the file for that wiring to actually be reachable.
const PANELS = [
  {
    label: 'cashier / bartender',
    path: 'src/layouts/CashierLayout.vue',
    wiring: /import \{ useThemeStore \} from '@\/stores\/theme'/,
    marks: [/themeStore\.toggleTheme\(\)/, /cashier\.profile\.darkMode/],
  },
  {
    label: 'store manager / inventory',
    path: 'src/layouts/StoreManagerLayout.vue',
    wiring: /import \{ useThemeStore \} from '@\/stores\/theme'/,
    marks: [/themeStore\.toggleTheme\(\)/],
  },
  {
    label: 'superadmin',
    path: 'src/layouts/SuperadminLayout.vue',
    wiring: /import ThemeToggle from '@\/components\/ThemeToggle\.vue'/,
    marks: [/<ThemeToggle \/>/],
  },
  {
    label: 'owner',
    path: 'src/layouts/OwnerLayout.vue',
    wiring: /import ThemeToggle from '@\/components\/ThemeToggle\.vue'/,
    marks: [/<ThemeToggle \/>/],
  },
  {
    label: 'customer portal',
    path: 'src/layouts/CustomerLayout.vue',
    wiring: /import ThemeToggle from '@\/components\/ThemeToggle\.vue'/,
    marks: [/<ThemeToggle \/>/],
  },
]

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

describe.each(PANELS)('$label panel has the theme switch', ({ path, wiring, marks }) => {
  const layout = read(path)

  it('imports or wires the theme switch', () => {
    expect(layout).toMatch(wiring)
  })

  it('renders it in the shell', () => {
    // Every panel declares the marks that prove the switch is reachable, so the
    // assertions run unconditionally instead of branching on the file name.
    for (const mark of marks) {
      expect(layout).toMatch(mark)
    }
  })
})

describe('the reports / Back Office shell has the theme switch', () => {
  // The report browser and Back Office pages live inside StoreLayout, where the
  // switch is buried in the profile menu; they carry it in their own header so
  // it is reachable right on the page.
  const shell = read('src/components/reports/ReportBrowserLayout.vue')

  it('imports and renders the shared ThemeToggle', () => {
    expect(shell).toMatch(/import ThemeToggle from '@\/components\/ThemeToggle\.vue'/)
    expect(shell).toContain('<ThemeToggle')
  })
})

describe('the guest / public storefront header has the theme switch', () => {
  // The public storefront (home, hotel detail, booking, and the /guest portal)
  // shares StoreLayout, whose only desktop switch was buried in the staff
  // profile menu. The public branch of the header now renders the shared toggle.
  const layout = read('src/layouts/StoreLayout.vue')

  it('imports and renders the shared ThemeToggle in the public header', () => {
    expect(layout).toMatch(/import ThemeToggle from '@\/components\/ThemeToggle\.vue'/)
    expect(layout).toContain('<ThemeToggle class="public-theme" />')
  })

  it('drops the header pill on phones, where the mobile menu already carries it', () => {
    expect(layout).toMatch(/\.public-theme\s*\{\s*display:\s*none/)
    expect(layout).toContain('class="mobile-link theme-toggle"')
  })
})

describe('owner panel header', () => {
  const layout = read('src/layouts/OwnerLayout.vue')

  it('shows one role badge instead of duplicate owner labels', () => {
    expect(layout.match(/<RoleBadge \/>/g) || []).toHaveLength(1)
    expect(layout).not.toContain('class="sa-badge"')
  })

  it('ends the header with the shared avatar profile menu', () => {
    expect(layout).toContain('class="sa-profile-trigger"')
    expect(layout).toContain('class="sa-profile-panel"')
    expect(layout).toContain('class="sa-profile-link"')
    expect(layout).toContain(":aria-label=\"$t('nav.profile')\"")
    expect(layout).not.toContain('class="sa-user"')
  })

  it('keeps the hamburger visible for expanding and collapsing the sidebar', () => {
    expect(layout).toMatch(/\.sa-hamburger\s*\{\s*display:\s*flex/)
    expect(layout).toContain('sidebarCollapsed.value = !sidebarCollapsed.value')
  })
})

describe('profile avatar URLs', () => {
  const apiBase = 'http://localhost:8000/storage/staff/profile-pictures/a.jpg'

  it('resolves storage paths against the API origin', () => {
    expect(avatarUrl('/storage/staff/profile-pictures/a.jpg')).toBe(apiBase)
    expect(avatarUrl('storage/staff/profile-pictures/a.jpg')).toBe(apiBase)
  })

  it('keeps absolute URLs and blank values intact', () => {
    expect(avatarUrl('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg')
    expect(avatarUrl('')).toBe('')
  })
})

const AVATAR_PANELS = [
  { label: 'store', path: 'src/layouts/StoreLayout.vue' },
  { label: 'superadmin', path: 'src/layouts/SuperadminLayout.vue' },
  { label: 'owner', path: 'src/layouts/OwnerLayout.vue' },
  { label: 'cashier', path: 'src/layouts/CashierLayout.vue' },
  { label: 'store manager', path: 'src/layouts/StoreManagerLayout.vue' },
]

describe.each(AVATAR_PANELS)('$label panel renders the profile photo', ({ path }) => {
  const layout = read(path)

  it('renders the resolved avatar URL with initials fallback', () => {
    expect(layout).toContain("import { avatarUrl } from '@/utils/format'")
    expect(layout).toContain('const accountAvatarUrl = computed(() => avatarUrl(authStore.user?.profile_picture))')
    expect(layout).toContain(':src="accountAvatarUrl"')
    expect(layout).toMatch(/\{\{ (?:userInitials|accountInitials) \}\}/)
  })
})

const PROFILE_PAGES = [
  { label: 'staff', path: 'src/pages/profile/ProfilePage.vue' },
  { label: 'owner', path: 'src/pages/owner/ProfilePage.vue' },
  { label: 'superadmin', path: 'src/pages/superadmin/ProfilePage.vue' },
]

describe.each(PROFILE_PAGES)('$label profile can remove the photo', ({ path }) => {
  const page = read(path)

  it('sends the removal flag and clears the local preview', () => {
    expect(page).toContain('@click="removePhoto"')
    expect(page).toContain("fd.append('remove_profile_picture', '1')")
    expect(page).toContain("message.value = t('profile.photoRemoved')")
    expect(page).toContain('photoInput.value.value =')
  })
})

describe('profile photo removal translations', () => {
  it('exists in English and Swahili', () => {
    expect(read('src/locales/en.json')).toContain('"removePhoto": "Remove photo"')
    expect(read('src/locales/sw.json')).toContain('"removePhoto": "Ondoa picha"')
  })
})
