export function formatRM(cents: number): string {
  const value = cents / 100
  return 'RM ' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
export const pushDigit = (cents: number, digit: number): number => cents * 10 + digit
export const pushDoubleZero = (cents: number): number => cents * 100
export const backspace = (cents: number): number => Math.floor(cents / 10)

export function parseMoneyInput(v: string): number {
  const n = parseFloat(v || '0')
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}
