# Handoff: Kita — Family Finance PWA

## Overview
**Kita** ("us / ours" in Malay) is a mobile-first PWA for a married couple in Malaysia (users **CH** and **JC**, baby **Leo / 泽泽**) to track shared household finances — replacing a clunky Google Sheet. Currency is **RM**, always formatted `RM 1,234.56`. The app is bilingual (**EN / 中文**) and designed one-handed for iPhone + Android, with a bottom tab bar and large tap targets. It must be installable (Add to Home Screen) to enable iOS push notifications.

Warm, calm, trustworthy *family-finance* feel — cream paper + terracotta, not a cold corporate dashboard.

## About the Design Files
The single file in this bundle — `Kita - Home Directions.dc.html` — is a **design reference created in HTML**, not production code to copy directly. It is a prototype that shows the intended look, layout, copy, and interaction behavior of every screen. Your task is to **recreate these designs in the target codebase** using its established patterns and libraries.

The intended stack is **React + Tailwind + shadcn/ui inside a Next.js app** (so map the visuals onto those primitives — see *Component Kit Mapping* below). If you are starting a fresh repo, scaffold Next.js (App Router) + Tailwind + shadcn/ui + `lucide-react` for icons and implement there.

**How to view the reference:** open the HTML file in a browser. It is a horizontally-scrolling canvas of phone mockups grouped into three "turns" (newest at top). Each phone has a small badge (e.g. `1A`, `2B`, `3C`) — those IDs are used throughout this README. There is an **EN / 中文** toggle at the top of each turn; flip it to see bilingual layouts. Many controls are live (keypad, toggles, switches, tab switches) — click them to see behavior.

> Note: the HTML prototype uses inline styles and hand-drawn CSS shapes for icons/device bezels. Do **not** port those literally — use `lucide-react` icons, real device rendering, and Tailwind classes / shadcn components.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, copy, and interactions are all intentional. Recreate the UI faithfully using the codebase's libraries. Exact tokens are in *Design Tokens* below. Colors are authored in **OKLCH** — keep them as OKLCH (Tailwind v3.4+/v4 support `oklch()`) or convert to the nearest hex if the toolchain requires; the OKLCH values are the source of truth.

---

## Design Tokens

### Color — Neutrals (warm)
| Token | OKLCH | Use |
|---|---|---|
| `paper` | `oklch(0.972 0.013 74)` | Screen background (cream) |
| `paper-2` | `oklch(0.982 0.011 78)` | Alt screen bg (1B ledger) |
| `surface` | `oklch(0.995 0.006 78)` | Cards, list rows, inputs |
| `subtle` | `oklch(0.97 0.01 74)` | Icon tiles, quiet buttons, note field |
| `hairline` | `oklch(0.90 0.012 66)` | Borders / dividers (also `0.93 0.012 66` for lighter) |
| `canvas` | `oklch(0.928 0.012 66)` | (Design-canvas backdrop only — not an app surface) |

### Color — Text
| Token | OKLCH | Use |
|---|---|---|
| `ink` | `oklch(0.30 0.02 50)` | Primary text / amounts |
| `ink-head` | `oklch(0.32 0.03 45)` | Large headings |
| `muted` | `oklch(0.55 0.02 58)` | Secondary text |
| `faint` | `oklch(0.62 0.02 60)` | Tertiary / idle nav |

### Color — Brand & Semantic
| Token | OKLCH | Use |
|---|---|---|
| `primary` (terracotta) | `oklch(0.63 0.14 40)` | Accent, active nav, primary chips |
| `primary-btn` | `oklch(0.61 0.15 39)` | Filled buttons / FAB |
| `hero-gradient` | `linear-gradient(150deg, oklch(0.71 0.115 52), oklch(0.58 0.15 38))` | Joint Fund / key-metric hero cards |
| `peach` | `oklch(0.90 0.055 62)` | CH avatar bg, soft tiles |
| `positive` (sage) | text `oklch(0.50 0.09 155)` · bg `oklch(0.94 0.04 155)` | Paid / transferred / income |
| `pending` (amber) | text `oklch(0.64 0.11 65)` · bg `oklch(0.95 0.05 78)` | Pending / upcoming / due |
| `info` (blue) | text `oklch(0.58 0.09 238)` · bg `oklch(0.93 0.03 235)` | JC avatar / transport / vehicle hero |
| `danger` | `oklch(0.57 0.16 25)` | Swipe-delete, sign-out |

Per-member accent: **CH = peach/terracotta** (`oklch(0.70 0.11 42)`), **JC = blue** (`oklch(0.58 0.09 238)`).

### Color — Dark mode
| Token | OKLCH |
|---|---|
| bg | `oklch(0.225 0.018 55)` |
| card | `oklch(0.28 0.018 52)` |
| text | `oklch(0.95 0.012 78)` |
| muted | `oklch(0.68 0.02 60)` |
| hairline | `oklch(0.34 0.02 55)` |

The terracotta hero gradient and semantic accents stay the same in dark mode (they read well on the dark bg). See screen **2E**.

### Typography
- **Public Sans** — primary UI face (Helvetica-like, neutral, trustworthy). Weights 400/500/600/700/800.
- **Noto Sans SC** — Chinese glyphs; include as a fallback in the same `font-family` stack so 中文 renders: `'Public Sans','Noto Sans SC',system-ui,sans-serif`.
- **Spline Sans Mono** — tabular monospace, used **only** in the "1B Focused Ledger" home direction for the big number + ledger figures. Not needed if you ship direction 1A.
- All monetary numbers use `font-variant-numeric: tabular-nums`.

Type scale (px, mobile): hero amount 44–46 / 800; screen title 24 / 800; card big number 27–34 / 800; body 14–15 / 500–600; label 12.5–14 / 600–700; micro/uppercase caption 11–12 / 700 with `letter-spacing: .5–.6px`; nav label 10 / 600–700. Headings use `letter-spacing: -.4 to -1.6px`.

### Radius
Phone screen 38px · cards 16–26px · hero cards 22–26px · buttons 14–16px · pills/chips/switch-track 999px · icon tiles 10–13px · avatars 50%.

### Shadow
- Card: `0 3px 10px oklch(0.5 0.05 45 / .05)`
- Elevated card: `0 6px 16px oklch(0.5 0.05 45 / .06)`
- Hero (accent): `0 14px 26px -12px <accent> / .5`
- FAB / primary button: `0 10–12px 20–24px -6px <accent> / .5–.6`
- Push cards (on lock screen): `0 6px 18px rgba(0,0,0,.18)`

### Spacing / layout constants
- Screen horizontal padding: **16–18px**. Section vertical rhythm: **12–16px** gaps.
- Bottom tab bar height **84px** (incl. 24px safe-area bottom pad). Content lists add `padding-bottom: 96px` so the last row clears the bar + FAB.
- FAB **56px** circle, bottom-right, ~18px inset, sits ~100px above the bar. (1A also uses a pill FAB: `＋ Add Expense`.)
- Numeric keypad keys **50px** tall, 3-col grid, 8px gap.
- Switch **48×28** track, **22px** knob.
- Min tap target **44px** everywhere.

### Currency format
`RM ` + `Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })` → `RM 1,234.56`. Group separator `,`. The Add-Expense keypad uses a **cents accumulator**: each digit does `cents = cents*10 + d`; backspace `cents = floor(cents/10)`; the `00` key does `cents = cents*100`; display `RM (cents/100)`.

---

## Navigation
Fixed **bottom tab bar**, 5 tabs, left→right: **Home · Expenses · Fund · Budget · Assets**. Active tab = terracotta icon + label; idle = faint gray. Suggested `lucide-react` icons: Home `Home`, Expenses `Receipt`, Fund `HandCoins`/`PiggyBank`, Budget `ChartColumn`/`PieChart`, Assets `LayoutGrid`.

- **Settings** is **not** a tab — it opens from a **gear icon** in the Home header (top-right, left of the avatar). Icon: `SlidersHorizontal` (the prototype draws a two-row sliders glyph).
- **Personal** is **not** a tab — it opens from a **"Personal ledgers" card** on the Home dashboard.

---

## Screens / Views

The design is organized in three turns. **Turn 1** = 3 explorations of the Home screen; the client chose **1A "Warm Cards"** as the direction — build that one. **1B** and **1C** are alternates kept for reference only. **Turn 2** = the core daily screens in the 1A style. **Turn 3** = Assets module, Personal, Settings, Push.

### 1A — Home / Dashboard  *(chosen direction)*
- **Purpose:** this-month snapshot + fast add-expense.
- **Layout:** vertical scroll, 18px padding, 15px gaps. Top: status bar. Header row: greeting (`Good morning, CH` / `早安，CH`) + month title (`July 2026` / `2026年7月`) on the left; on the right a **gear button → Settings** and the **CH avatar** (42px peach circle).
- **Components (top→bottom):**
  1. **Joint Fund hero card** — terracotta gradient, radius 26. Label `Joint Fund`, month pill top-right. Big `RM 2,270` + muted `/ RM 4,540`. 50% progress bar (white on translucent white track). Two status chips: `CH paid` (check) and `JC pending` (pulsing amber dot).
  2. **Budget card** — surface card. `Budget` + `You're on track` (sage). `RM 2,565` + `left`. 62% progress bar (terracotta gradient). Footer: `RM 4,235 spent` · `RM 6,800`.
  3. **Personal ledgers card** (link → Personal) — overlapping CH+JC avatars, title `Personal ledgers`, sub `CH RM 6,011 · JC RM 3,425`, chevron.
  4. **Upcoming card** — header `Upcoming` + `View all`. 3 reminder rows: icon tile · name · due date · amount · status. Rows: `JC · Joint Fund` `RM 2,270` `Due · Jul 5` (pending), `Internet & Astro` `RM 199` `Jul 8` (auto), `AIA — CH` `RM 3,600` `in 2 weeks · Jul 18`.
  5. **FAB** — terracotta pill `＋ Add Expense`, bottom-right above nav.
- Bottom tab bar, **Home** active.

### 2A — Add Expense (amount-first)
- **Purpose:** the daily-driver capture flow. Full-screen (modal/route), no tab bar.
- **Layout top→bottom:** header row (`‹` back · `Add Expense` title · `×` close); centered **Amount** block — micro label + huge `RM 42.50` with a blinking terracotta caret; **Who paid?** segmented control (`CH` / `JC`, each with mini avatar; selected = filled member color); **category chips** (wrapping pills: Food, Groceries, Transport, House, Leo, Dining, Utilities, Health — selected = terracotta filled); **note field** (`Add note or vendor`, with a `Today` date pill); then pushed to the bottom, the **numeric keypad** (3×4 grid: 1–9, `00`, `0`, `⌫`); **Save Expense** primary button.
- **Behavior:** keypad is a live cents-accumulator (see *Currency format*). Payer + category are single-select. Save persists and returns to the list.

### 2B — Expenses (list)
- **Purpose:** scrollable, filterable transaction history.
- **Layout:** header `Expenses` + search + sort icons; big running total `RM 4,235.00` + `spent this month`; **filter chips** row (`All` active, `Food`, `Leo`, `CH`, …); **date-grouped list** — each group has a date header + group subtotal on the right (`Today · Jul 4  RM 215.30`, `Yesterday · Jul 3  RM 347.50`). Transaction rows are cards: category icon tile · vendor + `category · payer` · amount.
- **Interaction:** **swipe-to-reveal** Edit/Delete behind a row (the "Guardian" row is shown mid-swipe in the mock: reveals amber `Edit` + red `Del`). FAB `＋` bottom-right.
- Bottom tab bar, **Expenses** active.
- Sample rows: Jaya Grocer / Groceries / CH / `RM 128.40`; Grab / Transport / JC / `RM 22.00`; Guardian / Leo · diapers / CH / `RM 64.90`; Village Park / Dining / JC / `RM 47.50`; Shell / Transport / CH / `RM 90.00`; TNB / Utilities · auto / `RM 210.00`.

### 2C — Joint Fund
- **Purpose:** track each member's monthly contribution and progress to the yearly total.
- **Layout:** title `Joint Fund` + `2026` pill; **hero** (terracotta gradient): `Contributed` `RM 29,510`, `of RM 54,480 this year`, 54% progress, chips `Carry-forward · RM 3,120` and `RM 2,270 / mo each`. Then a **month table** card: header row (blank · `CH` · `JC` with avatars); a collapsed summary row `Jan – Mar · all paid · RM 13,620`; then per-month rows (Apr, May, Jun, Jul), each with a **CH cell** and **JC cell**. Paid cell = sage chip `✓ 2,270`. The current month (**Jul**) is highlighted; **JC · July** is a **live "Mark paid" button** (terracotta) that toggles to a sage `Paid ✓` chip on tap.
- Bottom tab bar, **Fund** active.

### 2D — Budget
- **Purpose:** category budgets with JC/CH split + budget-vs-actual, plus fixed commitments.
- **Layout:** title `Budget` + month pill; **overall card**: `RM 4,235 / RM 6,800`, 62% bar, `RM 2,565 left`. **Category cards** (one per category): name + total; a **split bar** (peach = JC portion, blue = CH portion) with `JC RM x` / `CH RM y` labels; a **budget-vs-actual bar** (sage under-budget / amber at-or-over) with `RM spent · %`. Categories: House `RM 1,800` (900/900, 100%), Food `RM 1,500` (750/750, 79%), Emergency Fund `RM 1,000` (500/500, 100%), Leo · Food & Diapers `RM 600` (300/300, 85%). **Monthly commitments** section: `Total RM 2,319`; rows House Installment `RM 1,800`, Utilities (TNB · Air) `RM 320`, Internet & Astro `RM 199`.
- Bottom tab bar, **Budget** active.

### 2E — Home (Dark mode)
- Same as **1A** rendered in the warm dark theme (see dark tokens). Proof that light/dark are both handled. The terracotta hero + semantic colors are unchanged; surfaces/text/hairlines switch to the dark set. Gear icon present in header.

### 3A — Assets (list) — *generic asset module*
- **Purpose:** entry to all household assets, grouped by type. The module is intentionally **uniform** so a brand-new asset type slots in naturally.
- **Layout:** title `Assets` + **`＋ Add asset`** button (→ 3E). Sections with uppercase headers: **Property**, **Vehicles**, **Investments**, **Other**. Each asset is a card: icon tile · name · meta · **one key figure** (+ its label) · chevron (→ detail).
- Cards: TreeO / Condominium / `RM 18,400` (`Balance`); Myvi / WXX 8821 / `RM 620` (`Next payment`); Alza / WYY 3390 / `RM 540` (`Next payment`); AIA — CH / 10-year plan / `RM 21,600` (`Paid`); AIA — JC / `RM 18,000` (`Paid`); Emergency cash / Savings / `RM 5,000` (`Balance`).
- Bottom tab bar, **Assets** active.

### Asset detail — shared skeleton
All three detail variants use the **same structure**: back header (name + `type · subtitle`) → **key-metric hero card** (gradient tinted per type) → a **body list** → an **＋ Add transaction** button pinned above the bar → Assets tab active. Only the body differs per type:

### 3B — Property detail (e.g. "TreeO", condominium)
- Hero (terracotta gradient): `Balance` `RM 18,400`, `+ RM 1,890 · Jul`.
- Body = **running balance** with in/out transactions. Each transaction is a card: direction icon (`↓` sage for in, `↑` terracotta for out) · label · `date · in/out` · signed amount; **plus a bottom row inside the card: `Transferred?` + a live Switch.** Monthly commitments come *in*, bills/payments go *out*. Rows: `Monthly commitment +2,270` (transferred), `Maintenance fee −380` (transferred), `Quit rent + assessment −620` (**pending / switch off**), `Monthly commitment +2,270` (transferred).

### 3C — Vehicle detail (e.g. "Myvi", "Alza")
- Hero (blue gradient): `Next payment` `RM 620`, `Loan · due Jul 28`.
- Body = payment history **grouped by type**, each group a card with an uppercase header: **Loan** (Jul 2026 `RM 620` Paid, Jun 2026 `RM 620` Paid — with installment `24/60` sub), **Road tax + insurance** (2026 Due Sep `RM 1,150` Upcoming, 2025 `RM 1,120` **CLOSED**), **Maintenance** (Jun 2026 service `RM 280` Paid, 2024 timing belt `RM 1,200` **CLOSED**). Status badges: Paid (sage), Upcoming (amber), **CLOSED** (neutral gray) for fully-settled items.

### 3D — Investment detail (e.g. "AIA — CH", "AIA — JC")
- Hero (sage gradient): `Total paid` `RM 21,600`, `of RM 36,000 · RM 3,600 / yr`, 60% bar.
- Body = **numbered yearly schedule** (~10 payments). Each row: number badge · year · status · `RM 3,600`. 2020–2025 = Paid (sage badges, numbers 1–6); **2026 = #7, highlighted, `Due Jul 18`**; 2027–2029 = Upcoming (hollow badges, numbers 8–10).
- *Note:* in the prototype both AIA — CH and AIA — JC currently show the same schedule; wire real per-person figures when available.

### 3E — Add asset
- **Purpose:** create a new asset; fields adapt to the chosen type (keeps the module generic).
- **Layout:** header (`×` · `Add asset`); **Choose a type** — 2×2 grid of chips (**Property / Vehicle / Investment / Other**, single-select, selected = terracotta); **Asset name** input (placeholder hints the selected type); then a **type-specific field list** that **changes live** with the selected type:
  - Property → Starting balance · Monthly commitment (in) · Address / unit
  - Vehicle → Loan amount · Monthly installment · Plate number
  - Investment → Yearly premium · Number of years · Policy holder
  - Other → Starting balance · Notes
- **Create asset** primary button.

### 3F — Personal (opened from Home)
- **Purpose:** two personal ledgers (CH, JC): income vs expenses → balance.
- **Layout:** back header + `Personal`; a **CH / JC segmented switch** (selected = member color) that swaps the whole ledger; **Income** card (rows + green total), **Expenses** card (rows + terracotta total), **Balance** hero (gradient, big figure); dashed **＋ Add entry** button. Bottom tab bar, **Home** active (it's a Home sub-flow).
- Data — **CH:** Income `RM 9,700` (Salary 8,500, Rental income 1,200); Expenses `RM 3,689` (Joint Fund 2,270, Car loan · Myvi 620, Insurance 220, Subscriptions 89, Petrol 400, Phone 90); Balance `RM 6,011`. **JC:** Income `RM 6,800` (Salary 6,800); Expenses `RM 3,375` (Joint Fund 2,270, Car loan · Alza 540, Insurance 180, Subscriptions 65, Petrol 320); Balance `RM 3,425`.

### 3G — Settings (opened from gear)
- **Purpose:** members, language, notifications, install, sign out. Back header + `Settings`, no tab bar.
- **Sections:** **Household members** (CH — You · Admin; JC — Partner) + an **invite-by-email** input + `Invite` button. **Language** row with an **EN / 中文 toggle**. **Notifications** — three **Switch** rows: `Monthly commitments` (House · utilities · internet) **default ON**, `Yearly big payments` (AIA · road tax & insurance) **default ON**, `Push notifications` (Requires Home Screen install on iPhone) **default OFF**. **Install card** — `Add Kita to Home Screen` / `Install to get reminders & push on iOS` + `Install` button (terracotta gradient). **Sign out** (danger outline button).

### 3H — Push / reminders (example)
- **Purpose:** show the notification UX. An iOS-style **lock screen**: dark warm gradient wallpaper, big clock `9:41`, date `Saturday, 4 July`, and two frosted notification cards, each with the Kita app icon + `KITA` + time:
  - `Joint Fund contribution due` — `RM 2,270 · JC's turn — due tomorrow` (`now`)
  - `AIA payment coming up` — `RM 3,600 · in 2 weeks (Jul 18)` (`8:00`)

---

## Interactions & Behavior
- **Language toggle (EN / 中文):** flips every label app-wide from an i18n dictionary. Layout must tolerate CJK (denser glyphs, different text lengths). See *State Management*.
- **Add-Expense keypad:** cents-accumulator (live). Blinking caret on the amount.
- **Payer / category / person / asset-type selects:** single-select segmented/chips; selected state = filled accent.
- **Joint Fund "Mark paid":** tap toggles a pending cell → paid (sage `✓`).
- **Property "Transferred?" switch:** per-transaction toggle (on = sage track).
- **Notification switches:** independent on/off; Monthly & Yearly default ON, Push default OFF.
- **Expenses swipe:** horizontal swipe reveals Edit (amber) + Delete (red) actions per row.
- **Navigation links:** gear → Settings, Personal card → Personal, asset cards → detail, `＋ Add asset` → Add asset.
- **Transitions:** keep subtle — 120–180ms ease for toggles/switches; standard iOS/Android push for route changes. Pending indicators use a slow opacity pulse (~1.8s).
- **Responsive:** phone-first, single column. Content areas scroll vertically under a fixed status area + fixed bottom bar. Respect safe-area insets (notch + home indicator). Works iPhone + Android widths (~360–430px).

## State Management
Prototype state (lift into your store / URL / server as appropriate):
- `lang: 'en' | 'zh'` — drives an i18n dictionary (recommend `next-intl` or `react-i18next`; keys mirror the prototype's `t.*`).
- **Add Expense:** `cents: number` (accumulator), `payer: 'CH' | 'JC'`, `category: string`.
- **Joint Fund:** per-member/month `paid: boolean` (e.g. `jcJulPaid`).
- **Personal:** `person: 'CH' | 'JC'`.
- **Settings:** `notif: { monthly: boolean; yearly: boolean; push: boolean }`.
- **Property detail:** per-transaction `transferred: boolean`.
- **Add asset:** `newType: 'property' | 'vehicle' | 'investment' | 'other'` (drives the visible field list).
- **Data:** expenses, contributions, budgets, assets, ledger entries, schedules — fetch from your backend. Amounts should be stored in cents/decimal and formatted via the currency helper.

## PWA requirements
- `manifest.webmanifest` (name "Kita", icons, `display: standalone`, theme color ≈ terracotta `oklch(0.63 0.14 40)`, background ≈ cream). Maskable icon = the terracotta rounded-square with the cream house mark (the app logo).
- Service worker (e.g. `next-pwa` / Workbox) for installability + offline shell.
- iOS: push requires the app be **added to Home Screen** first — surface the Install card (Settings) and an install prompt; use the Web Push API where supported.
- App logo: rounded-square tile, terracotta gradient `linear-gradient(148deg, oklch(0.72 0.12 55), oklch(0.57 0.15 37))`, with a cream **house** glyph (`clip-path: polygon(50% 0,100% 41%,100% 100%,0 100%,0 41%)`) and a small terracotta door. Wordmark: **Kita.** (Public Sans 800, the period in terracotta).

## Component Kit Mapping (React + Tailwind + shadcn/ui)
- Cards / heroes → `Card` (custom gradient variants for heroes).
- Bottom tab bar → custom fixed bar (shadcn has no nav bar); 5 items, active = terracotta.
- Segmented selects (CH/JC, asset type) → `ToggleGroup` (single) or `Tabs`.
- Category / filter chips → `ToggleGroup` items or `Badge`-style buttons.
- Switches (notifications, transferred) → `Switch`.
- Buttons / FAB → `Button` (primary = terracotta `primary-btn`; danger/outline for sign-out).
- Inputs (invite email, note, add-asset fields) → `Input` / `Textarea`.
- Progress bars → `Progress` or a simple div bar (gradient fills for budget/fund).
- Modals & flows (Add Expense, Add asset) → `Dialog` on desktop / `Drawer` (vaul) or full route on mobile.
- Swipeable rows → a swipe lib (e.g. `framer-motion` drag, or `react-swipeable`) — not in shadcn.
- Icons → `lucide-react` (replace all hand-drawn CSS glyphs). Numeric keypad, device bezel, and status bar are prototype scaffolding — the real app renders inside the actual device chrome.

## Assets
**App logo / PWA icons** are included in `logo/`:
- `kita-icon.svg` — vector source of truth (rounded-square terracotta gradient + cream house + door).
- `kita-icon-512.png`, `kita-icon-192.png` — standard PWA / favicon sizes.
- `kita-icon-maskable.svg`, `kita-icon-maskable-512.png` — extra safe-zone padding for Android maskable / iOS.

Use these for the `manifest.webmanifest` icons and home-screen icon. In-app, the small logo tile in the "1B" header and the Push cards can reuse the SVG. Everything else in the prototype is CSS: device bezels/status bars (prototype-only) and all UI icons (hand-drawn — replace with `lucide-react`). Fonts load from Google Fonts: **Public Sans**, **Noto Sans SC**, **Spline Sans Mono** (1B only).

## Files
- `Kita - Home Directions.dc.html` — the full interactive design reference (all screens across three turns). Open in a browser; use the badge IDs (1A, 2A–2E, 3A–3H) and the EN/中文 toggle to navigate. Build direction **1A**; treat 1B/1C as alternates only.
