<template>
  <div>
    <section
      v-for="section in activeSections"
      :id="section.section_type"
      :key="section.id || section.section_type + section.sort_order"
      class="mrk-section"
      :class="sectionClass(section)"
    >
      <div class="mrk-container">
        <template v-if="section.section_type === 'hero'">
          <div :ref="setHeroStage" class="mrk-hero-stage" style="padding:0;background:none;">
            <MarketingHeroScene v-if="heroSceneVisible" class="mrk-hero-scene" />
            <div class="mrk-hero-content">
              <div v-if="section.subheading" class="mrk-eyebrow">{{ section.subheading }}</div>
              <h1 class="mrk-page-title">{{ section.heading || page?.title }}</h1>
              <p v-if="heroBody(section)" class="mrk-lead">{{ heroBody(section) }}</p>
              <div v-if="ctas(section).length" class="mrk-actions">
                <a
                  v-for="cta in ctas(section)"
                  :key="cta.label + cta.url"
                  :href="cta.url"
                  class="mrk-btn"
                  :class="ctaPrimary(cta) ? 'mrk-btn-primary' : 'mrk-btn-secondary'"
                >{{ cta.label }}</a>
              </div>
              <div v-if="stats(section).length" class="mrk-stats">
                <div v-for="stat in stats(section)" :key="stat.label + stat.value" class="mrk-stat">
                  <div class="mrk-stat-value">{{ stat.value || stat.label }}</div>
                  <div v-if="stat.value" class="mrk-stat-label">{{ stat.label }}</div>
                </div>
              </div>
            </div>
          </div>
        </template>

        <template v-else-if="section.section_type === 'contact'">
          <div class="mrk-grid mrk-grid-2">
            <div>
              <div v-if="section.subheading" class="mrk-eyebrow">{{ section.subheading }}</div>
              <h2>{{ section.heading || $t('marketingCopy.contactUs') }}</h2>
              <p v-if="bodyText(section)" class="mrk-subheading">{{ bodyText(section) }}</p>
              <ul v-if="labels(section).length" class="mrk-list">
                <li v-for="label in labels(section)" :key="label">{{ label }}</li>
              </ul>
            </div>
            <div class="mrk-card">
              <form class="mrk-form" @submit.prevent="submitContact">
                <div class="mrk-form-grid">
                  <div class="mrk-field">
                    <label for="contact-name">{{ contactLabels.name }}</label>
                    <input id="contact-name" v-model.trim="contact.name" class="mrk-input" required />
                  </div>
                  <div class="mrk-field">
                    <label for="contact-email">{{ contactLabels.email }}</label>
                    <input id="contact-email" v-model.trim="contact.email" type="email" class="mrk-input" required />
                  </div>
                  <div class="mrk-field">
                    <label for="contact-business">{{ contactLabels.businessName }}</label>
                    <input id="contact-business" v-model.trim="contact.business_name" class="mrk-input" required />
                  </div>
                  <div class="mrk-field">
                    <label for="contact-address">{{ contactLabels.businessAddress }}</label>
                    <input id="contact-address" v-model.trim="contact.business_address" class="mrk-input" required />
                  </div>
                </div>
                <div v-if="contactError" class="mrk-alert mrk-alert-error">{{ contactError }}</div>
                <div v-if="contactSuccess" class="mrk-alert mrk-alert-success">{{ contactSuccess }}</div>
                <div>
                  <button type="submit" class="mrk-btn mrk-btn-primary" :disabled="contactSubmitting">
                    {{ contactSubmitting ? $t('marketingCopy.sending') : contactLabels.submit }}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </template>

        <template v-else-if="section.section_type === 'integrations'">
          <div class="mrk-center" style="margin-bottom:24px;">
            <div v-if="section.subheading" class="mrk-eyebrow">{{ section.subheading }}</div>
            <h2>{{ section.heading || $t('marketing.integrations') }}</h2>
            <p v-if="bodyText(section)" class="mrk-subheading" style="margin:0 auto;">{{ bodyText(section) }}</p>
          </div>
          <div v-if="groupedIntegrations.length">
            <div v-for="group in groupedIntegrations" :key="group.category" class="mrk-integration-group">
              <h3>{{ group.category }}</h3>
              <div class="mrk-grid mrk-grid-3">
                <article v-for="item in group.items" :key="item.id || item.slug" class="mrk-card">
                  <h3>{{ item.name }}</h3>
                  <p v-if="item.description">{{ item.description }}</p>
                  <div v-if="item.external_url" class="mrk-actions" style="margin-top:16px;">
                    <a :href="item.external_url" target="_blank" rel="noopener" class="mrk-btn mrk-btn-secondary">{{ $t('marketingCopy.learnMore') }}</a>
                  </div>
                </article>
              </div>
            </div>
          </div>
          <div v-else class="mrk-empty">{{ $t('marketingCopy.noIntegrations') }}</div>
        </template>

        <template v-else-if="section.section_type === 'workflow'">
          <div v-if="section.subheading" class="mrk-eyebrow">{{ section.subheading }}</div>
          <h2>{{ section.heading || $t('marketingCopy.workflow') }}</h2>
          <p v-if="bodyText(section)" class="mrk-subheading">{{ bodyText(section) }}</p>
          <div v-if="modules(section).length" class="mrk-grid mrk-grid-3" style="margin-top:24px;">
            <div v-for="mod in modules(section)" :key="mod" class="mrk-card">
              <h3>{{ mod }}</h3>
            </div>
          </div>
          <div v-else class="mrk-empty" style="margin-top:24px;">{{ $t('marketingCopy.noWorkflowModules') }}</div>
        </template>

        <template v-else-if="section.section_type === 'product'">
          <div class="mrk-grid mrk-grid-2">
            <div>
              <div v-if="productEyebrow(section) || section.subheading" class="mrk-eyebrow">{{ productEyebrow(section) || section.subheading }}</div>
              <h2>{{ section.heading || page?.title }}</h2>
              <p v-if="bodyText(section)" class="mrk-subheading">{{ bodyText(section) }}</p>
              <ul v-if="highlights(section).length" class="mrk-list">
                <li v-for="item in highlights(section)" :key="item">{{ item }}</li>
              </ul>
            </div>
            <div>
              <div v-if="stats(section).length" class="mrk-stats" style="margin-top:0;">
                <div v-for="stat in stats(section)" :key="stat.label + stat.value" class="mrk-stat">
                  <div class="mrk-stat-value">{{ stat.value || stat.label }}</div>
                  <div v-if="stat.value" class="mrk-stat-label">{{ stat.label }}</div>
                </div>
              </div>
              <div v-if="capabilities(section).length" class="mrk-grid" style="margin-top:16px;">
                <article v-for="cap in capabilities(section)" :key="cap.title + cap.body" class="mrk-card">
                  <h3>{{ cap.title }}</h3>
                  <p>{{ cap.body }}</p>
                </article>
              </div>
            </div>
          </div>
        </template>

        <template v-else-if="section.section_type === 'cta'">
          <div class="mrk-card mrk-center" style="padding:40px;">
            <div v-if="section.subheading" class="mrk-eyebrow">{{ section.subheading }}</div>
            <h2>{{ section.heading || $t('marketingCopy.getStarted') }}</h2>
            <p v-if="bodyText(section)" class="mrk-subheading" style="margin:0 auto;">{{ bodyText(section) }}</p>
            <div v-if="ctas(section).length" class="mrk-actions" style="justify-content:center;">
              <a
                v-for="cta in ctas(section)"
                :key="cta.label + cta.url"
                :href="cta.url"
                class="mrk-btn"
                :class="ctaPrimary(cta) ? 'mrk-btn-primary' : 'mrk-btn-secondary'"
              >{{ cta.label }}</a>
            </div>
          </div>
        </template>

        <template v-else-if="section.section_type === 'pricing'">
          <div class="mrk-center" style="margin-bottom:24px;">
            <div v-if="section.subheading" class="mrk-eyebrow">{{ section.subheading }}</div>
            <h2>{{ section.heading || $t('marketing.pricing') }}</h2>
            <p v-if="bodyText(section)" class="mrk-subheading" style="margin:0 auto;">{{ bodyText(section) }}</p>
          </div>
          <PricingExplorer />
        </template>

        <template v-else-if="section.section_type === 'mission'">
          <div class="mrk-card">
            <div class="mrk-eyebrow">{{ $t('marketingCopy.mission') }}</div>
            <h2>{{ section.heading || $t('marketingCopy.ourMission') }}</h2>
            <p class="mrk-subheading">{{ section.subheading || bodyText(section) || $t('marketingCopy.missionUnavailable') }}</p>
          </div>
        </template>

        <template v-else-if="section.section_type === 'pillars'">
          <div v-if="section.subheading" class="mrk-eyebrow">{{ section.subheading }}</div>
          <h2>{{ section.heading || $t('marketingCopy.pillars') }}</h2>
          <div v-if="items(section).length" class="mrk-grid mrk-grid-3" style="margin-top:20px;">
            <div v-for="item in items(section)" :key="item" class="mrk-card">
              <h3>{{ item }}</h3>
            </div>
          </div>
          <div v-else class="mrk-empty" style="margin-top:20px;">{{ $t('marketingCopy.noPillars') }}</div>
        </template>

        <template v-else-if="section.section_type === 'stats'">
          <div v-if="section.subheading" class="mrk-eyebrow">{{ section.subheading }}</div>
          <h2>{{ section.heading || $t('marketingCopy.stats') }}</h2>
          <div v-if="stats(section).length" class="mrk-stats">
            <div v-for="stat in stats(section)" :key="stat.label + stat.value" class="mrk-stat">
              <div class="mrk-stat-value">{{ stat.value || '—' }}</div>
              <div class="mrk-stat-label">{{ stat.label }}</div>
            </div>
          </div>
          <div v-else class="mrk-empty" style="margin-top:20px;">{{ $t('marketingCopy.noStats') }}</div>
        </template>

        <template v-else-if="section.section_type === 'global_presence'">
          <div class="mrk-card">
            <div v-if="section.subheading" class="mrk-eyebrow">{{ section.subheading }}</div>
            <h2>{{ section.heading || $t('marketingCopy.globalPresence') }}</h2>
            <p class="mrk-subheading">{{ bodyText(section) || $t('marketingCopy.globalPresenceUnavailable') }}</p>
          </div>
        </template>

        <template v-else-if="section.section_type === 'leadership'">
          <div v-if="section.subheading" class="mrk-eyebrow">{{ section.subheading }}</div>
          <h2>{{ section.heading || $t('marketingCopy.leadership') }}</h2>
          <div v-if="teamList.length" class="mrk-grid mrk-team-grid" style="margin-top:20px;">
            <article v-for="member in teamList" :key="member.id || member.name" class="mrk-card">
              <h3>{{ member.name }}</h3>
              <p class="mrk-pill" style="margin-bottom:10px;">{{ member.role }}</p>
              <p v-if="member.bio">{{ member.bio }}</p>
            </article>
          </div>
          <div v-else-if="leadershipMembers(section).length" class="mrk-grid mrk-team-grid" style="margin-top:20px;">
            <article v-for="member in leadershipMembers(section)" :key="member.name + member.role" class="mrk-card">
              <h3>{{ member.name }}</h3>
              <p class="mrk-pill">{{ member.role }}</p>
            </article>
          </div>
          <div v-else class="mrk-empty" style="margin-top:20px;">{{ $t('marketingCopy.noTeamMembers') }}</div>
        </template>

        <template v-else-if="section.section_type === 'booking'"></template>

        <template v-else>
          <div v-if="section.subheading" class="mrk-eyebrow">{{ section.subheading }}</div>
          <h2>{{ section.heading || page?.title || $t('marketingCopy.section') }}</h2>
          <p v-if="bodyText(section)" class="mrk-subheading">{{ bodyText(section) }}</p>
        </template>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { publicMarketingApi } from '@/api'
import { translateMarketing } from '@/composables/useMarketingContent'
import PricingExplorer from './PricingExplorer.vue'

const MarketingHeroScene = defineAsyncComponent(() => import('@/components/marketing/MarketingHeroScene.vue'))

const { t } = useI18n()

const props = defineProps({
  page: { type: Object, default: null },
  integrations: { type: Array, default: () => [] },
  teamMembers: { type: Array, default: () => [] },
  enableHeroScene: { type: Boolean, default: false },
})

const heroStage = ref(null)
const heroSceneVisible = ref(false)
let heroObserver = null

const contact = reactive({ name: '', email: '', business_name: '', business_address: '' })
const contactSubmitting = ref(false)
const contactError = ref('')
const contactSuccess = ref('')

function setHeroStage(element) {
  heroStage.value = element
}

onMounted(() => {
  if (!props.enableHeroScene || typeof window === 'undefined' || !heroStage.value) return
  const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  const smallQuery = window.matchMedia?.('(max-width: 960px)')
  if (motionQuery?.matches || smallQuery?.matches) return
  if (typeof navigator !== 'undefined') {
    if ((navigator.hardwareConcurrency || 99) <= 2 || (navigator.deviceMemory || 99) <= 2) return
  }
  if (typeof window.IntersectionObserver !== 'function') return
  heroObserver = new window.IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      heroSceneVisible.value = true
      heroObserver?.disconnect()
      heroObserver = null
    },
    { rootMargin: '120px' },
  )
  heroObserver.observe(heroStage.value)
})

onBeforeUnmount(() => {
  heroObserver?.disconnect()
  heroObserver = null
})

const activeSections = computed(() =>
  (props.page?.sections || []).filter((section) => section && section.is_active !== false),
)

const groupedIntegrations = computed(() => {
  const groups = new Map()
  for (const item of props.integrations || []) {
    const key = item.category || t('marketingCopy.other')
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(item)
  }
  return Array.from(groups.entries()).map(([category, items]) => ({ category, items }))
})

const teamList = computed(() => (props.teamMembers || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)))

const contactLabels = computed(() => {
  const section = (props.page?.sections || []).find((item) => item.section_type === 'contact')
  const values = labels(section)
  return {
    name: values[0] || t('marketingContact.name'),
    email: values[1] || t('marketingContact.email'),
    businessName: values[2] || t('marketingContact.businessName'),
    businessAddress: values[3] || t('marketingContact.businessAddress'),
    submit: values[4] || t('marketingContact.submit'),
  }
})

function sectionClass(section) {
  if (section.section_type === 'hero') return 'mrk-hero'
  if (section.section_type === 'cta') return 'mrk-section-dark'
  if (['integrations', 'workflow', 'pricing', 'pillars', 'stats', 'leadership'].includes(section.section_type)) return 'mrk-section-alt'
  return ''
}

function bodyData(section) {
  const body = section?.body_json
  return body && typeof body === 'object' ? body : {}
}

function bodyText(section) {
  const body = bodyData(section)
  if (typeof body.body === 'string') return body.body
  if (typeof section?.body_json === 'string') return section.body_json
  return ''
}

function heroBody(section) {
  return bodyText(section)
}

function ctas(section) {
  const list = bodyData(section).ctas
  if (!Array.isArray(list)) return []
  return list.filter((cta) => cta && cta.label && cta.url)
}

function ctaPrimary(cta) {
  return /demo|start|contact|book|onyesho|anza|wasiliana|uhifadhi/i.test(cta.label || '')
}

function labels(section) {
  const list = bodyData(section).labels
  return Array.isArray(list) ? list.filter(Boolean) : []
}

function modules(section) {
  const list = bodyData(section).modules
  return Array.isArray(list) ? list.filter(Boolean) : []
}

function items(section) {
  const list = bodyData(section).items
  return Array.isArray(list) ? list.filter(Boolean) : []
}

function highlights(section) {
  const list = bodyData(section).highlights
  return Array.isArray(list) ? list.filter(Boolean) : []
}

function capabilities(section) {
  const list = bodyData(section).capabilities
  return Array.isArray(list) ? list.filter((c) => c && c.title) : []
}

function stats(section) {
  const list = bodyData(section).stats
  return Array.isArray(list) ? list.filter((s) => s && (s.label || s.value)) : []
}

function productEyebrow(section) {
  return bodyData(section).eyebrow || ''
}

function leadershipMembers(section) {
  const list = bodyData(section).members
  return Array.isArray(list) ? list.filter((m) => m && m.name) : []
}

async function submitContact() {
  contactError.value = ''
  contactSuccess.value = ''
  contactSubmitting.value = true
  try {
    const res = await publicMarketingApi.contactSubmission({ ...contact })
    contactSuccess.value = translateMarketing(res.data?.message) || t('marketingCopy.messageSent')
    contact.name = ''
    contact.email = ''
    contact.business_name = ''
    contact.business_address = ''
  } catch (err) {
    const data = err?.response?.data
    if (data?.errors) {
      const first = Object.values(data.errors).flat().find(Boolean)
      contactError.value = translateMarketing(first || data.message) || t('marketingCopy.unableToSend')
    } else {
      contactError.value = translateMarketing(data?.message) || t('marketingCopy.unableToSend')
    }
  } finally {
    contactSubmitting.value = false
  }
}
</script>
