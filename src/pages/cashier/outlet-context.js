/**
 * Outlet selection context shared between the cashier layout (which writes
 * it) and POS pages (which read it when stamping orders).
 */
import { ref, computed } from 'vue'

/** Currently selected outlet object ({ outlet_id, name, type }) or null. */
export const selectedOutlet = ref(null)

/** True once an outlet has been picked for this session. */
export const hasOutlet = computed(() => selectedOutlet.value !== null)
