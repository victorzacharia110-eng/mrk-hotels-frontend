<!--
  RequisitionPage.vue — the universal staff requisition (indent) screen.
  Every staff member requests registered store items on their own department
  (management and the store keeper may use any department), saves drafts,
  edits/recalls, sends, and accepts the store's answer. The store keeper's
  "Indent forward" tab answers pending requisitions by filling the quantity
  available and supplied, then forwarding them back for acceptance.
-->
<template>
  <div class="rq-page">
    <!-- Success / error banners -->
    <div v-if="notice" class="rq-banner ok">{{ notice }}</div>
    <div v-if="err" class="rq-banner bad">{{ err }}</div>

    <!-- Page header -->
    <div class="rq-head">
      <div>
        <h1>{{ $t('requisitionPanel.title') }}</h1>
        <p class="rq-sub">{{ $t('requisitionPanel.subtitle') }}</p>
      </div>
      <div class="rq-head-actions">
        <button class="rq-btn ghost" @click="load"><i class="fas fa-rotate"></i> {{ $t('requisitionPanel.refresh') }}</button>
        <button v-if="!restricted || availableItems.length" class="rq-btn primary" @click="openCreate">
          <i class="fas fa-plus"></i> {{ $t('requisitionPanel.new') }}
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div v-if="isKeeper" class="rq-tabs">
      <button :class="['rq-tab', { on: tab === 'mine' }]" @click="switchTab('mine')">
        {{ $t('requisitionPanel.myRequisitions') }}
      </button>
      <button :class="['rq-tab', { on: tab === 'inbox' }]" @click="switchTab('inbox')">
        {{ $t('requisitionPanel.inbox') }}
      </button>
    </div>

    <!-- Toolbar -->
    <div class="rq-toolbar">
      <div class="rq-search"><i class="fas fa-magnifying-glass"></i><input v-model="q" :placeholder="$t('common.search')" /></div>
      <select v-model="status" class="rq-select">
        <option value="">{{ $t('common.all') }}</option>
        <option v-for="s in statusList" :key="s" :value="s">{{ statusLabel(s) }}</option>
      </select>
      <span v-if="restricted" class="rq-dept-badge"><i class="fas fa-building"></i> {{ deptName }}</span>
    </div>

    <!-- List -->
    <section class="rq-card">
      <div v-if="loading" class="rq-loading"><i class="fas fa-circle-notch"></i> {{ $t('common.loading') }}</div>
      <p v-else-if="!filtered.length" class="rq-empty">{{ tab === 'inbox' ? $t('requisitionPanel.emptyInbox') : $t('requisitionPanel.emptyMine') }}</p>
      <div v-else class="rq-table-scroll">
        <table class="rq-table">
          <thead>
            <tr>
              <th>{{ $t('common.date') }}</th>
              <th>#</th>
              <th v-if="tab === 'inbox'">{{ $t('requisitionPanel.department') }}</th>
              <th v-if="tab === 'inbox'">{{ $t('requisitionPanel.requestedBy') }}</th>
              <th>{{ $t('requisitionPanel.items') }}</th>
              <th>{{ $t('common.status') }}</th>
              <th>{{ $t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="indent in filtered" :key="indent.indent_id">
              <td>{{ fmtDate(indent.created_at) }}</td>
              <td><strong>{{ indent.indent_number }}</strong></td>
              <td v-if="tab === 'inbox'">{{ indent.department || indent.department_name || '—' }}</td>
              <td v-if="tab === 'inbox'">{{ indent.requester_name || '—' }}</td>
              <td>{{ lineSummary(indent.items) }}</td>
              <td><span class="rq-chip" :class="statusChip(indent.status)">{{ statusLabel(indent.status) }}</span></td>
              <td class="rq-actions">
                <template v-if="canEdit(indent)">
                  <button class="rq-btn sm ghost" @click="openEdit(indent)"><i class="fas fa-pen"></i> {{ $t('requisitionPanel.edit') }}</button>
                  <button class="rq-btn sm ok" @click="send(indent)"><i class="fas fa-paper-plane"></i> {{ $t('requisitionPanel.send') }}</button>
                </template>
                <template v-if="canSupply(indent)">
                  <button class="rq-btn sm warning" @click="openSupply(indent)"><i class="fas fa-truck-ramp-box"></i> {{ $t('requisitionPanel.supply') }}</button>
                </template>
                <template v-if="canApprove(indent)">
                  <button class="rq-btn sm ok" @click="approve(indent)"><i class="fas fa-check"></i> {{ $t('requisitionPanel.approve') }}</button>
                  <button class="rq-btn sm ghost" @click="askReason(reject, indent)"><i class="fas fa-xmark"></i> {{ $t('requisitionPanel.reject') }}</button>
                </template>
                <template v-if="canAccept(indent)">
                  <button class="rq-btn sm primary" @click="accept(indent)"><i class="fas fa-hand-holding"></i> {{ $t('requisitionPanel.accept') }}</button>
                </template>
                <template v-if="canVoid(indent)">
                  <button class="rq-btn sm ghost danger-text" @click="askReason(voidRequisition, indent)"><i class="fas fa-ban"></i> {{ $t('requisitionPanel.void') }}</button>
                </template>
                <button class="rq-btn sm ghost" @click="openDetail(indent)"><i class="fas fa-eye"></i> {{ $t('common.view') }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Create / edit modal -->
    <div v-if="modal === 'create' || modal === 'edit'" class="rq-overlay" @click.self="modal = null">
      <div class="rq-modal">
        <div class="rq-modal-head">
          <h3><i class="fas fa-file-signature"></i> {{ modal === 'edit' ? $t('requisitionPanel.edit') : $t('requisitionPanel.new') }}</h3>
          <button class="rq-x" @click="modal = null">×</button>
        </div>
        <div class="rq-modal-body">
          <div v-if="err" class="rq-banner bad">{{ err }}</div>
          <label v-if="!restricted" class="rq-fld">
            <span>{{ $t('requisitionPanel.department') }}</span>
            <SearchableSelect v-model="form.department_id" :options="departmentOptions" :force-search="true" />
          </label>
          <div class="rq-fld">
            <span>{{ $t('requisitionPanel.items') }}</span>
            <p v-if="restricted && !availableItems.length" class="rq-hint">{{ $t('requisitionPanel.noDeptItems') }}</p>
            <div v-for="(line, idx) in form.lines" :key="idx" class="rq-line">
              <select v-model="line.item_id" class="rq-select grow">
                <option disabled :value="null">{{ $t('common.select') }}</option>
                <option v-for="i in availableItems" :key="i.item_id" :value="i.item_id">
                  {{ i.item_name }} — {{ $t('requisitionPanel.inStock') }}: {{ i.quantity_in_stock }}
                </option>
              </select>
              <input v-model.number="line.quantity" type="number" min="0.01" step="any" class="rq-input slim" />
              <button class="rq-x" @click="form.lines.splice(idx, 1)">×</button>
            </div>
            <button class="rq-btn sm ghost" @click="form.lines.push({ item_id: availableItems[0]?.item_id || null, quantity: 1 })">
              <i class="fas fa-plus"></i> {{ $t('requisitionPanel.addLine') }}
            </button>
          </div>
          <label class="rq-fld"><span>{{ $t('requisitionPanel.notes') }}</span><input v-model="form.notes" class="rq-input" /></label>
        </div>
        <div class="rq-modal-foot">
          <button class="rq-btn ghost" @click="modal = null">{{ $t('common.cancel') }}</button>
          <button class="rq-btn ghost" :disabled="saving" @click="save('draft')">{{ $t('requisitionPanel.saveDraft') }}</button>
          <button class="rq-btn primary" :disabled="saving" @click="save(modal === 'edit' ? null : 'pending')">
            <i class="fas fa-paper-plane"></i> {{ saving ? $t('common.saving') : (modal === 'edit' ? $t('requisitionPanel.update') : $t('requisitionPanel.sendNow')) }}
          </button>
        </div>
      </div>
    </div>

    <!-- Supply modal (store keeper answers) -->
    <div v-if="modal === 'supply'" class="rq-overlay" @click.self="modal = null">
      <div class="rq-modal wide">
        <div class="rq-modal-head">
          <h3><i class="fas fa-truck-ramp-box"></i> {{ $t('requisitionPanel.supply') }} — {{ editing?.indent_number }}</h3>
          <button class="rq-x" @click="modal = null">×</button>
        </div>
        <div class="rq-modal-body">
          <p class="rq-hint">{{ $t('requisitionPanel.answerHint') }}</p>
          <div v-if="err" class="rq-banner bad">{{ err }}</div>
          <div class="rq-table-scroll">
            <table class="rq-table">
              <thead>
                <tr>
                  <th>{{ $t('requisitionPanel.items') }}</th>
                  <th>{{ $t('requisitionPanel.requested') }}</th>
                  <th>{{ $t('requisitionPanel.inStock') }}</th>
                  <th>{{ $t('requisitionPanel.available') }}</th>
                  <th>{{ $t('requisitionPanel.supplied') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="line in supplyLines" :key="line.indent_item_id">
                  <td><strong>{{ line.item_name }}</strong></td>
                  <td>{{ line.requested }}</td>
                  <td>{{ line.stock }}</td>
                  <td><input v-model.number="line.available" type="number" min="0" step="any" class="rq-input slim" /></td>
                  <td><input v-model.number="line.supplied" type="number" min="0" step="any" class="rq-input slim" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="rq-modal-foot">
          <button class="rq-btn ghost" @click="modal = null">{{ $t('common.cancel') }}</button>
          <button class="rq-btn primary warn-fill" :disabled="saving" @click="submitSupply">
            <i class="fas fa-paper-plane"></i> {{ saving ? $t('common.saving') : $t('requisitionPanel.sendBack') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Reason modal (void / reject) -->
    <div v-if="modal === 'reason'" class="rq-overlay" @click.self="modal = null">
      <div class="rq-modal">
        <div class="rq-modal-head">
          <h3><i class="fas fa-circle-exclamation"></i> {{ $t('requisitionPanel.reasonTitle') }}</h3>
          <button class="rq-x" @click="modal = null">×</button>
        </div>
        <div class="rq-modal-body">
          <div v-if="err" class="rq-banner bad">{{ err }}</div>
          <label class="rq-fld"><span>{{ $t('requisitionPanel.reasonTitle') }}</span><textarea v-model="reasonText" rows="3" class="rq-input area" :placeholder="$t('requisitionPanel.reasonPlaceholder')"></textarea></label>
        </div>
        <div class="rq-modal-foot">
          <button class="rq-btn ghost" @click="modal = null">{{ $t('common.cancel') }}</button>
          <button class="rq-btn danger" :disabled="saving" @click="confirmReason">{{ saving ? $t('common.saving') : $t('common.save') }}</button>
        </div>
      </div>
    </div>

    <!-- Detail modal (read-only + print) -->
    <div v-if="modal === 'detail'" class="rq-overlay" @click.self="modal = null">
      <div class="rq-modal wide" id="rq-print">
        <div class="rq-modal-head">
          <h3><i class="fas fa-file-signature"></i> {{ editing?.indent_number }}</h3>
          <button class="rq-x" @click="modal = null">×</button>
        </div>
        <div class="rq-modal-body">
          <div class="rq-meta">
            <span><strong>{{ $t('requisitionPanel.department') }}:</strong> {{ editing?.department_name || '—' }}</span>
            <span><strong>{{ $t('requisitionPanel.requestedBy') }}:</strong> {{ editing?.requester_name || '—' }}</span>
            <span><strong>{{ $t('common.status') }}:</strong> {{ statusLabel(editing?.status) }}</span>
            <span v-if="editing?.notes"><strong>{{ $t('requisitionPanel.notes') }}:</strong> {{ editing.notes }}</span>
            <span v-if="editing?.void_reason"><strong>{{ $t('requisitionPanel.reasonTitle') }}:</strong> {{ editing.void_reason }}</span>
          </div>
          <div class="rq-table-scroll">
            <table class="rq-table">
              <thead>
                <tr>
                  <th>{{ $t('requisitionPanel.items') }}</th>
                  <th>{{ $t('requisitionPanel.requested') }}</th>
                  <th>{{ $t('requisitionPanel.available') }}</th>
                  <th>{{ $t('requisitionPanel.supplied') }}</th>
                  <th>{{ $t('requisitionPanel.received') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="l in editing?.items || []" :key="l.indent_item_id">
                  <td><strong>{{ l.item_name }}</strong></td>
                  <td>{{ l.quantity }}</td>
                  <td>{{ l.quantity_available }}</td>
                  <td>{{ l.quantity_supplied }}</td>
                  <td>{{ l.quantity_received }}</td>
                </tr>
                <tr v-if="!(editing?.items || []).length">
                  <td colspan="5" class="rq-empty-inline">{{ $t('requisitionPanel.emptyMine') }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="rq-modal-foot">
          <button class="rq-btn ghost" @click="modal = null">{{ $t('common.cancel') }}</button>
          <button class="rq-btn primary" @click="printDetail"><i class="fas fa-print"></i> {{ $t('requisitionPanel.print') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { inventoryApi, inventoryOpsApi } from '@/api'
import SearchableSelect from '@/components/SearchableSelect.vue'

const { t } = useI18n()
const auth = useAuthStore()

const KEEPER_ROLES = ['store_manager', 'hotel_admin', 'manager', 'owner', 'superadmin']

const role = computed(() => auth.user?.user_role)
const isKeeper = computed(() => KEEPER_ROLES.includes(role.value))
const restricted = computed(() => !KEEPER_ROLES.includes(role.value) && !!auth.user?.department_id)
const deptName = computed(() => auth.user?.department || '')

const tab = ref('mine')
const indents = ref([])
const loading = ref(false)
const saving = ref(false)
const q = ref('')
const status = ref('')
const notice = ref('')
const err = ref('')

const modal = ref(null)
const editing = ref(null)
const editingAction = ref(null)
const reasonText = ref('')

const departments = ref([])
const items = ref([])
const form = reactive({ department_id: null, notes: '', lines: [{ item_id: null, quantity: 1 }] })
const supplyLines = ref([])

const statusList = ['draft', 'pending', 'forwarded', 'approved', 'fulfilled', 'rejected', 'voided']
const statusKeyMap = {
  draft: 'requisitionPanel.statusDraft',
  pending: 'requisitionPanel.statusPending',
  forwarded: 'requisitionPanel.statusForwarded',
  approved: 'requisitionPanel.statusApproved',
  fulfilled: 'requisitionPanel.statusFulfilled',
  rejected: 'requisitionPanel.statusRejected',
  voided: 'requisitionPanel.statusVoided',
}
const statusChipClass = {
  pending: 'warn', forwarded: 'info', approved: 'ok', fulfilled: 'ok', rejected: 'bad', voided: 'muted', draft: 'muted',
}

const departmentOptions = computed(() =>
  departments.value.map((d) => ({ value: d.department_id, label: d.name })),
)

const availableItems = computed(() => {
  if (!restricted.value) return items.value
  const dept = auth.user?.department_id
  return items.value.filter(
    (i) => i.department_id === dept || (i.departments || []).some((d) => d.department_id === dept),
  )
})

const filtered = computed(() => {
  let list = indents.value
  if (tab.value === 'inbox') list = list.filter((i) => i.status !== 'draft')
  if (status.value) list = list.filter((i) => i.status === status.value)
  const term = q.value.trim().toLowerCase()
  if (term) {
    list = list.filter(
      (i) =>
        (i.indent_number || '').toLowerCase().includes(term) ||
        (i.department_name || '').toLowerCase().includes(term) ||
        (i.requester_name || '').toLowerCase().includes(term) ||
        (i.items || []).some((l) => (l.item_name || '').toLowerCase().includes(term)),
    )
  }
  return list
})

function statusLabel(s) {
  return s ? t(statusKeyMap[s] || 'common.status') : '—'
}
function fmtDate(v) {
  return v ? new Date(v).toLocaleDateString() : '—'
}
function lineSummary(lines) {
  const out = (lines || []).map((l) => `${l.item_name || '—'} ×${l.quantity}`).join(', ')
  return out || '—'
}
function statusChip(s) {
  return statusChipClass[s] || 'muted'
}
function isRequester(indent) {
  return indent.requested_by === auth.user?.user_id || indent.requester?.user_id === auth.user?.user_id
}

function canEdit(i) { return isRequester(i) && ['draft', 'pending'].includes(i.status) }
function canAccept(i) { return isRequester(i) && i.status === 'forwarded' }
function canSupply(i) { return isKeeper.value && !isRequester(i) && i.status === 'pending' }
function canApprove(i) { return isKeeper.value && i.status === 'pending' }
function canVoid(i) {
  return (
    (isRequester(i) && ['draft', 'pending', 'forwarded'].includes(i.status)) ||
    (isKeeper.value && ['pending', 'approved', 'forwarded'].includes(i.status))
  )
}

function loadMessage(e, fallback) {
  return e?.response?.data?.message || fallback || t('requisitionPanel.failed')
}

async function loadItems() {
  try {
    const res = await inventoryApi.index({ per_page: 500 })
    items.value = res.data?.data || res.data || []
  } catch { items.value = [] }
}

async function loadDepartments() {
  try {
    const res = await inventoryOpsApi.departments()
    departments.value = res.data.departments || []
  } catch { departments.value = [] }
}

async function load() {
  loading.value = true
  err.value = ''
  notice.value = ''
  try {
    const params = { per_page: 250 }
    if (tab.value === 'inbox' && isKeeper.value) params.mine = 0
    else params.mine = 1
    const res = await inventoryOpsApi.indents(params)
    indents.value = res.data.indents || []
  } catch (e) {
    err.value = loadMessage(e)
  } finally {
    loading.value = false
  }
}

function switchTab(next) {
  tab.value = next
  load()
}

function openCreate() {
  err.value = ''
  Object.assign(form, {
    department_id: restricted.value ? auth.user?.department_id : (departments.value[0]?.department_id || null),
    notes: '',
    lines: availableItems.value.length ? [{ item_id: availableItems.value[0].item_id, quantity: 1 }] : [{ item_id: null, quantity: 1 }],
  })
  editing.value = null
  modal.value = 'create'
}

function openEdit(indent) {
  err.value = ''
  editing.value = indent
  const lines = (indent.items || []).map((l) => ({ item_id: l.item_id, quantity: l.quantity }))
  Object.assign(form, {
    department_id: indent.department_id || auth.user?.department_id,
    notes: indent.notes || '',
    lines: lines.length ? lines : [{ item_id: availableItems.value[0]?.item_id || null, quantity: 1 }],
  })
  modal.value = 'edit'
}

async function save(forStatus) {
  const payloadStatus = forStatus || null
  const payload = {
    department_id: form.department_id,
    notes: form.notes,
    items: form.lines.filter((l) => l.item_id && l.quantity > 0),
  }
  if (payloadStatus) payload.status = payloadStatus
  if (!payload.items.length) {
    err.value = t('requisitionPanel.failed')
    return
  }
  saving.value = true
  err.value = ''
  try {
    if (modal.value === 'edit' && editing.value) {
      await inventoryOpsApi.updateIndent(editing.value.indent_id, payload)
      notice.value = t('requisitionPanel.updated')
    } else {
      await inventoryOpsApi.storeIndent(payload)
      notice.value = payloadStatus === 'draft' ? t('requisitionPanel.savedDraft') : t('requisitionPanel.created')
    }
    modal.value = null
    await load()
  } catch (e) {
    err.value = loadMessage(e)
  } finally {
    saving.value = false
  }
}

async function send(indent) {
  if (!window.confirm(t('requisitionPanel.confirmSend', { ref: indent.indent_number }))) return
  saving.value = true
  err.value = ''
  try {
    await inventoryOpsApi.sendIndent(indent.indent_id)
    notice.value = t('requisitionPanel.sent')
    await load()
  } catch (e) { err.value = loadMessage(e) } finally { saving.value = false }
}

function openSupply(indent) {
  err.value = ''
  editing.value = indent
  supplyLines.value = (indent.items || []).map((l) => ({
    indent_item_id: l.indent_item_id,
    item_name: l.item_name,
    requested: l.quantity,
    stock: l.quantity_in_stock,
    available: l.quantity_in_stock ?? (l.quantity_available || l.quantity),
    supplied: l.quantity_supplied || 0,
  }))
  modal.value = 'supply'
}

async function submitSupply() {
  err.value = ''
  for (const line of supplyLines.value) {
    if (line.supplied < 0 || line.available < 0) {
      err.value = t('requisitionPanel.failed')
      return
    }
    if (line.supplied > line.available) {
      err.value = t('requisitionPanel.suppliedExceeds')
      return
    }
    if (line.available > line.stock) {
      err.value = t('requisitionPanel.availableExceeds')
      return
    }
  }
  saving.value = true
  try {
    await inventoryOpsApi.supplyIndent(editing.value.indent_id, supplyLines.value.map((l) => ({
      indent_item_id: l.indent_item_id,
      quantity_available: l.available,
      quantity_supplied: l.supplied,
    })))
    notice.value = t('requisitionPanel.suppliedMsg')
    modal.value = null
    await load()
  } catch (e) { err.value = loadMessage(e) } finally { saving.value = false }
}

async function accept(indent) {
  if (!window.confirm(t('requisitionPanel.confirmAccept', { ref: indent.indent_number }))) return
  saving.value = true
  err.value = ''
  try {
    await inventoryOpsApi.acceptIndent(indent.indent_id)
    notice.value = t('requisitionPanel.acceptedMsg')
    await load()
    await loadItems()
  } catch (e) { err.value = loadMessage(e) } finally { saving.value = false }
}

async function approve(indent) {
  if (!window.confirm(t('requisitionPanel.confirmApprove', { ref: indent.indent_number }))) return
  saving.value = true
  err.value = ''
  try {
    await inventoryOpsApi.approveIndent(indent.indent_id)
    notice.value = t('requisitionPanel.approvedMsg')
    await load()
  } catch (e) { err.value = loadMessage(e) } finally { saving.value = false }
}

function askReason(action, indent) {
  editing.value = indent
  editingAction.value = action
  reasonText.value = ''
  err.value = ''
  modal.value = 'reason'
}

async function confirmReason() {
  if (!reasonText.value.trim()) {
    err.value = t('requisitionPanel.reasonRequired')
    return
  }
  saving.value = true
  err.value = ''
  try {
    await editingAction.value(editing.value, reasonText.value.trim())
    modal.value = null
  } catch (e) { err.value = loadMessage(e) } finally { saving.value = false }
}

async function reject(indent, reason) {
  await inventoryOpsApi.rejectIndent(indent.indent_id, reason)
  notice.value = t('requisitionPanel.rejectedMsg')
  await load()
}

async function voidRequisition(indent, reason) {
  await inventoryOpsApi.voidIndent(indent.indent_id, reason)
  notice.value = t('requisitionPanel.voidedMsg')
  await load()
}

function openDetail(indent) {
  editing.value = indent
  modal.value = 'detail'
}

function printDetail() {
  window.print()
}

onMounted(() => {
  load()
  loadItems()
  loadDepartments()
})
</script>

<style scoped>
.rq-page { padding: 24px; max-width: 1200px; margin: 0 auto; position: relative; }
.rq-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
.rq-head h1 { margin: 0 0 4px; font-size: 26px; font-weight: 800; }
.rq-sub { margin: 0; color: #64748b; font-size: 13px; }
.rq-head-actions { display: flex; gap: 10px; }
.rq-tabs { display: flex; gap: 6px; margin-bottom: 14px; border-bottom: 1px solid #e2e8f0; }
.rq-tab {
  border: none; background: none; padding: 10px 16px; font-size: 14px; font-weight: 600;
  color: #64748b; cursor: pointer; border-bottom: 2px solid transparent; font-family: inherit;
}
.rq-tab.on { color: #005eb8; border-bottom-color: #005eb8; }
.rq-toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 16px; }
.rq-search { position: relative; flex: 1; min-width: 180px; }
.rq-search i { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; font-size: 13px; }
.rq-search input { width: 100%; padding: 9px 12px 9px 34px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; }
.rq-select, .rq-input {
  border: 1px solid #e2e8f0; border-radius: 8px; padding: 9px 12px; font-size: 13px;
  background: #fff; color: #1f2937; font-family: inherit;
}
.rq-select:focus, .rq-input:focus, .rq-search input:focus { outline: none; border-color: #005eb8; box-shadow: 0 0 0 3px rgba(0, 94, 184, 0.12); }
.rq-select.grow { flex: 1; }
.rq-input.slim { width: 90px; }
.rq-input.area { width: 100%; resize: vertical; }
.rq-dept-badge { display: inline-flex; align-items: center; gap: 6px; background: #e8f1fa; color: #005eb8; padding: 6px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; }
.rq-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04); }
.rq-table-scroll { overflow-x: auto; }
.rq-table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 640px; }
.rq-table th { text-align: left; padding: 12px 16px; background: #f8fafc; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid #e2e8f0; }
.rq-table td { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
.rq-table tr:last-child td { border-bottom: none; }
.rq-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.rq-btn {
  display: inline-flex; align-items: center; gap: 6px; border: none; cursor: pointer;
  padding: 9px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; font-family: inherit;
  background: #005eb8; color: #fff; transition: background 0.15s;
}
.rq-btn:hover { background: #00468c; }
.rq-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.rq-btn.primary { background: #005eb8; color: #fff; }
.rq-btn.ghost { background: #fff; color: #005eb8; border: 1px solid #dbe3ec; }
.rq-btn.ghost:hover { background: #f1f6fb; }
.rq-btn.ok { background: #e7f6ec; color: #15803d; }
.rq-btn.ok:hover { background: #d4efe0; }
.rq-btn.warning { background: #fff7ed; color: #b45309; }
.rq-btn.danger { background: #dc2626; color: #fff; }
.rq-btn.danger:hover { background: #b91c1c; }
.rq-btn.sm { padding: 5px 9px; font-size: 12px; }
.rq-btn.warn-fill { background: #b45309; }
.rq-btn.warn-fill:hover { background: #92400e; }
.danger-text { color: #b91c1c; }
.rq-chip { display: inline-block; padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: capitalize; }
.rq-chip.ok { background: #e7f6ec; color: #15803d; }
.rq-chip.warn { background: #fff7ed; color: #b45309; }
.rq-chip.info { background: #e0f2fe; color: #0369a1; }
.rq-chip.bad { background: #fde8e8; color: #b91c1c; }
.rq-chip.muted { background: #f1f5f9; color: #64748b; }
.rq-banner { padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 14px; }
.rq-banner.ok { background: #e7f6ec; color: #15803d; }
.rq-banner.bad { background: #fde8e8; color: #b91c1c; }
.rq-loading, .rq-empty { padding: 40px; text-align: center; color: #64748b; font-size: 14px; }
.rq-empty-inline { text-align: center; color: #94a3b8; padding: 20px; }
.rq-hint { color: #64748b; font-size: 12px; margin: 4px 0 10px; }
.rq-overlay {
  position: fixed; inset: 0; background: rgba(15, 23, 42, 0.55); display: flex;
  align-items: flex-start; justify-content: center; z-index: 1000; padding: 40px 20px; overflow-y: auto;
}
.rq-modal {
  background: #fff; border-radius: 14px; width: 100%; max-width: 560px;
  padding: 22px; box-shadow: 0 24px 60px rgba(15, 23, 42, 0.28);
}
.rq-modal.wide { max-width: 760px; }
.rq-modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.rq-modal-head h3 { margin: 0; font-size: 17px; font-weight: 800; display: flex; align-items: center; gap: 8px; color: #1f2937; }
.rq-modal-head h3 i { color: #005eb8; }
.rq-x { border: none; background: none; font-size: 20px; color: #64748b; cursor: pointer; padding: 4px; line-height: 1; }
.rq-modal-body { display: flex; flex-direction: column; gap: 14px; padding-top: 14px; }
.rq-fld { display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600; color: #334155; }
.rq-line { display: flex; gap: 8px; align-items: center; }
.rq-modal-foot { display: flex; justify-content: flex-end; gap: 10px; padding-top: 18px; }
.rq-meta { display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 13px; color: #334155; margin-bottom: 12px; }
.rq-meta strong { color: #0f172a; }
@media print {
  body * { visibility: hidden; }
  #rq-print, #rq-print * { visibility: visible; }
  #rq-print { position: absolute; inset: 0; }
}
</style>