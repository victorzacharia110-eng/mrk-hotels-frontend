<template>
  <div>
    <div class="card selector-card">
      <div class="form-group">
        <label for="sections-page">Page</label>
        <select id="sections-page" v-model="selectedPageId" class="input">
          <option value="">Select a page</option>
          <option v-for="page in pages" :key="page.id" :value="String(page.id)">
            {{ page.title }} ({{ page.slug }})
          </option>
        </select>
      </div>
      <p v-if="pagesError" class="alert alert-error">{{ pagesError }}</p>
    </div>

    <SchemaCrudManager
      v-if="selectedPageId"
      :key="selectedPageId"
      title="Sections"
      :description="`Manage sections for page #${selectedPageId}`"
      :api="scopedApi"
      list-key="sections"
      :fields="fields"
      :columns="columns"
    />
    <div v-else class="card"><p class="muted">Select a page to manage its sections.</p></div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { marketingApi } from '@/api'
import SchemaCrudManager from './SchemaCrudManager.vue'

const pages = ref([])
const selectedPageId = ref('')
const pagesError = ref('')

const scopedApi = computed(() => ({
  index: (params) => marketingApi.sections.index(selectedPageId.value, params),
  store: (data) => marketingApi.sections.store(selectedPageId.value, data),
  show: (id) => marketingApi.sections.show(selectedPageId.value, id),
  update: (id, data) => marketingApi.sections.update(selectedPageId.value, id, data),
  destroy: (id) => marketingApi.sections.destroy(selectedPageId.value, id),
}))

const columns = [
  { key: 'section_type', label: 'Type' },
  { key: 'heading', label: 'Heading' },
  { key: 'is_active', label: 'Active', format: 'bool' },
  { key: 'sort_order', label: 'Sort' },
]
const fields = [
  { key: 'section_type', label: 'Section type', type: 'text', hint: 'hero, contact, integrations, workflow, product, cta, pricing, mission, pillars, stats, global_presence, leadership, booking' },
  { key: 'heading', label: 'Heading', type: 'text' },
  { key: 'subheading', label: 'Subheading', type: 'textarea' },
  { key: 'body_json', label: 'Body JSON', type: 'json', nullable: true },
  { key: 'is_active', label: 'Active', type: 'checkbox' },
  { key: 'sort_order', label: 'Sort order', type: 'number' },
]

onMounted(async () => {
  try {
    const res = await marketingApi.pages.index()
    pages.value = res.data?.pages || []
  } catch (err) {
    pagesError.value = err?.response?.data?.message || 'Failed to load pages'
  }
})
</script>

<style scoped>
.selector-card { margin-bottom: 16px; }
.selector-card .form-group { max-width: 420px; margin: 0; }
</style>
