const BK_PATTERN = /^BK-(\d{4})-(\d+)$/i
const RES_PATTERN = /^RES-(\d{4})-(\d+)$/i

export function displayBookingReference(value) {
  const raw = value == null ? '' : String(value).trim()
  const match = raw.match(BK_PATTERN)
  return match ? `RES-${match[1]}-${match[2]}` : raw
}

export function normalizeBookingReference(value) {
  const raw = value == null ? '' : String(value).trim()
  const match = raw.match(RES_PATTERN)
  return match ? `BK-${match[1]}-${match[2]}` : raw
}
