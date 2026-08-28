<!--
  PortalSubscription — customer's subscription management (route: /portal/subscription).
  Shows current plan, trial status, and upgrade options.
-->
<template>
  <div class="portal-subscription">
    <div v-if="loading" class="loading-spinner"><div class="spinner"></div></div>
    <template v-else>
      <!-- Current plan card -->
      <div class="current-plan card">
        <div class="current-plan-header">
          <div>
            <h2>Your Plan: <span class="plan-name" :class="`plan-name--${currentPlan?.slug}`">{{ currentPlan?.label || 'Trial' }}</span></h2>
            <p class="muted">{{ currentPlan?.description }}</p>
          </div>
          <div class="current-plan-price">
            <span class="price-amount">TZS {{ (currentPlan?.price_monthly || 0).toLocaleString() }}</span>
            <span class="price-period">/month</span>
          </div>
        </div>
        <div class="current-plan-meta">
          <div class="meta-item">
            <span class="meta-label">Status</span>
            <span class="meta-value"><span class="status-dot" :class="`status-dot--${tenant?.subscription_status}`"></span>{{ tenant?.subscription_status }}</span>
          </div>
          <div v-if="tenant?.subscription_status === 'trial'" class="meta-item">
            <span class="meta-label">Trial Ends</span>
            <span class="meta-value">{{ trialEndDate }}</span>
          </div>
          <div v-if="tenant?.renewal_at" class="meta-item">
            <span class="meta-label">Next Renewal</span>
            <span class="meta-value">{{ formatDate(tenant.renewal_at) }}</span>
          </div>
          <div v-if="tenant?.grace_ends_at" class="meta-item">
            <span class="meta-label">Grace Period Ends</span>
            <span class="meta-value meta-value--warning">{{ formatDate(tenant.grace_ends_at) }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Enabled Features</span>
            <span class="meta-value">{{ tenant?.features?.length || 0 }} features</span>
          </div>
        </div>
      </div>

      <!-- Available plans -->
      <h2 class="section-title">Upgrade Your Plan</h2>
      <div class="plans-grid">
        <div
          v-for="plan in plans"
          :key="plan.slug"
          class="plan-card"
          :class="{
            'plan-card--current': plan.slug === tenant?.subscription_plan,
            'plan-card--recommended': plan.slug === 'growth' && plan.slug !== tenant?.subscription_plan,
          }"
        >
          <div v-if="plan.slug !== tenant?.subscription_plan && plan.slug === 'growth'" class="recommended-badge">Recommended</div>
          <div v-if="plan.slug === tenant?.subscription_plan" class="current-badge">Current Plan</div>
          <h3>{{ plan.label }}</h3>
          <div class="plan-price">
            <span class="plan-price-value">TZS {{ plan.price_monthly.toLocaleString() }}</span>
            <span class="plan-price-period">/month</span>
          </div>
          <p class="plan-desc">{{ plan.description }}</p>
          <ul class="plan-features">
            <li v-for="feat in (plan.features || []).slice(0, 8)" :key="feat">
              <i class="fas fa-check"></i> {{ featureLabel(feat) }}
            </li>
            <li v-if="(plan.features || []).length > 8" class="more-features">
              +{{ plan.features.length - 8 }} more features
            </li>
          </ul>
          <button
            v-if="plan.slug !== tenant?.subscription_plan"
            class="btn btn-primary btn-block"
            @click="upgrade(plan.slug)"
            :disabled="upgrading"
          >
            {{ plan.price_monthly > (currentPlan?.price_monthly || 0) ? 'Upgrade' : 'Downgrade' }} to {{ plan.label }}
          </button>
          <div v-else class="current-plan-label">Your current plan</div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { planApi, portalSubscriptionApi } from '@/api'

const authStore = useAuthStore()
const loading = ref(true)
const upgrading = ref(false)
const plans = ref([])
const featureLabels = ref({})
const tenant = ref(null)

const currentPlan = computed(() => plans.value.find((p) => p.slug === tenant.value?.subscription_plan))

const trialEndDate = computed(() => {
  if (!tenant.value?.trial_ends_at) return '—'
  return new Date(tenant.value.trial_ends_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
})

function featureLabel(key) {
  return featureLabels.value[key]?.label || key
}

async function upgrade(planSlug) {
  if (!confirm(`Switch to ${planSlug} plan? You'll need to complete payment to activate.`)) return
  upgrading.value = true
  try {
    const { data } = await portalSubscriptionApi.update({ plan: planSlug })
    tenant.value.subscription_plan = planSlug
    tenant.value.subscription_status = data.subscription?.status || tenant.value.subscription_status
    tenant.value.features = data.subscription?.features || tenant.value.features
  } catch (e) {
    alert(e.response?.data?.message || 'Failed to update plan.')
  } finally {
    upgrading.value = false
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

onMounted(async () => {
  try {
    tenant.value = authStore.user?.tenant
    const { data } = await planApi.publicIndex()
    const rawPlans = Array.isArray(data.plans) ? data.plans : Object.values(data.plans)
    plans.value = rawPlans
    featureLabels.value = data.feature_labels
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.portal-subscription { max-width: 1100px; }

.current-plan { margin-bottom: 32px; }
.current-plan-header { display: flex; justify-content: space-between; align-items: flex-start; }
.current-plan-header h2 { font-size: 20px; font-weight: 700; margin: 0 0 4px; }
.muted { color: #64748b; font-size: 13px; margin: 0; }
.plan-name { font-weight: 800; }
.plan-name--starter { color: #2563eb; }
.plan-name--growth { color: #059669; }
.plan-name--enterprise { color: #7c3aed; }
.current-plan-price { text-align: right; }
.price-amount { font-size: 24px; font-weight: 800; color: #1e293b; }
.price-period { font-size: 13px; color: #64748b; }
.current-plan-meta { display: flex; gap: 32px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #f1f5f9; }
.meta-label { display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #94a3b8; margin-bottom: 2px; }
.meta-value { font-size: 13px; color: #334155; font-weight: 500; display: flex; align-items: center; gap: 6px; }
.meta-value--warning { color: #dc2626; font-weight: 600; }
.status-dot { width: 8px; height: 8px; border-radius: 50%; }
.status-dot--active { background: #10b981; }
.status-dot--trial { background: #f59e0b; }

.section-title { font-size: 20px; font-weight: 700; margin: 0 0 16px; }
.plans-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }

.plan-card {
  position: relative;
  background: #fff;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  padding: 24px;
  display: flex;
  flex-direction: column;
}
.plan-card--current { border-color: #3b82f6; }
.plan-card--recommended { border-color: #10b981; }
.recommended-badge, .current-badge {
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  padding: 2px 12px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}
.recommended-badge { background: #d1fae5; color: #059669; }
.current-badge { background: #dbeafe; color: #2563eb; }

.plan-card h3 { font-size: 18px; font-weight: 700; margin: 0 0 12px; }
.plan-price { margin-bottom: 8px; }
.plan-price-value { font-size: 28px; font-weight: 800; color: #1e293b; }
.plan-price-period { font-size: 13px; color: #64748b; }
.plan-desc { font-size: 13px; color: #64748b; line-height: 1.5; margin: 0 0 16px; }
.plan-features { list-style: none; padding: 0; margin: 0 0 20px; flex: 1; }
.plan-features li { display: flex; align-items: center; gap: 8px; padding: 5px 0; font-size: 13px; color: #334155; }
.plan-features li i { color: #10b981; font-size: 12px; }
.more-features { color: #94a3b8; font-size: 12px; }

.current-plan-label { text-align: center; padding: 10px; font-size: 13px; font-weight: 600; color: #3b82f6; background: #eff6ff; border-radius: 8px; }

.btn-block { display: block; width: 100%; text-align: center; }
.btn-primary { background: #3b82f6; color: #fff; border: none; border-radius: 8px; padding: 10px 20px; font-size: 14px; font-weight: 600; cursor: pointer; }
.btn-primary:hover { background: #2563eb; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.loading-spinner { display: flex; justify-content: center; padding: 80px 20px; }
.spinner { width: 40px; height: 40px; border: 3px solid #e2e8f0; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 900px) { .plans-grid { grid-template-columns: 1fr; } }
</style>
