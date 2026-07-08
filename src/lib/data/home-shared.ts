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
