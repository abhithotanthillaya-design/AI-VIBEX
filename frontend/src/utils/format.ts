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

