// Feature flags. Client/server-safe (no imports) so both bundles can read them.

// Triage ("Sort expenses") is built but disabled for now. Flip to true to
// re-enable the entry-point banner on /expenses and the /expenses/triage route.
export const TRIAGE_ENABLED = false
