<!--
  Public pricing page (route: /pricing, name: public-pricing).
  Shows the three SaaS tiers (Starter / Growth / Enterprise) with features
  and pricing. No authentication required — this is a marketing page.
-->
<template>
  <div class="pricing-page">
    <section class="pricing-hero">
      <h1>Simple, transparent pricing</h1>
      <p>Choose the plan that fits your hotel. Upgrade or downgrade anytime.</p>
    </section>

    <div v-if="loading" class="pricing-loading">
      <div class="spinner"></div>
    </div>

    <section v-else class="pricing-grid container">
      <div
        v-for="(plan, slug) in plans"
        :key="slug"
        class="pricing-card"
        :class="{ 'pricing-card--popular': plan.client_tier === 'medium' }"
      >
        <div v-if="plan.client_tier === 'medium'" class="popular-badge">Most Popular</div>
        <div class="pricing-card-head">
          <h2>{{ plan.label }}</h2>
          <p class="pricing-desc">{{ plan.description }}</p>
          <div class="pricing-amount">
            <span class="pricing-currency">TZS</span>
            <span class="pricing-value">{{ Number(plan.price_monthly).toLocaleString() }}</span>
            <span class="pricing-period">/month</span>
          </div>
        </div>
        <div class="pricing-features">
          <h3>Included features</h3>
          <ul>
            <li v-for="feat in plan.features" :key="feat">
              <i class="fas fa-check"></i> {{ featureLabel(feat) }}
            </li>
          </ul>
          <div v-if="excludedFeatures(slug).length" class="pricing-excluded">
            <h3>Not included</h3>
            <ul>
              <li v-for="feat in excludedFeatures(slug)" :key="feat">
                <i class="fas fa-xmark"></i> {{ featureLabel(feat) }}
              </li>
            </ul>
          </div>
        </div>
        <div class="pricing-card-foot">
          <router-link :to="{ name: 'portal-register', query: { plan: slug } }" class="btn btn-primary btn-block">
            Get Started
          </router-link>
        </div>
      </div>
    </section>

    <section class="pricing-faq container">
      <h2>Frequently asked questions</h2>
      <div class="faq-grid">
        <div class="faq-item">
          <h3>Can I switch plans later?</h3>
          <p>Yes. Upgrade or downgrade anytime from your dashboard. Changes take effect immediately and billing is prorated.</p>
        </div>
        <div class="faq-item">
          <h3>Is there a free trial?</h3>
          <p>Every new hotel gets a free trial with full Enterprise features. No credit card required.</p>
        </div>
        <div class="faq-item">
          <h3>What payment methods do you accept?</h3>
          <p>We accept M-Pesa, Tigo Pesa, Airtel Money, bank transfers, and card payments via ClickPesa.</p>
        </div>
        <div class="faq-item">
          <h3>Can I add more hotels later?</h3>
          <p>Enterprise plan supports multi-hotel management from a single account. Contact us for custom arrangements.</p>
        </div>
      </div>
    </section>

    <section class="pricing-cta container">
      <h2>Ready to get started?</h2>
      <p>Create your free account and start managing your hotel today.</p>
      <router-link :to="{ name: 'portal-register' }" class="btn btn-primary btn-lg">
        <i class="fas fa-rocket"></i> Start Free Trial
      </router-link>
    </section>
  </div>

  <!-- Floating tooltip -->
  <Transition name="tooltip">
    <div v-if="showTooltip" class="floating-tooltip">
      <button class="tooltip-close" @click="dismissTooltip" aria-label="Close">
        <i class="fas fa-xmark"></i>
      </button>
      <div class="tooltip-icon">
        <i class="fas fa-cloud"></i>
      </div>
      <div class="tooltip-body">
        <strong>Welcome to TSCL</strong>
        <p>
          A cloud-based hotel management platform. Manage reservations, rooms,
          guests, payments, and staff — all in one place. Start your
          <strong>free trial</strong> today, no credit card required.
        </p>
        <router-link :to="{ name: 'portal-register' }" class="tooltip-cta">
          Get Started <i class="fas fa-arrow-right"></i>
        </router-link>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { planApi } from '@/api'

const plans = ref({})
const featureLabels = ref({})
const loading = ref(true)
const showTooltip = ref(false)
let tooltipTimer = null

const STORAGE_KEY = 'tscl_pricing_tooltip_dismissed'

function dismissTooltip() {
  showTooltip.value = false
  try { sessionStorage.setItem(STORAGE_KEY, '1') } catch {
    // private browsing may block storage; the tooltip just stays visible
  }
}

function featureLabel(key) {
  return featureLabels.value?.[key]?.label || key
}

function excludedFeatures(planSlug) {
  const plan = plans.value[planSlug]
  if (!plan) return []
  return allFeatureKeys.value.filter((f) => !plan.features.includes(f))
}

const allFeatureKeys = computed(() => Object.keys(featureLabels.value ?? {}))

onMounted(async () => {
  try {
    const { data } = await planApi.publicIndex()
    if (Array.isArray(data.plans)) {
      const keyed = {}
      data.plans.forEach((p) => { keyed[p.slug] = p })
      plans.value = keyed
    } else {
      plans.value = data.plans
    }
    featureLabels.value = data.feature_labels
  } catch {
    // Use empty state — page still renders gracefully.
  } finally {
    loading.value = false
  }

  // Show tooltip after 2s unless dismissed this session
  const dismissed = sessionStorage.getItem(STORAGE_KEY)
  if (!dismissed) {
    tooltipTimer = setTimeout(() => { showTooltip.value = true }, 2000)
  }
})

onUnmounted(() => { if (tooltipTimer) clearTimeout(tooltipTimer) })
</script>

<style scoped>
.pricing-page {
  background: #f8fafc;
  min-height: 100vh;
}

/* Hero */
.pricing-hero {
  text-align: center;
  padding: 60px 20px 40px;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #fff;
}

.pricing-hero h1 {
  font-size: 36px;
  font-weight: 800;
  margin: 0 0 12px;
}

.pricing-hero p {
  font-size: 18px;
  color: #94a3b8;
  margin: 0;
}

/* Loading */
.pricing-loading {
  display: flex;
  justify-content: center;
  padding: 80px 20px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e2e8f0;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Grid */
.pricing-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  padding: 48px 20px;
  max-width: 1100px;
  margin: 0 auto;
}

/* Card */
.pricing-card {
  position: relative;
  background: #fff;
  border: 2px solid #e2e8f0;
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: transform 0.2s, box-shadow 0.2s;
}

.pricing-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08);
}

.pricing-card--popular {
  border-color: #3b82f6;
  box-shadow: 0 4px 24px rgba(59, 130, 246, 0.15);
}

.popular-badge {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  background: #3b82f6;
  color: #fff;
  text-align: center;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 6px;
}

.pricing-card-head {
  padding: 32px 24px 24px;
  text-align: center;
}

.pricing-card--popular .pricing-card-head {
  padding-top: 48px;
}

.pricing-card-head h2 {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 8px;
  color: #1e293b;
}

.pricing-desc {
  font-size: 14px;
  color: #64748b;
  margin: 0 0 20px;
  line-height: 1.5;
}

.pricing-amount {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
}

.pricing-currency {
  font-size: 18px;
  font-weight: 600;
  color: #64748b;
}

.pricing-value {
  font-size: 40px;
  font-weight: 800;
  color: #1e293b;
}

.pricing-period {
  font-size: 14px;
  color: #94a3b8;
}

/* Features */
.pricing-features {
  flex: 1;
  padding: 0 24px 24px;
}

.pricing-features h3 {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #94a3b8;
  margin: 16px 0 8px;
  padding-top: 16px;
  border-top: 1px solid #f1f5f9;
}

.pricing-features ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.pricing-features li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  font-size: 13px;
  color: #334155;
}

.pricing-features li i.fa-check {
  color: #10b981;
  font-size: 12px;
  flex-shrink: 0;
}

.pricing-excluded li {
  color: #94a3b8;
}

.pricing-excluded li i.fa-xmark {
  color: #ef4444;
}

/* CTA button */
.pricing-card-foot {
  padding: 16px 24px 24px;
}

.btn-block {
  display: block;
  width: 100%;
  text-align: center;
  text-decoration: none;
}

.btn-primary {
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-primary:hover {
  background: #2563eb;
}

/* FAQ */
.pricing-faq {
  padding: 60px 20px;
  max-width: 900px;
  margin: 0 auto;
}

.pricing-faq h2 {
  text-align: center;
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 32px;
  color: #1e293b;
}

.faq-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
}

.faq-item {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 20px;
}

.faq-item h3 {
  font-size: 15px;
  font-weight: 700;
  margin: 0 0 8px;
  color: #1e293b;
}

.faq-item p {
  font-size: 13px;
  color: #64748b;
  line-height: 1.6;
  margin: 0;
}

/* Bottom CTA */
.pricing-cta {
  text-align: center;
  padding: 60px 20px;
}

.pricing-cta h2 {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 12px;
  color: #1e293b;
}

.pricing-cta p {
  font-size: 16px;
  color: #64748b;
  margin: 0 0 24px;
}

.btn-lg {
  padding: 16px 32px;
  font-size: 16px;
}

@media (max-width: 900px) {
  .pricing-grid {
    grid-template-columns: 1fr;
    max-width: 420px;
  }
  .faq-grid {
    grid-template-columns: 1fr;
  }
}

/* Floating tooltip */
.floating-tooltip {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #fff;
  border-radius: 16px;
  padding: 20px;
  max-width: 340px;
  box-shadow: 0 12px 40px rgba(26, 26, 46, 0.35);
  display: flex;
  gap: 14px;
  align-items: flex-start;
  animation: tooltip-float 3s ease-in-out infinite;
}

.tooltip-close {
  position: absolute;
  top: 8px;
  right: 10px;
  background: none;
  border: none;
  color: rgba(255,255,255,0.5);
  font-size: 14px;
  cursor: pointer;
  padding: 4px;
  line-height: 1;
  transition: color 0.2s;
}
.tooltip-close:hover { color: #fff; }

.tooltip-icon {
  flex-shrink: 0;
  width: 42px;
  height: 42px;
  background: rgba(59,130,246,0.25);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: #60a5fa;
  animation: tooltip-pulse 2s ease-in-out infinite;
}

.tooltip-body strong {
  display: block;
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 6px;
}

.tooltip-body p {
  font-size: 13px;
  line-height: 1.55;
  color: #cbd5e1;
  margin: 0 0 12px;
}

.tooltip-cta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #3b82f6;
  color: #fff;
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 16px;
  border-radius: 8px;
  transition: background 0.15s;
}
.tooltip-cta:hover { background: #2563eb; }

@keyframes tooltip-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

@keyframes tooltip-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.08); opacity: 0.85; }
}

/* Transition */
.tooltip-enter-active { transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
.tooltip-leave-active { transition: all 0.25s ease-in; }
.tooltip-enter-from { opacity: 0; transform: translateY(20px) scale(0.95); }
.tooltip-leave-to { opacity: 0; transform: translateY(10px) scale(0.97); }

@media (max-width: 600px) {
  .floating-tooltip {
    bottom: 0;
    right: 0;
    left: 0;
    max-width: 100%;
    border-radius: 16px 16px 0 0;
    animation: tooltip-sheet-in 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }
  @keyframes tooltip-sheet-in {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }
}
</style>
