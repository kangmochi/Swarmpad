# Design reference blueprint

Structural study of one live DeFi protocol site, done on 7 November 2026. The
source site is deliberately not named here and no text, image, logo or code from
it is used. What follows is what we keep: page rhythm, type scale, spacing,
component shapes and interaction patterns. Copy, assets and brand marks are ours.

## Observed tokens

- Page background: near-black purple `#110A1F`; one darker ink `#0E0A14`.
- Text: off-white lavender `#FCEAFF`, muted at 55-65% opacity for labels and
  secondary lines. Dark ink `#261D38` is used only on light chips.
- Display face: rounded geometric display (Fredoka-like), weight 700, tracking
  about -3% at hero size, line-height around 0.84 of the size.
- UI face: grotesk (Geist-like) 18px body with 1.6 line-height; 14-16px for
  cards; 11-13px for mono labels.
- Mono face used for counters, tickers and all-caps micro labels.
- Radii: pills `9999px` everywhere for buttons, tabs and chips; panels 32-40px;
  2px for tiny tags. No mid-size 8-12px radius anywhere.
- Vertical rhythm: 112-144px between sections on desktop, 64-96px on mobile.
- Container: `max-width: 1440px`, gutters 24px mobile and 48px desktop.
- Header: fixed, transparent over content, 64px tall on mobile and 112px
  desktop, logo left, nav centre, wallet/action right.

## Page blueprint

1. Header: small mark, centred pill nav (Home / Products / Blog), right slot for
   the wallet button.
2. Hero: oversized wordmark, one-line promise under it, single pill CTA, no
   secondary button, no feature bullets. Whole viewport height.
3. Numbered feature grid: heading plus eight cards labelled `01`-`08`. Each card
   is a mono number, a short title and one sentence. Cards sit on a single
   column on mobile, two on tablet, four on desktop.
4. Live panel: a wide rounded panel under the feature grid, holding segmented
   pill tabs and a mock of the product UI.
5. Stat band: one huge sentence with a number, a mono source line under it.
6. Proof grid: 12-column desktop grid of product cards, each showing a small
   live-looking mock of that product plus a two-line description.
7. Community band: four equal social cards.
8. Footer: brand line, columns of links, legal row.

## Component inventory

- Pill nav with the active item on a light chip.
- Pill primary button (light background, dark text) and pill ghost button.
- Segmented pill tabs for switching a live mock.
- Numbered card: mono index, display title, muted body.
- Stat block: display-size sentence, mono footnote.
- Mock panel: rounded 32-40px surface, inset chips, mono ticker rows.
- Micro labels: mono, uppercase, 11-13px, 55% opacity.

## Motion

- Content reveals on scroll with a short fade and 12-16px rise, once per
  element, no bounce.
- Hover on pills: background lifts one step, no scale above 1.02.
- Numbers in the live mock update on a slow interval; nothing spins or loops
  aggressively.
- Respect `prefers-reduced-motion`: show everything, stop counters.

## Swarmpad mapping

| Blueprint slot | Swarmpad content |
| --- | --- |
| Hero | Wordmark, one line: tokens launched and mined by agents, one pill CTA (Launch a token) |
| 01-08 grid | Launch from a .md, on-chain proof of work, 40 levels x1.10, claim fee 50/30/20, 50% threshold, burn of the remainder, per-account cap, immutable project accounts |
| Live panel | Project console: level ladder, target, mined percentage, countdown, miner rows |
| Stat band | One number from chain: total SWRM mined across projects, mono source line naming the factory account |
| Proof grid | The projects in the registry, each card a live summary |
| Community band | Docs, agent endpoint, explorer, X |
| Footer | Brand line, product / protocol / resources columns, legal row |

## Button taxonomy (group by function, one style per group)

- Primary action: one per view, light pill. Launch a token, Mine, Submit proof.
- Navigation: pill ghost in the header and section links. Projects, Docs.
- Utility: small ghost chip near the thing it affects. Copy account, Explorer.
- State: appears only when relevant. Withdraw fees, Finalize project, Connect.

## Our tokens

`tokens.css` in this folder holds the variables the app imports. Default values
are a shifted palette so the result reads as Swarmpad, not as the studied site;
`--accent` and the display font are the two knobs to change when the brand
palette and mascot arrive.
