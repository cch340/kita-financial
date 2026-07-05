// Pure, server/client-safe Home-label helpers — no supabase / next/headers here.

/** Time-of-day greeting key. Morning 05–11, afternoon 12–17, evening 18–04.
 *  `hour24` is a 0–23 wall-clock hour (computed in the user's timezone by the caller). */
export function greetingKey(
  hour24: number,
): 'home.greeting.morning' | 'home.greeting.afternoon' | 'home.greeting.evening' {
  if (hour24 >= 5 && hour24 < 12) return 'home.greeting.morning'
  if (hour24 >= 12 && hour24 < 18) return 'home.greeting.afternoon'
  return 'home.greeting.evening'
}

/** Compares month-to-date spend against a pro-rated (by day-of-month) share of the
 *  total budget. On or under the allowance → on track; strictly over → over pace.
 *  A zero/empty budget is treated as on track. */
export function budgetPaceKey(
  spentCents: number,
  totalCents: number,
  dayOfMonth: number,
  daysInMonth: number,
): 'home.onTrack' | 'home.overPace' {
  if (totalCents <= 0 || daysInMonth <= 0) return 'home.onTrack'
  const allowanceCents = (totalCents * dayOfMonth) / daysInMonth
  return spentCents > allowanceCents ? 'home.overPace' : 'home.onTrack'
}
