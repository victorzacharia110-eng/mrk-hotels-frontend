import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('public group booking guest details', () => {
  it('submits the guest registered for each exact room', () => {
    const page = read('src/pages/public/BookingPage.vue')

    expect(page).toMatch(/payload\.additional_guests = booking\.value\.additional_guests/)
    expect(page).toMatch(/g\.room_id && g\.first_name\?\.trim\(\)/)
    expect(page).toMatch(/const res = await publicApi\.reservations\(payload\)/)
  })

  it('only offers non-primary rooms for additional guests', () => {
    const page = read('src/pages/public/BookingPage.vue')

    expect(page).toMatch(/selected_rooms\.slice\(1\)/)
  })
})
