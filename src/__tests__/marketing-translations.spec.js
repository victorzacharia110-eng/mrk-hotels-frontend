import { describe, it, expect } from 'vitest'
import en from '@/locales/en.json'
import sw from '@/locales/sw.json'
import i18n from '@/locales/i18n'
import { localizeMarketingPage } from '@/composables/useMarketingContent'

describe('marketing translations', () => {
  it('ships both locales for every marketing UI label', () => {
    const keys = Object.keys(en.marketingCopy).sort()
    expect(keys.length).toBeGreaterThan(20)
    expect(Object.keys(sw.marketingCopy).sort()).toEqual(keys)

    for (const key of keys) {
      expect(sw.marketingCopy[key], `sw.json missing marketingCopy.${key}`).toBeTruthy()
    }
  })

  it('translates seeded marketing page content when Swahili is active', () => {
    const previous = i18n.global.locale.value
    i18n.global.locale.value = 'sw'

    try {
      const localized = localizeMarketingPage({
        slug: 'home',
        title: 'MRK HOTEL SOFTWARE',
        nav_label: 'Home',
        sections: [
          {
            section_type: 'contact',
            heading: 'CONTACT US',
            subheading: 'Connects with Your Existing Hardware & Tech Stack',
            body_json: {
              body: 'How Our Products Work Together',
              labels: ['NAME', 'EMAIL', 'BUSINESS NAME', 'BUSINESS ADDRESS', 'SUBMIT'],
              ctas: [{ label: 'Schedule Live Demo', url: '#contact' }],
            },
          },
        ],
      })

      expect(localized.title).toBe('PROGRAMU YA HOTELI YA MRK')
      expect(localized.nav_label).toBe('Nyumbani')
      expect(localized.sections[0].heading).toBe('WASILIANA NASI')
      expect(localized.sections[0].subheading).toBe('Inaunganishwa na vifaa na mifumo yako iliyopo')
      expect(localized.sections[0].body_json.body).toBe('Bidhaa Zetu Zinavyofanya Kazi Pamoja')
      expect(localized.sections[0].body_json.labels).toEqual([
        'JINA',
        'BARUA PEPE',
        'JINA LA BIASHARA',
        'ANUANI YA BIASHARA',
        'TUMISA',
      ])
      expect(localized.sections[0].body_json.ctas[0].label).toBe('Panga Onyesho la Moja kwa Moja')
    } finally {
      i18n.global.locale.value = previous
    }
  })

  it('leaves content untouched in English', () => {
    const previous = i18n.global.locale.value
    i18n.global.locale.value = 'en'

    try {
      const page = { slug: 'home', title: 'MRK HOTEL SOFTWARE', sections: [] }
      expect(localizeMarketingPage(page)).toEqual(page)
    } finally {
      i18n.global.locale.value = previous
    }
  })
})
