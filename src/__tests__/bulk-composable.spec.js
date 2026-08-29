import { ref } from 'vue'
import { describe, it, expect } from 'vitest'
import { useBulkSelection } from '@/composables/useBulkSelection'

describe('useBulkSelection', () => {
  it('starts empty', () => {
    const rows = ref([{ id: 1 }, { id: 2 }])
    const bulk = useBulkSelection(() => rows.value, { idKey: 'id' })
    expect(bulk.allSelected).toBe(false)
    expect(bulk.selectedCount).toBe(0)
    expect(bulk.someSelected).toBe(false)
  })
  it('toggleAll selects all current rows', () => {
    const rows = ref([{ id: 1 }, { id: 2 }])
    const bulk = useBulkSelection(() => rows.value, { idKey: 'id' })
    bulk.toggleAll()
    expect(bulk.selectedCount).toBe(2)
    expect(bulk.allSelected).toBe(true)
    expect(bulk.isSelected(1)).toBe(true)
    bulk.toggleAll()
    expect(bulk.selectedCount).toBe(0)
  })
  it('toggle adds/removes and removeMany resolves counts', async () => {
    const rows = ref([{ id: 1 }, { id: 2 }, { id: 3 }])
    const bulk = useBulkSelection(() => rows.value, { idKey: 'id' })
    bulk.toggle(1); bulk.toggle(3)
    expect(bulk.selectedCount).toBe(2)
    const calls = []
    const res = await bulk.removeMany(async (id) => { calls.push(id); if (id === 3) throw new Error('nope') })
    expect(res).toEqual({ tried: 2, removed: 1, failed: 1 })
    expect(calls).toEqual([1, 3])
  })
})
