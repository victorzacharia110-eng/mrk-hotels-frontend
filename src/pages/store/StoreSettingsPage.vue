<!-- StoreSettingsPage — tabbed store, receipt, printer and tax settings. -->
<template>
  <div class="sm-page">
    <div class="tabs">
      <button v-for="tab in tabs" :key="tab" class="tab" :class="{ active: activeTab === tab }" @click="activeTab = tab">
        {{ $t('storeManager.settings.tabs.' + tab) }}
      </button>
    </div>
    <section class="panel">
      <div v-if="loading" class="sm-loading"><i class="fas fa-circle-notch"></i> {{ $t('common.loading') }}</div>
      <form v-else class="settings-form" @submit.prevent="save">
        <template v-if="activeTab === 'store'">
          <label class="fld"><span>{{ $t('storeManager.settings.storeName') }}</span><input v-model="form.store_name" class="sm-input" /></label>
          <label class="fld"><span>{{ $t('common.phone') }}</span><input v-model="form.phone" class="sm-input" /></label>
          <label class="fld"><span>{{ $t('common.email') }}</span><input v-model="form.email" class="sm-input" /></label>
          <label class="fld"><span>{{ $t('common.address') }}</span><input v-model="form.address" class="sm-input" /></label>
          <label class="fld"><span>{{ $t('storeManager.settings.currency') }}</span><input v-model="form.currency" class="sm-input" /></label>
        </template>
        <template v-else-if="activeTab === 'receipt'">
          <label class="fld"><span>{{ $t('storeManager.settings.receiptHeader') }}</span><textarea v-model="form.receipt_header" class="sm-input" rows="2"></textarea></label>
          <label class="fld"><span>{{ $t('storeManager.settings.receiptFooter') }}</span><textarea v-model="form.receipt_footer" class="sm-input" rows="2"></textarea></label>
          <label class="fld check"><input v-model="form.show_logo" type="checkbox" /> <span>{{ $t('storeManager.settings.showLogo') }}</span></label>
        </template>
        <template v-else-if="activeTab === 'printer'">
          <label class="fld"><span>{{ $t('storeManager.settings.printerName') }}</span><input v-model="form.printer_name" class="sm-input" /></label>
          <label class="fld"><span>{{ $t('storeManager.settings.paperWidth') }}</span>
            <select v-model="form.paper_width" class="sm-select"><option value="58">58mm</option><option value="80">80mm</option><option value="a4">A4</option></select>
          </label>
          <label class="fld check"><input v-model="form.auto_print" type="checkbox" /> <span>{{ $t('storeManager.settings.autoPrint') }}</span></label>
        </template>
        <template v-else>
          <label class="fld"><span>{{ $t('storeManager.settings.taxRate') }}</span><input v-model.number="form.tax_rate" type="number" min="0" max="100" step="0.1" class="sm-input" /></label>
          <label class="fld check"><input v-model="form.prices_include_tax" type="checkbox" /> <span>{{ $t('storeManager.settings.pricesIncludeTax') }}</span></label>
        </template>
        <p v-if="message" class="sm-ok">{{ message }}</p>
        <p v-if="formError" class="sm-error">{{ formError }}</p>
        <div class="sm-modal-foot"><button class="sm-btn" type="submit" :disabled="saving">{{ saving ? $t('common.saving') : $t('common.save') }}</button></div>
      </form>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeApi } from '../../api'

const { t } = useI18n()
const tabs = ['store', 'receipt', 'printer', 'tax']
const activeTab = ref('store')
const loading = ref(false)
const saving = ref(false)
const message = ref('')
const formError = ref('')
const form = reactive({
  store_name: '', phone: '', email: '', address: '', currency: 'TZS',
  receipt_header: '', receipt_footer: '', show_logo: true,
  printer_name: '', paper_width: '80', auto_print: false,
  tax_rate: 18, prices_include_tax: false,
})

async function load() {
  loading.value = true
  try { const res = await storeApi.settings(); Object.assign(form, res.data.data || res.data || {}) } catch { /* defaults */ } finally { loading.value = false }
}
async function save() {
  saving.value = true; message.value = ''; formError.value = ''
  try { await storeApi.updateSettings(form); message.value = t('storeManager.settings.saved') }
  catch (e) { formError.value = e.response?.data?.message || t('common.error') } finally { saving.value = false }
}
onMounted(load)
</script>

<style scoped>
.tabs { display: flex; gap: 4px; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; }
.tab { padding: 8px 16px; border: none; background: none; cursor: pointer; font-weight: 600; color: #64748b; border-bottom: 2px solid transparent; }
.tab.active { color: #005eb8; border-bottom-color: #005eb8; }
.settings-form { display: flex; flex-direction: column; gap: 12px; max-width: 520px; }
.fld.check { flex-direction: row; align-items: center; gap: 8px; }
.sm-ok { color: #16a34a; }
</style>
