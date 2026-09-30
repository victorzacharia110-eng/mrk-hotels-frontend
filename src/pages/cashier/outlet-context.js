/**
 * Outlet selection context shared between the cashier layout (which writes
 * it) and POS pages (which read it when stamping orders).
 *
 * The state now lives in useOutletContext so the rest of the panel can share
 * the same selection; this module re-exports the very same refs so the cashier
 * and order screens keep reading one value rather than two.
 */
import { useOutletContext } from '@/composables/useOutletContext'

const { selectedOutlet, hasOutlet } = useOutletContext()

export { selectedOutlet, hasOutlet }
