<!--
  PlansPage.vue — Superadmin plans & features management (editable).
  Displays subscription plan cards with inline editing for prices, descriptions,
  and feature toggles. Full CRUD via the PlanController API.
-->
<template>
  <div class="plans-page container">
    <div class="plans-header">
      <div>
        <h1>{{ $t('superadmin.plansTitle') }}</h1>
        <p class="muted">{{ $t('superadmin.plansSubtitle') }}</p>
      </div>
      <button class="btn btn-primary" @click="showCreateModal = true">
        <i class="fas fa-plus"></i> {{ $t('superadmin.newPlan') }}
      </button>
    </div>

    <div v-if="loading" class="loading-spinner"><div class="spinner"></div></div>

    <template v-else>
      <div v-if="error" class="alert alert-error">{{ error }}</div>
      <div v-if="success" class="alert alert-success">{{ success }}</div>

      <!-- Tier cards (editable) -->
      <div class="tiers-grid">
        <div
          v-for="plan in plansList"
          :key="plan.slug"
          class="tier-card"
          :class="`tier-card--${plan.client_tier}`"
        >
          <div class="tier-head">
            <span class="tier-badge" :class="`tier-badge--${plan.client_tier}`">{{ tierLabel(plan.client_tier) }}</span>
            <input
              v-model="plan.label"
              class="edit-input edit-input--name"
              @blur="savePlan(plan)"
              :placeholder="$t('superadmin.planNamePlaceholder')"
            />
            <div class="tier-price">
              <span class="tier-price-prefix">TZS</span>
              <input
                v-model.number="plan.price_monthly"
                type="number"
                class="edit-input edit-input--price"
                @change="savePlan(plan)"
                min="0"
              />
              <span class="tier-price-period">{{ $t('superadmin.perMonth') }}</span>
            </div>
            <div class="tier-trial">
              <label class="tier-trial-label">{{ $t('superadmin.trialPeriod') }}</label>
              <input
                v-model.number="plan.trial_days"
                type="number"
                class="edit-input edit-input--trial"
                @change="savePlan(plan)"
                min="0"
                max="365"
              />
              <span class="tier-trial-unit">{{ $t('superadmin.daysUnit') }}</span>
            </div>
            <textarea
              v-model="plan.description"
              class="edit-input edit-input--desc"
              @blur="savePlan(plan)"
              :placeholder="$t('superadmin.descriptionPlaceholder')"
              rows="2"
            ></textarea>
          </div>
          <div class="tier-features">
            <div class="tier-features-header">
              <h3>{{ $t('superadmin.includedFeatures') }} ({{ plan.features?.length || 0 }}/{{ allFeatureKeys.length }})</h3>
            </div>
            <ul class="tier-feature-list">
              <li
                v-for="featKey in allFeatureKeys"
                :key="featKey"
                class="tier-feature-item"
                :class="{ 'tier-feature-item--on': (plan.features || []).includes(featKey) }"
                @click="toggleFeature(plan, featKey)"
                :title="$t('superadmin.clickToToggle')"
              >
                <i
                  v-if="(plan.features || []).includes(featKey)"
                  class="fas fa-check-circle check-yes"
                ></i>
                <i v-else class="fas fa-times-circle check-no"></i>
                <span>{{ featureLabel(featKey) }}</span>
              </li>
            </ul>
          </div>
          <div class="tier-actions">
            <label class="toggle-label">
              <input type="checkbox" v-model="plan.is_active" @change="savePlan(plan)" />
              <span>{{ $t('superadmin.activeLabel') }}</span>
            </label>
            <button class="btn btn-sm btn-danger" @click="deletePlan(plan)" :disabled="plan._saving">
              <i class="fas fa-trash"></i> {{ $t('superadmin.deleteLabel') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Feature comparison matrix -->
      <div class="card comparison-card">
        <h2 class="card-title"><i class="fas fa-table"></i> {{ $t('superadmin.featureComparison') }}</h2>
        <div class="comparison-table-wrap">
          <table class="comparison-table">
            <thead>
              <tr>
                <th>{{ $t('superadmin.featureLabel') }}</th>
                <th v-for="plan in plansList" :key="plan.slug" class="comparison-plan-header">
                  {{ plan.label }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(info, featKey) in featureLabels" :key="featKey">
                <td>
                  <strong>{{ info.label }}</strong>
                  <br /><span class="muted">{{ info.description }}</span>
                </td>
                <td v-for="plan in plansList" :key="plan.slug" class="comparison-check">
                  <i v-if="(plan.features || []).includes(featKey)" class="fas fa-check-circle check-yes"></i>
                  <i v-else class="fas fa-times-circle check-no"></i>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- Create plan modal -->
    <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
      <div class="modal-content">
        <h2>{{ $t('superadmin.createNewPlan') }}</h2>
        <div class="form-group">
          <label>{{ $t('superadmin.slugLabel') }}</label>
          <input v-model="newPlan.slug" class="form-control" :placeholder="$t('superadmin.slugPlaceholder')" />
        </div>
        <div class="form-group">
          <label>{{ $t('superadmin.labelField') }}</label>
          <input v-model="newPlan.label" class="form-control" :placeholder="$t('superadmin.labelPlaceholder')" />
        </div>
        <div class="form-group">
          <label>{{ $t('superadmin.descriptionField') }}</label>
          <textarea v-model="newPlan.description" class="form-control" rows="2"></textarea>
        </div>
        <div class="form-group">
          <label>{{ $t('superadmin.priceMonthLabel') }}</label>
          <input v-model.number="newPlan.price_monthly" type="number" class="form-control" min="0" />
        </div>
        <div class="form-group">
          <label>{{ $t('superadmin.trialPeriodDays') }}</label>
          <input v-model.number="newPlan.trial_days" type="number" class="form-control" min="0" max="365" />
        </div>
        <div class="form-group">
          <label>{{ $t('superadmin.clientTierLabel') }}</label>
          <select v-model="newPlan.client_tier" class="form-control">
            <option value="small">{{ $t('superadmin.tierSmall') }}</option>
            <option value="medium">{{ $t('superadmin.tierMedium') }}</option>
            <option value="large">{{ $t('superadmin.tierLarge') }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>{{ $t('superadmin.featuresLabel') }}</label>
          <div class="modal-features">
            <label v-for="(info, key) in featureLabels" :key="key" class="modal-feature-check">
              <input type="checkbox" :value="key" v-model="newPlan.features" />
              {{ info.label }}
            </label>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="showCreateModal = false">{{ $t('superadmin.cancelLabel') }}</button>
          <button class="btn btn-primary" @click="createPlan" :disabled="!newPlan.slug || !newPlan.label">
            <i class="fas fa-plus"></i> {{ $t('superadmin.createPlanBtn') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { planApi } from '@/api'

const { t } = useI18n()

const plansList = ref([])
const featureLabels = ref({})
const loading = ref(true)
const error = ref(null)
const success = ref(null)
const showCreateModal = ref(false)
const newPlan = reactive({
  slug: '',
  label: '',
  description: '',
  price_monthly: 0,
  trial_days: 14,
  client_tier: 'small',
  features: [],
})

const allFeatureKeys = computed(() => Object.keys(featureLabels.value))

function tierLabel(tier) {
  return { small: t('superadmin.starter'), medium: t('superadmin.growth'), large: t('superadmin.enterprisePlan') }[tier] || tier
}

function featureLabel(key) {
  return featureLabels.value[key]?.label || key
}

function toggleFeature(plan, featKey) {
  const idx = (plan.features || []).indexOf(featKey)
  if (idx >= 0) {
    plan.features.splice(idx, 1)
  } else {
    plan.features.push(featKey)
  }
  savePlan(plan)
}

async function savePlan(plan) {
  if (plan._saving) return
  plan._saving = true
  error.value = null
  success.value = null
  try {
    await planApi.update(plan.slug, {
      label: plan.label,
      description: plan.description,
      price_monthly: plan.price_monthly,
      price_yearly: plan.price_monthly * 10,
      trial_days: plan.trial_days,
      client_tier: plan.client_tier,
      features: plan.features,
      is_active: plan.is_active,
    })
    success.value = t('superadmin.planUpdated', { name: plan.label })
    setTimeout(() => { success.value = null }, 3000)
  } catch (e) {
    error.value = e.response?.data?.message || t('superadmin.failedToSavePlan')
  } finally {
    plan._saving = false
  }
}

async function deletePlan(plan) {
  if (!confirm(t('superadmin.confirmDeletePlan', { name: plan.label }))) return
  error.value = null
  try {
    await planApi.destroy(plan.slug)
    plansList.value = plansList.value.filter((p) => p.slug !== plan.slug)
  } catch (e) {
    error.value = e.response?.data?.message || t('superadmin.failedToDeletePlan')
  }
}

async function createPlan() {
  error.value = null
  try {
    const { data } = await planApi.store({
      slug: newPlan.slug,
      label: newPlan.label,
      description: newPlan.description,
      price_monthly: newPlan.price_monthly,
      price_yearly: newPlan.price_monthly * 10,
      trial_days: newPlan.trial_days,
      client_tier: newPlan.client_tier,
      features: newPlan.features,
    })
    plansList.value.push(data.plan)
    showCreateModal.value = false
    // Reset form
    Object.assign(newPlan, { slug: '', label: '', description: '', price_monthly: 0, trial_days: 14, client_tier: 'small', features: [] })
  } catch (e) {
    error.value = e.response?.data?.message || t('superadmin.failedToCreatePlan')
  }
}

onMounted(async () => {
  try {
    const { data } = await planApi.index()
    plansList.value = data.plans.map((p) => ({ ...p, _saving: false }))
    featureLabels.value = data.feature_labels
  } catch {
    error.value = t('superadmin.failedToLoadPlans')
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.plans-page { padding: 32px 20px; }
.plans-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
.plans-header h1 { font-size: 28px; font-weight: 800; margin: 0 0 4px; }

.tiers-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-bottom: 40px; }
.tier-card { border-radius: 12px; overflow: hidden; border: 2px solid #e2e8f0; background: #fff; display: flex; flex-direction: column; }
.tier-card--small { border-color: #93c5fd; }
.tier-card--medium { border-color: #34d399; }
.tier-card--large { border-color: #8b5cf6; }
.tier-head { padding: 24px; text-align: center; }
.tier-badge { display: inline-block; padding: 3px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px; }
.tier-badge--small { background: #dbeafe; color: #2563eb; }
.tier-badge--medium { background: #d1fae5; color: #059669; }
.tier-badge--large { background: #ede9fe; color: #7c3aed; }
.tier-price { margin: 12px 0; display: flex; align-items: baseline; justify-content: center; gap: 4px; }
.tier-price-prefix { font-size: 16px; font-weight: 600; color: #64748b; }
.tier-price-period { font-size: 14px; color: #64748b; }
.tier-trial { display: flex; align-items: center; justify-content: center; gap: 6px; margin: 8px 0 4px; font-size: 13px; color: #64748b; }
.tier-trial-label { font-weight: 500; }
.tier-trial-unit { color: #94a3b8; }

/* Editable inputs */
.edit-input { border: 1px solid transparent; background: transparent; text-align: center; font-family: inherit; border-radius: 6px; padding: 4px 8px; transition: border 0.15s; width: 100%; box-sizing: border-box; }
.edit-input:hover { border-color: #e2e8f0; }
.edit-input:focus { outline: none; border-color: #3b82f6; background: #f8fafc; }
.edit-input--name { font-size: 22px; font-weight: 700; }
.edit-input--price { font-size: 28px; font-weight: 800; width: 160px; text-align: right; }
.edit-input--trial { font-size: 14px; font-weight: 600; width: 60px; text-align: center; }
.edit-input--desc { font-size: 13px; color: #64748b; resize: none; line-height: 1.5; }

.tier-features { flex: 1; padding: 0 24px 24px; }
.tier-features-header { border-top: 1px solid #e2e8f0; padding-top: 16px; margin-bottom: 12px; }
.tier-features-header h3 { margin: 0; font-size: 13px; font-weight: 600; color: #334155; }
.tier-feature-list { list-style: none; padding: 0; margin: 0 0 12px; }
.tier-feature-item { display: flex; align-items: center; gap: 8px; padding: 5px 8px; font-size: 13px; color: #94a3b8; border-radius: 6px; cursor: pointer; transition: background 0.15s, color 0.15s; }
.tier-feature-item:hover { background: #f1f5f9; }
.tier-feature-item--on { color: #334155; }
.tier-feature-item--on:hover { background: #f0fdf4; }
.tier-feature-item .check-yes { font-size: 13px; }
.tier-feature-item .check-no { font-size: 13px; }

.tier-actions { padding: 12px 24px 20px; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
.toggle-label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #475569; cursor: pointer; }
.toggle-label input { width: 16px; height: 16px; accent-color: #10b981; }
.btn-sm { padding: 6px 12px; font-size: 12px; }

/* Comparison table */
.comparison-card { margin-bottom: 40px; }
.comparison-table-wrap { overflow-x: auto; }
.comparison-table { width: 100%; border-collapse: collapse; }
.comparison-table th, .comparison-table td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
.comparison-table thead th { background: #f8fafc; font-weight: 600; color: #334155; }
.comparison-plan-header { text-align: center !important; }
.comparison-check { text-align: center !important; }
.check-yes { color: #10b981; font-size: 16px; }
.check-no { color: #ef4444; font-size: 16px; }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal-content { background: #fff; border-radius: 12px; padding: 32px; width: 90%; max-width: 500px; max-height: 85vh; overflow-y: auto; }
.modal-content h2 { margin: 0 0 20px; font-size: 20px; font-weight: 700; }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 4px; }
.form-control { width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px; box-sizing: border-box; }
.form-control:focus { outline: none; border-color: #3b82f6; }
.modal-features { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; max-height: 200px; overflow-y: auto; }
.modal-feature-check { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #334155; cursor: pointer; }
.modal-feature-check input { width: 14px; height: 14px; accent-color: #3b82f6; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }

.alert-error { background: #fef2f2; color: #dc2626; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; }
.alert-success { background: #d1fae5; color: #059669; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; }
.loading-spinner { display: flex; justify-content: center; padding: 80px 20px; }
.spinner { width: 40px; height: 40px; border: 3px solid #e2e8f0; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 900px) { .tiers-grid { grid-template-columns: 1fr; } }
</style>
