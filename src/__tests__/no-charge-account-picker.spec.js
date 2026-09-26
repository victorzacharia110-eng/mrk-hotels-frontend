import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/locales/i18n'

const store = vi.fn()
const menuIndex = vi.fn()
vi.mock('@/api', () => ({
  orderApi: { store: (...args) => store(...args) },
  menuItemApi: { index: (...args) => menuIndex(...args) },
}))

vi.mock('@/pages/cashier/outlet-context', () => ({
  selectedOutlet: { value: { outlet_id: 'out-1' } },
}))

const { default: NewOrderModal } = await import('@/components/cashier/NewOrderModal.vue')

/**
 * Review item 7: "Why is ACCOUNT selection a fill in the blank TAB and not a
 * dropdown with a search bar in it on NO CHARGES PAGE when creating an order?"
 * and "There should be a page to register credit account".
 */

let pinia
let wrapper

const mountModal = (props = {}) => {
  wrapper = mount(NewOrderModal, {
    props: {
      mode: 'no_charge',
      title: 'No Charge Order',
      menuItems: [
        { menu_item_id: 'm1', item_name: 'Cola', price: 4000, department: 'bar', is_available: true },
      ],
      knownAccounts: [],
      creditAccounts: [],
      ...props,
    },
    global: {
      plugins: [pinia, i18n],
      // The modal teleports to <body> so it is never trapped under the layout's
      // stacking contexts, so every query has to go through the document.
      attachTo: document.body,
      stubs: { RouterLink: { template: '<a><slot /></a>' } },
    },
  })
  return wrapper
}

// The teleported markup lives in the document, not in the wrapper's own tree.
const dom = () => document.body
const domText = () => dom().textContent.replace(/\s+/g, ' ')

/**
 * Opens the account dropdown the way a user does and waits for the panel Vue
 * renders in response.
 */
const openAccountDropdown = async () => {
  const triggers = [...document.querySelectorAll('.ss-trigger')]
  const account = triggers[triggers.length - 1]
  account.click()
  await nextTick()
}

/** Adds a line so Place Order is enabled, then presses it. */
const placeOrder = async () => {
  wrapper.vm.lines.push({ menu_item_id: 'm1', item_name: 'Cola', price: 4000, quantity: 1 })
  await nextTick()
  const button = [...document.querySelectorAll('button')].find((b) =>
    /place order/i.test(b.textContent),
  )
  button.click()
  await nextTick()
}

describe('no-charge account picker (item 7)', () => {
  beforeEach(() => {
    store.mockReset()
    menuIndex.mockResolvedValue({ data: { data: [] } })
    pinia = createPinia()
    setActivePinia(pinia)
  })

  afterEach(() => {
    wrapper?.unmount()
    document.body.innerHTML = ''
  })

  it('is a searchable dropdown even with a single account', async () => {
    mountModal({ creditAccounts: [{ name: 'Uchumi Hotel' }] })
    await openAccountDropdown()

    // One option is below the 7-option threshold that normally hides the
    // search box, which is exactly what made this read as a fill-in blank.
    expect(dom().querySelector('.ss-search')).not.toBeNull()
  })

  it('never offers a blank account as something to pick', async () => {
    mountModal({ creditAccounts: [{ name: 'Uchumi Hotel' }] })
    await openAccountDropdown()

    const values = [...dom().querySelectorAll('.ss-option')].map((o) => o.textContent.trim())
    expect(values).toEqual(['Uchumi Hotel'])
  })

  it('refuses to place the order with no account and explains why', async () => {
    mountModal({ creditAccounts: [{ name: 'Uchumi Hotel' }] })

    await placeOrder()

    expect(store).not.toHaveBeenCalled()
    expect(domText()).toContain('Choose the account this no-charge order belongs to.')
  })

  it('sends the picked account with the order', async () => {
    mountModal({ creditAccounts: [{ name: 'Uchumi Hotel' }] })

    wrapper.vm.form.no_charge_account = 'Uchumi Hotel'
    await placeOrder()

    expect(store).toHaveBeenCalledWith(
      expect.objectContaining({ is_no_charge: true, no_charge_account: 'Uchumi Hotel' }),
    )
  })

  it('labels a recipe-tracked item as servings left, not raw units', async () => {
    // Item 4: a drink built from a recipe has no single stock line, so the
    // count the API reports is servings its ingredients can still cover.
    menuIndex.mockResolvedValue({
      data: {
        data: [
          { menu_item_id: 'm2', item_name: 'Signature Cocktail', category: 'Cocktails', price: 18000, department: 'restaurant', is_available: true, ingredient_count: 2, quantity_on_hand: 12 },
          { menu_item_id: 'm3', item_name: 'Whisky', category: 'Spirits', price: 22000, department: 'restaurant', is_available: true, ingredient_count: 0, quantity_on_hand: 7, linked_item_unit: 'BTL' },
        ],
      },
    })

    mountModal({ mode: 'takeaway', creditAccounts: [{ name: 'Uchumi Hotel' }] })
    await flushPromises()

    expect(domText()).toContain('Left: 12')
    expect(domText()).toContain('Stock 7 BTL')
  })

  it('points an empty registry at the page that registers accounts', () => {
    mountModal()

    // Nothing to pick and nowhere to go was the dead end item 7 describes.
    expect(domText()).toContain('No credit account is registered yet')
    expect(domText()).toContain('Register a credit account')
  })
})
