/**
 * The manager review asks for outlet selection panel-wide, not just at the
 * till: "all users even management except receptionist get to select which
 * outlet would they use in order to perform their activities", with a property
 * running two stores as the worked example of a manager who cannot tell which
 * one they are about to work in.
 *
 * Two things are easy to get wrong and are pinned here: the reception carve-out
 * (front desk work is not done "through" an outlet), and the fact that the POS
 * and the panel must agree on one selection rather than keeping private copies.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useOutletContext } from '@/composables/useOutletContext'

const outletIndex = vi.hoisted(() => vi.fn())

vi.mock('@/api', () => ({
  outletApi: { index: (...a) => outletIndex(...a) },
}))

const OUTLETS = {
  outlets: [
    { outlet_id: 'out-brand', name: 'Brand Hotel', type: 'restaurant' },
    { outlet_id: 'out-bar', name: 'BAR OUT', type: 'bar' },
  ],
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  vi.clearAllMocks()
  outletIndex.mockResolvedValue({ data: OUTLETS })
})

describe('outlet context', () => {
  it('lets management choose an outlet', () => {
    // The review names management explicitly as the case that was missing.
    expect(useOutletContext().roleCanSelectOutlet('manager')).toBe(true)
    expect(useOutletContext().roleCanSelectOutlet('hotel_admin')).toBe(true)
    expect(useOutletContext().roleCanSelectOutlet('store_manager')).toBe(true)
    expect(useOutletContext().roleCanSelectOutlet('waiter')).toBe(true)
  })

  it('excludes reception', () => {
    // The one carve-out in the review. Offering it there would be a control
    // with no meaning behind it.
    expect(useOutletContext().roleCanSelectOutlet('receptionist')).toBe(false)
  })

  it('offers nothing to a signed-out visitor', () => {
    expect(useOutletContext().roleCanSelectOutlet(null)).toBe(false)
    expect(useOutletContext().roleCanSelectOutlet(undefined)).toBe(false)
  })

  it('keeps store outlets out of the till but visible to inventory', async () => {
    const ctx = useOutletContext()
    outletIndex.mockResolvedValue({
      data: {
        outlets: [
          ...OUTLETS.outlets,
          { outlet_id: 'out-store', name: 'Store A', type: 'store' },
        ],
      },
    })

    await ctx.loadOutlets({ sellingOnly: true })
    expect(ctx.outlets.value.map((o) => o.outlet_id)).toEqual(['out-brand', 'out-bar'])

    await ctx.loadOutlets()
    expect(ctx.outlets.value.map((o) => o.outlet_id)).toContain('out-store')
  })

  it('treats a single-outlet property as no choice to offer', async () => {
    const ctx = useOutletContext()
    outletIndex.mockResolvedValue({ data: { outlets: [OUTLETS.outlets[0]] } })

    await ctx.loadOutlets()

    expect(ctx.outlets.value).toHaveLength(1)
    // One outlet is not a decision, so the picker stays out of the way.
    expect(ctx.hasChoice.value).toBe(false)
  })

  it('defaults to the store holding the most stock as the main store', async () => {
    const ctx = useOutletContext()
    outletIndex.mockResolvedValue({
      data: {
        outlets: [
          {
            outlet_id: 'out-bar',
            name: 'Bar',
            type: 'bar',
            stock_department: { department_id: 'd-bar', name: 'BAR' },
          },
          {
            outlet_id: 'out-store-small',
            name: 'Small Store',
            type: 'store',
            stock_items_count: 2,
            created_at: '2026-01-01T00:00:00Z',
            stock_department: { department_id: 'd-small', name: 'Small' },
          },
          {
            outlet_id: 'out-store-main',
            name: 'Main Store',
            type: 'store',
            stock_items_count: 137,
            created_at: '2026-02-01T00:00:00Z',
            stock_department: { department_id: 'd-main', name: 'Main' },
          },
        ],
      },
    })

    await ctx.loadOutlets()
    ctx.selectOutlet(ctx.outlets.value.find((outlet) => outlet.outlet_id === 'out-bar'))

    expect(ctx.mainStore.value.outlet_id).toBe('out-store-main')
    expect(ctx.selectedStore.value.outlet_id).toBe('out-store-main')
    expect(ctx.shelfId.value).toBe('d-main')
  })

  it('remembers the chosen outlet for the session', async () => {
    const ctx = useOutletContext()
    await ctx.loadOutlets()
    expect(ctx.hasOutlet.value).toBe(false)

    ctx.selectOutlet(ctx.outlets.value[1])

    expect(ctx.outletId.value).toBe('out-bar')
    expect(sessionStorage.getItem('active_outlet')).toBe('out-bar')
  })

  it('reuses one selection across every consumer', async () => {
    // The cashier and the panel read the same ref. Separate copies meant the
    // header could show one outlet while the till stamped orders on another.
    const header = useOutletContext()
    const pos = useOutletContext()

    await header.loadOutlets()
    header.selectOutlet(header.outlets.value[0])

    expect(pos.selectedOutlet.value).toBe(header.selectedOutlet.value)
    expect(pos.outletId.value).toBe('out-brand')
  })

  it('drops a remembered outlet that no longer exists', async () => {
    // A deactivated outlet must not leave the panel scoped to something that
    // is gone, so a stale id is ignored rather than trusted.
    sessionStorage.setItem('active_outlet', 'out-deleted')
    const ctx = useOutletContext()

    await ctx.loadOutlets()

    expect(ctx.selectedOutlet.value).toBe(null)
    expect(ctx.hasOutlet.value).toBe(false)
  })

  it('re-applies a remembered outlet on the next visit', async () => {
    const first = useOutletContext()
    await first.loadOutlets()
    first.selectOutlet(first.outlets.value[1])

    const next = useOutletContext()
    await next.loadOutlets()

    expect(next.outletId.value).toBe('out-bar')
  })

  it('requests the outlet list once when two callers ask at the same time', async () => {
    // The panel header and the cashier layout both load on a POS route.
    const a = useOutletContext()
    const b = useOutletContext()

    await Promise.all([a.loadOutlets(), b.loadOutlets()])

    expect(outletIndex).toHaveBeenCalledTimes(1)
  })

  it('leaves the panel usable when the outlet list cannot be read', async () => {
    const ctx = useOutletContext()
    outletIndex.mockRejectedValue(new Error('offline'))

    await expect(ctx.loadOutlets()).resolves.toEqual([])

    expect(ctx.outlets.value).toEqual([])
    expect(ctx.loaded.value).toBe(true)
  })

  it('forgets the selection when cleared', async () => {
    const ctx = useOutletContext()
    await ctx.loadOutlets()
    ctx.selectOutlet(ctx.outlets.value[0])

    ctx.clearOutlet()

    expect(ctx.hasOutlet.value).toBe(false)
    expect(sessionStorage.getItem('active_outlet')).toBe(null)
  })
})
