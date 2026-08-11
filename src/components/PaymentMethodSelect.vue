<template>
  <div class="form-group">
    <label :for="`${uid}-method`">
      {{ $t('paymentFields.method') }}<span v-if="required" class="req">*</span>
    </label>
    <SearchableSelect
      :id="`${uid}-method`"
      :model-value="method"
      :options="methodOptions"
      :required="required"
      :disabled="disabled"
      @update:model-value="onMethodChange"
    />
  </div>

  <!-- Only mobile money and banks have a provider to choose. -->
  <div v-if="providers.length" class="form-group">
    <label :for="`${uid}-provider`">
      {{ providerLabel }}<span class="req">*</span>
    </label>
    <SearchableSelect
      :id="`${uid}-provider`"
      :model-value="provider"
      :options="providerOptions"
      :empty-label="$t('paymentFields.selectProvider')"
      required
      :disabled="disabled"
      @update:model-value="$emit('update:provider', $event)"
    >
      <template #option="{ option }">
        <span class="provider-option">
          <ProviderLogo :provider="option.value" />
          <span>{{ option.label }}</span>
        </span>
      </template>
    </SearchableSelect>
  </div>

  <!-- Tells the receptionist what the payment status will be on save. -->
  <div v-if="notice" class="form-full">
    <p class="method-notice" :class="noticeClass">
      <i :class="noticeIcon" />
      <span>{{ notice }}</span>
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  PAYMENT_METHODS,
  METHOD_BANK,
  isAutoPaid,
  providersFor,
  requiresConfirmation,
} from '@/utils/payments'
import SearchableSelect from '@/components/SearchableSelect.vue'
import ProviderLogo from '@/components/ProviderLogo.vue'

// Props: the selected method/provider (owned by the parent), plus form flags
// and the list of methods to offer. Emits update the method and provider.
const props = defineProps({
  method: { type: String, default: '' },
  provider: { type: String, default: '' },
  required: { type: Boolean, default: true },
  disabled: { type: Boolean, default: false },
  methods: { type: Array, default: () => PAYMENT_METHODS },
})

const emit = defineEmits(['update:method', 'update:provider'])

const { t } = useI18n()
// Scopes the label/datalist ids so several instances can coexist on a page.
const uid = `pay-${Math.random().toString(36).slice(2, 8)}`

// Derived options and labels: providers available for the chosen method, the
// method/provider dropdown options, and the label for the provider field.
const providers = computed(() => providersFor(props.method))

const methodOptions = computed(() => props.methods.map((m) => ({ value: m, label: t(`paymentFields.methods.${m}`) })))
const providerOptions = computed(() => providers.value.map((p) => ({ value: p, label: t(`paymentFields.providers.${p}`) })))

const providerLabel = computed(() =>
  props.method === METHOD_BANK ? t('paymentFields.bank') : t('paymentFields.wallet'),
)

/**
 * Explains the consequence of the chosen method: Selcom is settled instantly,
 * mobile money has to be confirmed at the desk.
 */
const notice = computed(() => {
  if (isAutoPaid(props.method)) return t('paymentFields.selcomNotice')
  if (requiresConfirmation(props.method)) return t('paymentFields.mobileMoneyNotice')
  return ''
})

const noticeClass = computed(() => (isAutoPaid(props.method) ? 'is-paid' : 'is-pending'))

const noticeIcon = computed(() =>
  isAutoPaid(props.method) ? 'fas fa-circle-check' : 'fas fa-clock',
)

/**
 * Reacts to a method selection: propagates the new method and drops the old
 * provider, which no longer belongs to the newly chosen method.
 *
 * @param {string} value - Newly selected payment method key.
 */
function onMethodChange(value) {
  emit('update:method', value)
  // The old provider belongs to the old method, so drop it.
  emit('update:provider', '')
}
</script>

<style scoped>
.req {
  color: #c0392b;
  margin-left: 2px;
}

.method-notice {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 16px;
  padding: 10px 14px;
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.4;
}

.method-notice.is-paid {
  background: #eafaf1;
  color: #1e8449;
}

.method-notice.is-pending {
  background: #fef9e7;
  color: #b7950b;
}

.provider-option {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
