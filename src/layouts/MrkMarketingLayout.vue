<template>
  <div class="mrk-layout">
    <header class="mrk-header">
      <div class="mrk-container mrk-header-inner">
        <router-link :to="{ name: 'marketing-home' }" class="mrk-brand" @click="mobileOpen = false">
          <span class="mrk-brand-mark"><i class="fas fa-hotel" aria-hidden="true"></i></span>
          <span>MRK Hotel Software</span>
        </router-link>

        <nav class="mrk-nav" aria-label="Primary">
          <router-link :to="{ name: 'marketing-home' }" class="mrk-nav-link">{{ $t('marketing.home') }}</router-link>

          <div
            class="mrk-dropdown"
            @mouseenter="openProductsMenu"
            @mouseleave="scheduleProductsClose"
            @focusin="openProductsMenu"
            @focusout="handleProductsFocusOut"
          >
            <button
              type="button"
              class="mrk-nav-button"
              :aria-expanded="productsOpen ? 'true' : 'false'"
              @click="toggleProductsMenu"
              @keydown.esc="closeProductsMenu"
            >
              {{ $t('marketing.products') }} <i class="fas fa-chevron-down" aria-hidden="true"></i>
            </button>
            <div
              v-if="productsOpen"
              class="mrk-dropdown-menu"
              role="menu"
              @mouseenter="openProductsMenu"
              @mouseleave="scheduleProductsClose"
            >
              <router-link
                v-for="page in productPages"
                :key="page.slug"
                :to="pageLink(page)"
                class="mrk-dropdown-item"
                role="menuitem"
                @click="closeProductsMenu"
              >
                {{ page.nav_label || page.title }}
              </router-link>
              <span v-if="!productPages.length" class="mrk-dropdown-item mrk-muted">{{ $t('marketingCopy.noProducts') }}</span>
            </div>
          </div>

          <router-link :to="{ name: 'marketing-integrations' }" class="mrk-nav-link">{{ $t('marketing.integrations') }}</router-link>
          <router-link v-if="pricingEnabled" :to="{ name: 'marketing-pricing' }" class="mrk-nav-link">{{ $t('marketing.pricing') }}</router-link>
          <router-link :to="{ name: 'marketing-about' }" class="mrk-nav-link mrk-nav-upper">{{ $t('marketing.about') }}</router-link>
        </nav>

        <div class="mrk-header-actions">
          <router-link to="/portal/pricing" class="mrk-btn mrk-btn-tscl" :title="$t('marketing.tsclTitle')">
            <i class="fas fa-cloud" aria-hidden="true"></i> {{ $t('marketing.tscl') }}
          </router-link>
          <ThemeToggle />
          <div class="mrk-lang-switch" role="group" :aria-label="$t('topBar.language')">
            <button
              type="button"
              class="mrk-lang-btn"
              :class="{ active: locale === 'en' }"
              :aria-pressed="locale === 'en' ? 'true' : 'false'"
              @click="setLocale('en')"
            >EN</button>
            <button
              type="button"
              class="mrk-lang-btn"
              :class="{ active: locale === 'sw' }"
              :aria-pressed="locale === 'sw' ? 'true' : 'false'"
              @click="setLocale('sw')"
            >SW</button>
          </div>
          <div class="mrk-header-cta">
            <router-link :to="{ name: 'public-home' }" class="mrk-btn mrk-btn-secondary">
              <i class="fas fa-bed" aria-hidden="true"></i> {{ $t('nav.bookStay') }}
            </router-link>
            <a v-for="cta in headerCtas" :key="cta.label + cta.url" :href="cta.url" class="mrk-btn mrk-btn-primary">{{ cta.label }}</a>
            <router-link to="/login" class="mrk-btn mrk-btn-secondary">{{ $t('marketing.signIn') }}</router-link>
          </div>
        </div>

        <button
          type="button"
          class="mrk-mobile-toggle"
          :aria-expanded="mobileOpen ? 'true' : 'false'"
          aria-controls="mrk-mobile-panel"
          @click="mobileOpen = !mobileOpen"
        >
          <i :class="mobileOpen ? 'fas fa-xmark' : 'fas fa-bars'" aria-hidden="true"></i>
        </button>
      </div>

      <div id="mrk-mobile-panel" class="mrk-mobile-panel" :class="{ open: mobileOpen }">
        <div class="mrk-mobile-inner">
          <router-link :to="{ name: 'marketing-home' }" class="mrk-nav-link" @click="mobileOpen = false">{{ $t('marketing.home') }}</router-link>
          <div class="mrk-muted" style="font-size:12px;font-weight:700;text-transform:uppercase;">{{ $t('marketing.products') }}</div>
          <router-link
            v-for="page in productPages"
            :key="'m-' + page.slug"
            :to="pageLink(page)"
            class="mrk-nav-link"
            @click="mobileOpen = false"
          >
            {{ page.nav_label || page.title }}
          </router-link>
          <router-link :to="{ name: 'marketing-integrations' }" class="mrk-nav-link" @click="mobileOpen = false">{{ $t('marketing.integrations') }}</router-link>
          <router-link v-if="pricingEnabled" :to="{ name: 'marketing-pricing' }" class="mrk-nav-link" @click="mobileOpen = false">{{ $t('marketing.pricing') }}</router-link>
          <router-link :to="{ name: 'marketing-about' }" class="mrk-nav-link mrk-nav-upper" @click="mobileOpen = false">{{ $t('marketing.about') }}</router-link>
          <router-link to="/login" class="mrk-nav-link" @click="mobileOpen = false">{{ $t('marketing.signIn') }}</router-link>
          <router-link :to="{ name: 'public-home' }" class="mrk-btn mrk-btn-secondary" @click="mobileOpen = false">
            <i class="fas fa-bed" aria-hidden="true"></i> {{ $t('nav.bookStay') }}
          </router-link>
          <div class="mrk-mobile-controls">
            <router-link to="/portal/pricing" class="mrk-btn mrk-btn-tscl" :title="$t('marketing.tsclTitle')" @click="mobileOpen = false">
              <i class="fas fa-cloud" aria-hidden="true"></i> {{ $t('marketing.tscl') }}
            </router-link>
            <ThemeToggle />
            <div class="mrk-lang-switch" role="group" :aria-label="$t('topBar.language')">
              <button type="button" class="mrk-lang-btn" :class="{ active: locale === 'en' }" :aria-pressed="locale === 'en' ? 'true' : 'false'" @click="setLocale('en')">EN</button>
              <button type="button" class="mrk-lang-btn" :class="{ active: locale === 'sw' }" :aria-pressed="locale === 'sw' ? 'true' : 'false'" @click="setLocale('sw')">SW</button>
            </div>
          </div>
          <a v-for="cta in headerCtas" :key="'mcta-' + cta.label + cta.url" :href="cta.url" class="mrk-btn mrk-btn-primary" @click="mobileOpen = false">{{ cta.label }}</a>
        </div>
      </div>
    </header>

    <main class="mrk-main">
      <div v-if="loading && !bootstrap" class="mrk-section">
        <div class="mrk-container"><div class="mrk-empty">{{ $t('marketingCopy.loadingMarketing') }}</div></div>
      </div>
      <div v-else-if="error && !bootstrap" class="mrk-section">
        <div class="mrk-container"><div class="mrk-empty">{{ $t('marketingCopy.marketingUnavailable') }}</div></div>
      </div>
      <router-view v-else />
    </main>

    <footer class="mrk-footer">
      <div class="mrk-container mrk-footer-inner">
        <div>
          <div class="mrk-brand" style="color:#fff; margin-bottom:12px;">
            <span class="mrk-brand-mark"><i class="fas fa-hotel" aria-hidden="true"></i></span>
            <span>MRK Hotel Software</span>
          </div>
          <ul v-if="footer.contact?.length">
            <li v-for="item in footer.contact" :key="'contact-' + item"><span>{{ item }}</span></li>
          </ul>
        </div>

        <div v-if="footer.modules?.length">
          <h4>{{ $t('marketingCopy.modules') }}</h4>
          <ul>
            <li v-for="item in footer.modules" :key="'mod-' + item"><span>{{ item }}</span></li>
          </ul>
        </div>

        <div v-if="footer.solutions?.length">
          <h4>{{ $t('marketingCopy.solutions') }}</h4>
          <ul>
            <li v-for="item in footer.solutions" :key="'sol-' + item"><span>{{ item }}</span></li>
          </ul>
        </div>

        <div v-if="footer.company?.length">
          <h4>{{ $t('marketingCopy.company') }}</h4>
          <ul>
            <li v-for="item in footer.company" :key="'co-' + item"><span>{{ item }}</span></li>
          </ul>
        </div>

        <div v-if="legalLinks.length || socialLinks.length">
          <h4 v-if="legalLinks.length">{{ $t('marketingCopy.legal') }}</h4>
          <ul v-if="legalLinks.length">
            <li v-for="item in legalLinks" :key="'legal-' + item.label">
              <a :href="item.url" target="_blank" rel="noopener">{{ item.label }}</a>
            </li>
          </ul>
          <h4 v-if="socialLinks.length" style="margin-top:16px;">{{ $t('marketingCopy.social') }}</h4>
          <ul v-if="socialLinks.length">
            <li v-for="item in socialLinks" :key="'social-' + item.label">
              <a :href="item.url" target="_blank" rel="noopener">{{ item.label }}</a>
            </li>
          </ul>
        </div>
      </div>
      <div class="mrk-container mrk-footer-bottom">
        {{ copyrightText }}
      </div>
    </footer>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ThemeToggle from '@/components/ThemeToggle.vue'
import { useMarketingContent } from '@/composables/useMarketingContent'

const { locale, t } = useI18n()
const mobileOpen = ref(false)
const productsOpen = ref(false)
let productsCloseTimer = null
const { bootstrap, loading, error, loadBootstrap, getSetting, isSettingEnabled } = useMarketingContent()

const pricingEnabled = computed(() => isSettingEnabled('show_pricing', false))

function openProductsMenu() {
  clearTimeout(productsCloseTimer)
  productsCloseTimer = null
  productsOpen.value = true
}

function closeProductsMenu() {
  clearTimeout(productsCloseTimer)
  productsCloseTimer = null
  productsOpen.value = false
}

function toggleProductsMenu() {
  if (productsOpen.value) closeProductsMenu()
  else openProductsMenu()
}

function scheduleProductsClose() {
  clearTimeout(productsCloseTimer)
  productsCloseTimer = setTimeout(() => {
    productsOpen.value = false
    productsCloseTimer = null
  }, 180)
}

function handleProductsFocusOut(event) {
  if (event.currentTarget?.contains(event.relatedTarget)) return
  scheduleProductsClose()
}

function setLocale(lang) {
  locale.value = lang
  localStorage.setItem('locale', lang)
}

onMounted(() => {
  loadBootstrap().catch(() => {})
})

onBeforeUnmount(() => {
  clearTimeout(productsCloseTimer)
})

const productPages = computed(() => {
  const pages = bootstrap.value?.pages || []
  return pages.filter((p) => p.show_in_nav && !['home', 'integrations', 'pricing', 'about'].includes(p.slug))
})

const headerCtas = computed(() => {
  const fromSettings = getSetting('hero_ctas', [])
  const list = Array.isArray(fromSettings) ? fromSettings : []
  return list.filter((cta) => cta && cta.label && cta.url)
})

const footer = computed(() => {
  const value = getSetting('footer', {})
  return value && typeof value === 'object' ? value : {}
})

const legal = computed(() => {
  const value = getSetting('legal', {})
  return value && typeof value === 'object' ? value : {}
})

function validLinks(items) {
  if (!Array.isArray(items)) return []
  return items.filter((item) => item && item.label && item.url)
}

function legalObjectLinks(obj) {
  if (!obj || typeof obj !== 'object') return []
  return Object.values(obj).filter((item) => item && item.label && item.url)
}

const legalLinks = computed(() => {
  const direct = legalObjectLinks(legal.value)
  if (direct.length) return direct
  return validLinks(footer.value.legal)
})

const socialLinks = computed(() => validLinks(footer.value.social || getSetting('social', [])))

const copyrightText = computed(() => {
  const value = getSetting('copyright')
  if (typeof value === 'string' && value) return value
  return t('marketingCopy.copyrightFallback', { year: new Date().getFullYear() })
})

function pageLink(page) {
  if (page.slug === 'home') return { name: 'marketing-home' }
  if (page.slug === 'integrations') return { name: 'marketing-integrations' }
  if (page.slug === 'pricing') return { name: 'marketing-pricing' }
  if (page.slug === 'about') return { name: 'marketing-about' }
  return { name: 'marketing-product', params: { slug: page.slug } }
}
</script>

<style src="@/assets/marketing.css"></style>
