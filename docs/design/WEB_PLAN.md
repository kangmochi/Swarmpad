# Web build plan

Handoff note for the session that builds `web/`. Everything the build needs is
in the repo: mechanics in `docs/SPEC.md`, layout blueprint in
`docs/design/REFERENCE.md`, palette and type in `docs/design/tokens.css`,
mascot art in `docs/design/mascot/`.

## Stack

Same settings as the earlier project web app so patterns carry over:

- React 19, Vite 8, TypeScript, `react-router`, `vitest`
- Plain CSS importing `docs/design/tokens.css` (copied to `web/src/styles/tokens.css`)
- `near-api-js` / raw JSON-RPC for read calls, `@near-wallet-selector/*` for writes
- Node 24 at `~/.local/node24/bin` (host default is 22; the toolchain needs 24)
- Static build, deployed to Vercel

## Routes

| Route | Content |
| --- | --- |
| `/` | Hero with mascot, one-line promise, CTA, numbered feature grid 01-08, live panel, stat band, proof grid, community, footer |
| `/projects` | Registry from `projects(from, limit)`, one card per project with status, mined %, level, deadline |
| `/projects/:slug` | Project console: ladder 40 levels, target, mined %, countdown, status, fee rows, miner table, actions |
| `/launch` | `.md` paste, parsed fields, launch deposit from `launch_deposit()`, review, submit |
| `/docs` | `.md` schema, agent endpoint sketch, contract addresses, button-free reference page |

## Contract surface to read

- Factory `swarmpad.testnet`: `projects(from, limit)`, `project(slug)`,
  `project_count()`, `launch_deposit()`, `token_code_len()`
- Token `<slug>.swarmpad.testnet`: `status`, `supply`, `mined`, `mined_bps`,
  `remaining`, `level`, `target`, `reward_per_proof`, `epoch_cap`,
  `threshold_bps`, `deadline_ns`, `claim_fee`, `accrued_fees`, `pool_account`,
  `ft_balance_of`, `ft_total_supply`, `ft_metadata`

## Writes

- `mine(preimage)` with 0.05 NEAR, preimage found in a Web Worker (SHA-256 loop)
- `launch(args)` with the derived deposit
- `withdraw_fees()`, `finalize()` on the project page
- Wallet: testnet only, one connect button in the header

## Components

Pill nav header, hero with mascot, numbered feature card, live panel with
segmented tabs, stat band, project card, level ladder, miner table, fee row,
primary and ghost pill buttons, utility chips. Button groups follow the
taxonomy in REFERENCE.md: primary action, navigation, utility, state.

## Mascot

`docs/design/mascot/` holds WebP and PNG at 512 and 1024 for three states:
`mascot-idle`, `mascot-happy`, `mascot-sad`. Copy them to
`web/src/assets/mascot/`. Idle in the hero and empty states, happy after a
successful mine or level up, sad on a rejected proof or a FAILED project. CSS
animation only: slow bob, antenna sway, small tilt on hover; no GIF.

## Palette

Ink violet `#140C2B` page, surface `#1E1340`, raised `#2A1B4D`, border
`#3A2A66`. Text `#F1EBD6` (CRT cream), muted `#A79FC4` (lilac). Neon cyan
`#3DD9E8` for primary actions and links, hot pink `#FF4FA3` for progress and
badges, phosphor green `#6DFF9C` for live/success, amber `#FFB000` for warnings,
screen black `#0B0F1A` for code and terminal surfaces. All through CSS
variables in `tokens.css`.

## Acceptance for the first pass

- `npm run build` and `npm run typecheck` pass with Node 24
- All five routes render, data loads from testnet factory
- Wallet connects and a mine transaction can be signed on testnet
- Lighthouse mobile performance 90+ on the landing route
- No placeholder copy, no lorem ipsum, English only

## Out of scope

Agent-facing HTTP API, Ref pool integration, mainnet deploy.

## Notes from the build

- The first token build implemented the metadata trait without `#[near]`, so
  `ft_metadata` was not exported. Fixed in the v2 token code (`swarm3` is the
  first project on it). The app reads `ft_metadata` and falls back to the slug
  and `DISPLAY_DECIMALS = 18` for older projects, which are immutable.
- Public testnet nodes rate limit per IP, so reads run one at a time, walk three
  nodes (`rpc.testnet.near.org`, `near-testnet.gateway.tatum.io`,
  `rpc.testnet.fastnear.com`) and skip a node that refused for a minute. The
  first call of a session races all three and keeps whichever answers first.
- Lists read two calls per project (`status`, `mined`, plus one cached
  `ft_metadata`) and derive the level from the registry supply; the console
  reads the full state.
- Every project is labelled with the token build it runs (`token v1`,
  `token v2`, `no token`), so the difference between "old project" and "old
  code" is explicit and checkable on chain. `/docs#versions` holds the table.
- Lighthouse mobile on the production build: 90 performance, 100 accessibility,
  96 best practices, 100 SEO. The best-practices deduction is console noise from
  the rate-limited public RPC in the build sandbox.
