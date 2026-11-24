import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { marketingApi } from '@/api'
import MarketingContactSubmissionsPage from '@/pages/superadmin/marketing/MarketingContactSubmissionsPage.vue'

vi.mock('@/api', () => ({
  marketingApi: {
    contactSubmissions: {
      index: vi.fn(),
      reply: vi.fn(),
    },
  },
}))

describe('marketing contact submissions admin', () => {
  beforeEach(() => {
    marketingApi.contactSubmissions.index.mockResolvedValue({
      data: {
        contact_submissions: [
          {
            id: 1,
            name: 'Jane Doe',
            email: 'jane@example.com',
            business_name: 'Example Hotel',
            status: 'new',
            reply_body: null,
            notes: null,
            replied_at: null,
          },
        ],
      },
    })
    marketingApi.contactSubmissions.reply.mockResolvedValue({ data: {} })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('sends a reply without exposing create or delete actions', async () => {
    const wrapper = mount(MarketingContactSubmissionsPage)
    await flushPromises()

    expect(wrapper.text()).toContain('Reply')
    expect(wrapper.text()).not.toContain('New')
    expect(wrapper.text()).not.toContain('Delete')

    const replyButton = wrapper.findAll('button').find((button) => button.text() === 'Reply')
    expect(replyButton).toBeDefined()
    await replyButton.trigger('click')

    expect(wrapper.find('h3').text()).toContain('Reply submission')
    await wrapper.find('textarea').setValue('Thanks for reaching out.')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(marketingApi.contactSubmissions.reply).toHaveBeenCalledWith(1, {
      reply_body: 'Thanks for reaching out.',
    })
    expect(wrapper.text()).toContain('Reply sent to the customer.')
  })
})
