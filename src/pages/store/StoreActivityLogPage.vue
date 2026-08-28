<!-- StoreActivityLogPage — audit trail of all store actions. -->
<template>
  <div class="sm-page">
    <div class="sm-toolbar">
      <div class="sm-search"><i class="fas fa-magnifying-glass"></i><input v-model="search" type="text" :placeholder="$t('common.search')" @input="debounced" /></div>
      <select v-model="actionFilter" class="sm-select" @change="load(1)">
        <option value="">{{ $t('storeManager.activity.allActions') }}</option>
        <option value="create">{{ $t('storeManager.activity.create') }}</option>
        <option value="update">{{ $t('storeManager.activity.update') }}</option>
        <option value="delete">{{ $t('storeManager.activity.delete') }}</option>
        <option value="adjust">{{ $t('storeManager.activity.adjust') }}</option>
      </select>
    </div>
    <section class="panel">
      <div v-if="loading" class="sm-loading"><i class="fas fa-circle-notch"></i> {{ $t('common.loading') }}</div>
      <template v-else>
        <div class="table-scroll">
        <table class="sm-table" v-if="logs.length">
          <thead><tr>
            <th>{{ $t('common.date') }}</th><th>{{ $t('storeManager.activity.user') }}</th>
            <th>{{ $t('storeManager.activity.action') }}</th><th>{{ $t('storeManager.activity.subject') }}</th><th>{{ $t('storeManager.activity.details') }}</th>
          </tr></thead>
          <tbody>
            <tr v-for="l in logs" :key="l.id">
              <td>{{ l.created_at ? new Date(l.created_at).toLocaleString() : '-' }}</td>
              <td>{{ l.user_name || l.user?.name || '-' }}</td>
              <td><span class="chip">{{ l.action }}</span></td>
              <td>{{ l.subject || l.subject_type || '-' }}</td>
              <td class="muted">{{ l.description || l.details || '-' }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty">{{ $t('storeManager.activity.empty') }}</p>
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

const logs = ref([])
const meta = ref({ current_page: 1, last_page: 1 })
const loading = ref(false)
const search = ref('')
const actionFilter = ref('')
let debounce
function debounced() { clearTimeout(debounce); debounce = setTimeout(() => load(1), 300) }

async function load(page = 1) {
  loading.value = true
  try {
    const params = { page, per_page: 25 }
    if (search.value) params.search = search.value
    if (actionFilter.value) params.action = actionFilter.value
    const res = await storeApi.activityLog(params)
    logs.value = res.data.data || res.data || []
    meta.value = res.data.meta || { current_page: 1, last_page: 1 }
  } catch { logs.value = [] } finally { loading.value = false }
}
onMounted(() => load(1))
</script>
