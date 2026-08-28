<!-- StorePosPage — point of sale terminal with product grid, cart, checkout. -->
<template>
  <div class="sm-page pos">
    <div class="pos-left">
      <div class="sm-toolbar">
        <div class="sm-search">
          <i class="fas fa-magnifying-glass"></i>
          <input v-model="search" type="text" :placeholder="$t('storeManager.pos.searchProduct')" @input="loadItems" />
        </div>
        <button class="sm-btn ghost" @click="openScanner"><i class="fas fa-barcode"></i> {{ $t('storeManager.pos.scan')
          }}</button>
      </div>
      <div class="pos-grid">
        <button v-for="p in items" :key="p.item_id" class="pos-card" :disabled="Number(p.quantity_in_stock) <= 0"
          @click="addToCart(p)">
          <span class="pos-name">{{ p.item_name }}</span>
          <span class="pos-price">TZS {{ Number(p.selling_price || p.unit_cost || 0).toLocaleString() }}</span>
          <span class="pos-stock" :class="{ low: Number(p.quantity_in_stock) <= Number(p.reorder_level || 0) }">{{
            p.quantity_in_stock }} {{ $t('storeManager.pos.inStock') }}</span>
        </button>
        <p v-if="!loading && !items.length" class="empty">{{ $t('common.noResults') }}</p>
      </div>
    </div>
    <aside class="pos-cart panel">
      <h3><i class="fas fa-cart-shopping"></i> {{ $t('storeManager.pos.cart') }}</h3>
      <div class="pos-lines">
        <div v-for="line in cart" :key="line.item_id" class="pos-line">
          <div class="pos-line-info">
            <strong>{{ line.item_name }}</strong>
            <small class="muted">TZS {{ line.price.toLocaleString() }}</small>
          </div>
          <div class="pos-line-qty">
            <button @click="dec(line)">−</button>
            <span>{{ line.qty }}</span>
            <button @click="inc(line)">+</button>
          </div>
          <span class="pos-line-total">{{ (line.price * line.qty).toLocaleString() }}</span>
          <button class="rm" @click="removeLine(line)"><i class="fas fa-xmark"></i></button>
        </div>
        <p v-if="!cart.length" class="empty">{{ $t('storeManager.pos.emptyCart') }}</p>
      </div>
      <div class="pos-totals">
        <div class="row"><span>{{ $t('storeManager.pos.subtotal') }}</span><span>TZS {{ subtotal.toLocaleString()
            }}</span></div>
        <div class="row"><span>{{ $t('storeManager.pos.discount') }}</span><span>− TZS {{ discountAmt.toLocaleString()
            }}</span></div>
        <div class="row"><span>{{ $t('storeManager.pos.tax', { rate: taxRate }) }}</span><span>TZS {{
          taxAmt.toLocaleString() }}</span></div>
        <div class="row grand"><span>{{ $t('storeManager.pos.total') }}</span><span>TZS {{ grandTotal.toLocaleString()
            }}</span></div>
      </div>
      <div class="pos-pay">
        <select v-model="paymentMethod" class="sm-select">
          <option value="cash">{{ $t('storeManager.pos.cash') }}</option>
          <option value="card">{{ $t('storeManager.pos.card') }}</option>
          <option value="mobile_money">{{ $t('storeManager.pos.mobileMoney') }}</option>
        </select>
        <input v-if="paymentMethod === 'cash'" v-model.number="cashGiven" type="number" class="sm-input"
          :placeholder="$t('storeManager.pos.cashGiven')" />
        <div v-if="paymentMethod === 'cash'" class="row change"><span>{{ $t('storeManager.pos.change')
            }}</span><span>TZS {{ change.toLocaleString() }}</span></div>
        <input v-model="discountCode" class="sm-input" :placeholder="$t('storeManager.pos.discountCode')" />
        <button class="sm-btn wide" :disabled="!cart.length || saving" @click="checkout">
          <i class="fas fa-check"></i> {{ saving ? $t('common.saving') : $t('storeManager.pos.checkout') }}
        </button>
        <p v-if="error" class="sm-error">{{ error }}</p>
      </div>
    </aside>

    <!-- Receipt -->
    <div v-if="receipt" class="sm-modal-backdrop" @click.self="receipt = null">
      <div class="sm-modal receipt">
        <div class="receipt-body">
          <h3>{{ hotelName }}</h3>
          <p class="muted">{{ $t('storeManager.pos.receipt') }} #{{ receipt.sale_number || receipt.sale_id }}</p>
          <p class="muted">{{ new Date(receipt.created_at || Date.now()).toLocaleString() }}</p>
          <hr />
          <div v-for="l in receipt.items" :key="l.id || l.item_id" class="receipt-line">
            <span>{{ l.item_name }} × {{ l.quantity }}</span><span>{{ Number(l.line_total ?? l.quantity *
              l.unit_price).toLocaleString() }}</span>
          </div>
          <hr />
          <div class="receipt-line"><span>{{ $t('storeManager.pos.subtotal') }}</span><span>{{
            Number(receipt.subtotal).toLocaleString() }}</span></div>
          <div class="receipt-line"><span>{{ $t('storeManager.pos.tax', { rate: taxRate }) }}</span><span>{{
            Number(receipt.tax_amount).toLocaleString() }}</span></div>
          <div class="receipt-line grand"><span>{{ $t('storeManager.pos.total') }}</span><span>{{
            Number(receipt.total).toLocaleString() }}</span></div>
          <div class="receipt-line"><span>{{ $t('storeManager.pos.paymentMethod') }}</span><span>{{
            receipt.payment_method }}</span></div>
        </div>
        <div class="sm-modal-foot">
          <button class="sm-btn ghost" @click="receipt = null">{{ $t('common.close') }}</button>
          <button class="sm-btn" @click="printReceipt"><i class="fas fa-print"></i> {{ $t('common.print') }}</button>
        </div>
      </div>
    </div>

    <!-- Barcode scanner -->
    <div v-if="scannerOpen" class="sm-modal-backdrop" @click.self="closeScanner">
      <div class="sm-modal">
        <div class="sm-modal-head">
          <h3>{{ $t('storeManager.pos.scanBarcode') }}</h3><button class="x" @click="closeScanner">×</button>
        </div>
        <video ref="videoEl" class="scan-video" autoplay playsinline></video>
        <input v-model="manualCode" class="sm-input" :placeholder="$t('storeManager.pos.enterCode')"
          @keyup.enter="lookupCode" />
        <div class="sm-modal-foot"><button class="sm-btn" @click="lookupCode">{{ $t('common.search') }}</button></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { inventoryApi, storeApi } from '../../api'
import { useAuthStore } from '../../stores/auth'

const { t } = useI18n()
const auth = useAuthStore()
const items = ref([])
const cart = ref([])
const search = ref('')
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const paymentMethod = ref('cash')
const cashGiven = ref(0)
const discountCode = ref('')
const discountAmt = ref(0)
const taxRate = ref(18)
const receipt = ref(null)
const scannerOpen = ref(false)
const manualCode = ref('')
const videoEl = ref(null)

let stream = null

const hotelName = computed(() => auth.tenant?.hotel_name || auth.user?.hotel_name || 'MRK Hotels')
const subtotal = computed(() => cart.value.reduce((s, l) => s + l.price * l.qty, 0))
const taxAmt = computed(() => Math.round((subtotal.value - discountAmt.value) * (taxRate.value / 100)))
const grandTotal = computed(() => subtotal.value - discountAmt.value + taxAmt.value)
const change = computed(() => Math.max(0, (cashGiven.value || 0) - grandTotal.value))

async function loadItems() {
  loading.value = true
  try {
    const res = await inventoryApi.index({ per_page: 60, search: search.value || undefined })
    items.value = res.data.data || res.data || []
  } finally { loading.value = false }
}
function addToCart(p) {
  const ex = cart.value.find((l) => l.item_id === p.item_id)
  if (ex) { if (ex.qty < Number(p.quantity_in_stock)) ex.qty++ } else {
    cart.value.push({ item_id: p.item_id, item_name: p.item_name, price: Number(p.selling_price || p.unit_cost || 0), qty: 1, max: Number(p.quantity_in_stock) })
  }
}
function inc(l) { if (l.qty < l.max) l.qty++ }
function dec(l) { if (l.qty > 1) l.qty-- }
function removeLine(l) { cart.value = cart.value.filter((x) => x.item_id !== l.item_id) }

async function checkout() {
  saving.value = true; error.value = ''
  try {
    if (discountCode.value) {
      try {
        const d = await storeApi.discounts({ code: discountCode.value })
        const disc = (d.data.data || d.data || [])[0]
        if (disc && String(disc.code).toUpperCase() === discountCode.value.trim().toUpperCase()) {
          discountAmt.value = disc.percentage ? Math.round(subtotal.value * (disc.percentage / 100)) : Number(disc.amount || 0)
        } else { discountAmt.value = 0 }
      } catch { discountAmt.value = 0 }
    }
    const payload = {
      items: cart.value.map((l) => ({ item_id: l.item_id, quantity: l.qty, unit_price: l.price })),
      payment_method: paymentMethod.value,
      tax_amount: taxAmt.value,
    }
    if (discountCode.value.trim()) payload.discount_code = discountCode.value.trim()
    const res = await storeApi.storeSale(payload)
    receipt.value = res.data.data
    cart.value = []; cashGiven.value = 0; discountCode.value = ''; discountAmt.value = 0
    await loadItems()
  } catch (e) { error.value = e.response?.data?.message || t('common.error') } finally { saving.value = false }
}

/** Prints only the receipt card, leaving the rest of the panel out. */
function printReceipt() {
  document.body.classList.add('printing-receipt')
  window.print()
  setTimeout(() => document.body.classList.remove('printing-receipt'), 500)
}

/** Starts the device camera while the scanner dialog is open. */
async function startScanner() {
  manualCode.value = ''
  await nextTick()
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    if (videoEl.value) videoEl.value.srcObject = stream
  } catch { /* No camera or permission denied: manual entry still works. */ }
}

function stopScanner() {
  stream?.getTracks().forEach((tr) => tr.stop())
  stream = null
}

function openScanner() {
  scannerOpen.value = true
  startScanner()
}

function closeScanner() {
  scannerOpen.value = false
  stopScanner()
}

async function lookupCode() {
  if (!manualCode.value) return
  const code = manualCode.value.trim().toLowerCase()
  const p = items.value.find((x) => String(x.item_id).toLowerCase() === code)
    || items.value.find((x) => String(x.barcode || '').toLowerCase() === code)
    || items.value.find((x) => (x.item_name || '').toLowerCase().includes(code))
  if (p) { addToCart(p); closeScanner(); manualCode.value = '' }
}

onMounted(loadItems)
</script>

<style scoped>
.pos {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 16px;
  align-items: start;
}

.pos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
}

.pos-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  text-align: left;
  transition: border-color .15s;
}

.pos-card:hover:not(:disabled) {
  border-color: #005eb8;
}

.pos-card:disabled {
  opacity: .45;
  cursor: not-allowed;
}

.pos-name {
  font-weight: 600;
  font-size: 13px;
}

.pos-price {
  color: #005eb8;
  font-weight: 700;
}

.pos-stock {
  font-size: 11px;
  color: #64748b;
}

.pos-stock.low {
  color: #dc2626;
}

.pos-cart {
  position: sticky;
  top: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pos-lines {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 320px;
  overflow: auto;
}

.pos-line {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pos-line-info {
  flex: 1;
}

.pos-line-qty {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pos-line-qty button {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  cursor: pointer;
}

.pos-line-total {
  min-width: 64px;
  text-align: right;
  font-weight: 600;
}

.rm {
  background: none;
  border: none;
  color: #dc2626;
  cursor: pointer;
}

.pos-totals .row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 13px;
}

.row.grand {
  font-size: 16px;
  font-weight: 800;
  border-top: 1px solid #e2e8f0;
  margin-top: 6px;
  padding-top: 8px;
}

.pos-pay {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.row.change {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 4px 0;
  color: #16a34a;
  font-weight: 600;
}

.receipt {
  max-width: 340px;
}

.receipt-body {
  font-family: monospace;
  font-size: 13px;
}

.receipt-line {
  display: flex;
  justify-content: space-between;
  padding: 2px 0;
}

.receipt-line.grand {
  font-weight: 800;
}

.scan-video {
  width: 100%;
  border-radius: 8px;
  background: #000;
  aspect-ratio: 4/3;
}

@media (max-width: 960px) {
  .pos {
    grid-template-columns: 1fr;
  }
}
</style>

<style>
/* When printing a receipt, hide everything except the receipt card. */
body.printing-receipt * {
  visibility: hidden !important;
}

body.printing-receipt .receipt-body,
body.printing-receipt .receipt-body * {
  visibility: visible !important;
}

body.printing-receipt .sm-modal {
  position: absolute !important;
  inset: 0 auto auto 0 !important;
  max-width: 340px !important;
  border: none !important;
  box-shadow: none !important;
  max-height: none !important;
  overflow: visible !important;
}
</style>
