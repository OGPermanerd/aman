const compactCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 2,
})

const standardCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const numberFormatter = new Intl.NumberFormat('en-US')

const compactNumberFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 2,
})

/**
 * Format a dollar value with appropriate scale suffix.
 * formatCurrency(1234567890) -> "$1.23B"
 * formatCurrency(1234567) -> "$1.23M"
 * formatCurrency(1234) -> "$1,234"
 */
export function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return compactCurrencyFormatter.format(value)
  }
  return standardCurrencyFormatter.format(value)
}

/**
 * Format a decimal as a percentage.
 * formatPercent(0.1234) -> "12.34%"
 * formatPercent(0.1234, 1) -> "12.3%"
 */
export function formatPercent(value: number, decimals: number = 2): string {
  return `${(value * 100).toFixed(decimals)}%`
}

/**
 * Format a number with thousands separators.
 * formatNumber(1234567) -> "1,234,567"
 */
export function formatNumber(value: number): string {
  return numberFormatter.format(value)
}

/**
 * Format a share count with compact notation.
 * formatShares(1234567) -> "1.23M"
 */
export function formatShares(value: number): string {
  return compactNumberFormatter.format(value)
}

const QUARTER_END_DATES: Record<string, { month: string; day: number }> = {
  '1': { month: 'March', day: 31 },
  '2': { month: 'June', day: 30 },
  '3': { month: 'September', day: 30 },
  '4': { month: 'December', day: 31 },
}

/**
 * Format a quarter string as a human-readable label.
 * formatQuarterLabel("2025Q4") -> "Q4 2025"
 */
export function formatQuarterLabel(quarter: string): string {
  const match = quarter.match(/^(\d{4})Q([1-4])$/)
  if (!match) return quarter
  return `Q${match[2]} ${match[1]}`
}

/**
 * Format a quarter string as the quarter-end date.
 * formatQuarterDate("2025Q4") -> "December 31, 2025"
 */
export function formatQuarterDate(quarter: string): string {
  const match = quarter.match(/^(\d{4})Q([1-4])$/)
  if (!match) return quarter
  const year = match[1]
  const q = match[2]
  const end = QUARTER_END_DATES[q]
  return `${end.month} ${end.day}, ${year}`
}
