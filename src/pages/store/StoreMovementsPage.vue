<!-- StoreMovementsPage — full stock in/out audit trail. -->
<template>
  <div class="sm-page">
    <div class="sm-toolbar">
      <div class="sm-search"><i class="fas fa-magnifying-glass"></i><input v-model="search" type="text" :placeholder="$t('common.search')" @input="debounced" /></div>
      <select v-model="typeFilter" class="sm-select" @change="load(1)">
        <option value="">{{ $t('storeManager.movements.allTypes') }}</option>
        <option value="in">{{ $t('storeManager.movements.in') }}</option>
        <option value="out">{{ $t('storeManager.movements.out') }}</option>
      </select>
    </div>
    <section class="panel">
      <div v-if="loading" class="sm-loading"><i class="fas fa-circle-notch"></i> {{ $t('common.loading') }}</div>
      <template v-else>
        <div class="table-scroll">
        <table class="sm-table" v-if="movements.length">
          <thead><tr>
            <th>{{ $t('common.date') }}</th><th>{{ $t('inventory.itemName') }}</th>
            <th>{{ $t('storeManager.movements.type') }}</th><th>{{ $t('storeManager.sales.qty') }}</th>
            <th>{{ $t('storeManager.movements.reason') }}</th><th>{{ $t('storeManager.movements.by') }}</th>
          </tr></thead>
          <tbody>
            <tr v-for="m in movements" :key="m.id">
              <td>{{ fmtDate(m.created_at) }}</td>
              <td><strong>{{ m.item_name || m.item?.item_name }}</strong></td>
              <td><span class="chip" :class="m.type === 'in' ? 'chip-green' : 'chip-red'">{{ m.type }}</span></td>
              <td>{{ m.quantity }}</td>
              <td>{{ m.reason || '-' }}</td>
              <td>{{ m.user_name || m.user?.name || '-' }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty">{{ $t('storeManager.movements.empty') }}</p>
      </div>
        <div class="sm-pagination" v-if="meta.last_page > 1">
          <button :disabled="meta.current_page <= 1" @click="load(meta.current_page - 1)">&laquo;</button>
          <span>{{ meta.current_page }} / {{ meta.last_page }}</span>
          <button :disabled="meta.current_page >= meta.last_page" @click="load(meta.current_page + 1)">&raquo;</button>
        </div>
      </template>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { storeApi } from '../../api'

const movements = ref([])
const meta = ref({ current_page: 1, last_page: 1 })
const loading = ref(false)
const search = ref('')
const typeFilter = ref('')
let debounce
function debounced() { clearTimeout(debounce); debounce = setTimeout(() => load(1), 300) }
function fmtDate(d) { return d ? new Date(d).toLocaleString() : '-' }

async function load(page = 1) {
  loading.value = true
  try {
    const params = { page, per_page: 25 }
    if (search.value) params.search = search.value
    if (typeFilter.value) params.type = typeFilter.value
    const res = await storeApi.movements(params)
    movements.value = res.data.data || res.data || []
    meta.value = res.data.meta || { current_page: 1, last_page: 1 }
  } catch { movements.value = [] } finally { loading.value = false }
}
onMounted(() => load(1))
</script>
