<!--
  NewOrderModal — shared order builder for every POS ordering mode.

  Props select the mode and prefill the header (table, room, guest...);
  the cashier searches the menu, adds line items with quantities, then
  posts the order stamped with the currently selected outlet.
-->

<template>
  <div class="sm-modal-backdrop" @click.self="$emit('close')">
    <div class="sm-modal wide order-modal" role="dialog" aria-modal="true">
      <div class="sm-modal-head">
        <h3><i class="fas fa-cart-plus" aria-hidden="true"></i> {{ title }}</h3>
        <button class="sm-btn ghost sm" @click="$emit('close')">{{ $t('common.cancel') }}</button>
      </div>

      <div class="order-grid">
        <section class="order-items">
          <div class="sm-search">
            <i class="fas fa-search" aria-hidden="true"></i>
            <input v-model="search" type="search" :placeholder="$t('cashier.order.searchItems')" />
          </div>

          <div class="cat-list">
            <div v-for="(itemsInCat, cat) in filteredMenu" :key="cat" class="cat-group">
              <p class="cat-title">{{ cat }}</p>
              <button v-for="item in itemsInCat" :key="item.menu_item_id" class="cat-item"
                :disabled="!item.is_available" @click="addItem(item)">
                <span class="cat-item-name">{{ item.item_name }}</span>
                <span class="cat-item-price">{{ money(item.price) }}</span>
              </button>
            </div>
            <p v-if="!Object.keys(filteredMenu).length" class="empty">{{ $t('cashier.order.noItems') }}</p>
          </div>
        </section>

        <section class="order-side">
          <div class="fld-col">
            <label class="fld-label" for="no-guest">{{ $t('cashier.order.guestName') }}</label>
            <input id="no-guest" v-model="form.guest_name" class="sm-input" type="text" />
          </div>

          <div class="fld-col">
            <label class="fld-label" for="no-waiter">{{ $t('cashier.order.waiter') }}</label>
            <SearchableSelect
              v-model="form.waiter_name"
              :options="waiterOptions"
              :placeholder="$t('cashier.order.waiter')"
              :empty-label="$t('common.none')"
            />
          </div>

          <div v-if="mode === 'delivery'" class="fld-row2">
            <div class="fld-col">
              <label class="fld-label" for="no-phone">{{ $t('cashier.order.deliveryPhone') }} *</label>
              <input id="no-phone" v-model="form.delivery_phone" class="sm-input" type="tel" />
            </div>
            <div class="fld-col">
              <label class="fld-label" for="no-mins">{{ $t('cashier.order.expectedMinutes') }}</label>
              <input id="no-mins" v-model.number="form.expected_minutes" class="sm-input" type="number" min="5" max="240" />
            </div>
          </div>
          <div v-if="mode === 'delivery'" class="fld-col">
            <label class="fld-label" for="no-addr">{{ $t('cashier.order.deliveryAddress') }} *</label>
            <textarea id="no-addr" v-model="form.delivery_address" class="sm-textarea" rows="2"></textarea>
          </div>

          <div v-if="mode === 'no_charge'" class="fld-col">
            <label class="fld-label" for="no-account">{{ $t('cashier.order.selectAccount') }} *</label>
            <input id="no-account" v-model="form.no_charge_account" class="sm-input" type="text" list="nc-accounts"
              :placeholder="$t('cashier.order.accountPlaceholder')" />
            <datalist id="nc-accounts">
              <option v-for="account in knownAccounts" :key="account" :value="account" />
            </datalist>
          </div>

          <div v-if="mode === 'dine_in'" class="fld-col">
            <label class="fld-label" for="no-covers">{{ $t('cashier.order.covers') }}</label>
            <input id="no-covers" v-model.number="form.covers" class="sm-input" type="number" min="0" max="999" />
          </div>

          <div class="lines">
            <p class="fld-label">{{ $t('cashier.order.lines') }}</p>
            <p v-if="!lines.length" class="empty">{{ $t('cashier.order.emptyLines') }}</p>
            <div v-for="(line, idx) in lines" :key="line.menu_item_id" class="line-row">
              <span class="line-name">{{ line.name }}</span>
              <div class="line-qty">
                <button class="qty-btn" @click="dec(idx)" :aria-label="$t('common.decrement')">−</button>
                <strong>{{ line.quantity }}</strong>
                <button class="qty-btn" @click="inc(idx)" :aria-label="$t('common.increment')">+</button>
              </div>
              <span class="line-sum">{{ money(line.price * line.quantity) }}</span>
              <button class="line-del" @click="lines.splice(idx, 1)" :aria-label="$t('common.delete')">
                <i class="fas fa-trash-can" aria-hidden="true"></i>
              </button>
            </div>
          </div>

          <div class="order-total">
            <span>{{ $t('cashier.order.total') }}</span>
            <strong>{{ money(total) }}</strong>
          </div>

          <p v-if="error" class="form-error">{{ error }}</p>

          <button class="sm-btn success submit-btn" :disabled="busy || !lines.length" @click="submit">
            <i class="fas fa-check" aria-hidden="true"></i> {{ busy ? $t('common.saving') : $t('cashier.order.placeOrder') }}
          </button>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { menuItemApi, orderApi } from '@/api'
import { selectedOutlet } from '@/pages/cashier/outlet-context'
import SearchableSelect from '@/components/SearchableSelect.vue'

const props = defineProps({
  mode: { type: String, default: 'dine_in' }, // dine_in | takeaway | room_service | delivery | no_charge
  title: { type: String, required: true },
  tableNumber: { type: String, default: null },
  roomNumber: { type: String, default: null },
  guestNamePrefill: { type: String, default: '' },
  knownAccounts: { type: Array, default: () => [] },
})
const emit = defineEmits(['close', 'created'])

const { t } = useI18n()

const menu = ref([])
const waiters = ref([])
const search = ref('')
const lines = ref([])
const busy = ref(false)
const error = ref('')

const form = reactive({
  guest_name: props.guestNamePrefill || '',
  waiter_name: '',
  covers: null,
  no_charge_account: '',
  delivery_phone: '',
  delivery_address: '',
  expected_minutes: 30,
})

const waiterOptions = computed(() =>
  waiters.value.map(w => ({ value: w.full_name, label: w.full_name }))
)

// Order type + department derived from the modal's POS mode.
const ORDER_TYPE = {
  dine_in: 'dine_in',
  takeaway: 'takeaway',
  room_service: 'room_service',
  delivery: 'delivery',
  no_charge: 'no_charge',
}
const DEPARTMENT = {
  dine_in: 'restaurant',
  takeaway: 'restaurant',
  room_service: 'restaurant',
  delivery: 'restaurant',
  no_charge: 'restaurant',
}

const total = computed(() => lines.value.reduce((sum, l) => sum + l.price * l.quantity, 0))

const filteredMenu = computed(() => {
  const term = search.value.trim().toLowerCase()
  const groups = {}
  for (const item of menu.value) {
    if (term && !`${item.item_name} ${item.category || ''}`.toLowerCase().includes(term)) continue
    const key = item.category || t('cashier.order.uncategorized')
    ;(groups[key] ||= []).push(item)
  }
  return groups
})

function addItem(item) {
  const found = lines.value.find((l) => l.menu_item_id === item.menu_item_id)
  if (found) found.quantity += 1
  else lines.value.push({ menu_item_id: item.menu_item_id, name: item.item_name, price: Number(item.price), quantity: 1 })
}

function inc(idx) {
  lines.value[idx].quantity += 1
}
function dec(idx) {
  if (lines.value[idx].quantity > 1) lines.value[idx].quantity -= 1
}

function money(value) {
  return new Intl.NumberFormat(undefined, { style: 'decimal', maximumFractionDigits: 2 }).format(value ?? 0)
}

async function submit() {
  error.value = ''
  busy.value = true
  try {
    const payload = {
      department: DEPARTMENT[props.mode],
      outlet_id: selectedOutlet.value?.outlet_id || null,
      order_type: ORDER_TYPE[props.mode],
      table_number: props.tableNumber,
      room_number: props.roomNumber,
      guest_name: form.guest_name || null,
      waiter_name: form.waiter_name || null,
      items: lines.value.map((l) => ({ menu_item_id: l.menu_item_id, quantity: l.quantity })),
    }
    if (props.mode === 'dine_in' && form.covers != null) payload.covers = form.covers
    if (props.mode === 'no_charge') {
      payload.is_no_charge = true
      payload.no_charge_account = form.no_charge_account
    }
    if (props.mode === 'delivery') {
      payload.delivery_phone = form.delivery_phone
      payload.delivery_address = form.delivery_address
      payload.expected_minutes = form.expected_minutes || undefined
    }

    const { data } = await orderApi.store(payload)
    emit('created', data.order)
    emit('close')
  } catch (e) {
    error.value = e.response?.data?.message || e.message
  } finally {
    busy.value = false
  }
}

onMounted(async () => {
  try {
    const [menuRes, options] = await Promise.all([
      menuItemApi.index({ per_page: 100 }),
      orderApi.formOptions(),
    ])
    menu.value = menuRes.data.data || menuRes.data
    waiters.value = options.data.waiters || []
  } catch (e) {
    error.value = e.message
  }
})
</script>

<style scoped>
.order-modal { max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; }
.order-grid { display: grid; grid-template-columns: 1fr 300px; gap: 16px; overflow-y: auto; padding: 16px 18px 18px; }
@media (max-width: 800px) { .order-grid { grid-template-columns: 1fr; } }
.order-items { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.cat-list { max-height: 46vh; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
.cat-title { margin: 0 0 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #94a3b8; }
.cat-item {
  display: flex; justify-content: space-between; align-items: center; gap: 10px;
  width: 100%; text-align: left; font-family: inherit;
  background: #fff; border: 1px solid #e2e8f0; border-radius: 9px;
  padding: 8px 12px; cursor: pointer; font-size: 13px;
}
.cat-item:hover:not(:disabled) { border-color: #005eb8; background: #e8f1fa; }
.cat-item:disabled { opacity: 0.45; cursor: not-allowed; }
.cat-item-price { color: #00468c; font-weight: 700; white-space: nowrap; }
.order-side { display: flex; flex-direction: column; gap: 10px; }
.fld-col { display: flex; flex-direction: column; gap: 4px; }
.fld-row2 { display: grid; grid-template-columns: 1fr 110px; gap: 10px; }
.fld-label { font-size: 12px; font-weight: 600; color: #475569; }
.sm-input.full { width: 100%; }
.lines { border-top: 1px dashed #e2e8f0; padding-top: 8px; display: flex; flex-direction: column; gap: 6px; }
.line-row { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.line-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.line-qty { display: inline-flex; align-items: center; gap: 7px; }
.qty-btn {
  width: 22px; height: 22px; border-radius: 6px;
  border: 1px solid #cbd5e1; background: #fff; cursor: pointer;
  font-weight: 700; line-height: 1;
}
.qty-btn:hover { background: #e8f1fa; border-color: #005eb8; color: #005eb8; }
.line-sum { font-weight: 700; color: #0d2b45; min-width: 70px; text-align: right; }
.line-del { border: none; background: none; color: #dc2626; cursor: pointer; }
.order-total {
  display: flex; justify-content: space-between; align-items: center;
  border-top: 2px solid #333333; padding-top: 8px; font-size: 15px;
}
.order-total strong { font-size: 19px; color: #005eb8; }
.form-error { color: #dc2626; font-size: 13px; margin: 0; }
.submit-btn { justify-content: center; }
</style>
