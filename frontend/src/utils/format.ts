/**
 * Format a price stored in integer paise into Indian Rupees.
 * Whole-rupee amounts omit trailing ".00" for cleaner menu scannability.
 */
export function formatRupees(paise: number): string {
  const rupees = paise / 100
  const hasFraction = paise % 100 !== 0
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(rupees)
}

export function formatSlotTime(isoTimestamp: string): string {
  const parsed = new Date(isoTimestamp)
  if (Number.isNaN(parsed.getTime())) {
    return isoTimestamp
  }
  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(parsed)
}

export function formatTimeWindow(startIso: string, endIso: string): string {
  return `${formatSlotTime(startIso)} – ${formatSlotTime(endIso)}`
}

export function formatShortDateTime(isoTimestamp: string): string {
  const parsed = new Date(isoTimestamp)
  if (Number.isNaN(parsed.getTime())) {
    return isoTimestamp
  }
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(parsed)
}
