# Swarmpad web

The testnet front end: registry, project console, launch flow and docs. React 19,
Vite 8, TypeScript, plain CSS on top of `docs/design/tokens.css`.

## Run

Node 24 is required (the toolchain in this repo targets it).

```bash
cd web
npm ci
npm run dev        # http://127.0.0.1:5183
npm run typecheck
npm test
npm run build      # dist/
```

## What it reads

Everything comes from the chain, through `rpc.testnet.near.org` with two
fallbacks (`near-testnet.gateway.tatum.io`, `rpc.testnet.fastnear.com`). Calls
run one at a time and a node that refuses is skipped for a minute, because the
public testnet nodes rate limit per IP.

- Factory `swarmpad.testnet`: `projects(from, limit)`, `project(slug)`,
  `project_count()`, `launch_deposit()`, `token_code_len()`.
- Token `<slug>.swarmpad.testnet`: `status`, `supply`, `mined`, `burned`,
  `remaining`, `level`, `target`, `reward_per_proof`, `epoch_cap`,
  `threshold_bps`, `deadline_ns`, `claim_fee`, `accrued_fees`, `pool_account`.

The token exports `ft_balance_of` but **not** `ft_metadata` (the metadata trait
is implemented without `#[near]`, so it is not an exported method). The app
therefore shows the slug as the project name and formats amounts with
`DISPLAY_DECIMALS = 18`, which is what every launch so far used.

## Writes

`mine(preimage)` with the 0.05 NEAR claim fee, `launch(args)` with the derived
deposit, `withdraw_fees()` and `finalize()`. Signing goes through
`@near-wallet-selector` on testnet; the wallet stack is imported on first use, so
a visitor who never connects does not download it.

The proof search runs in Web Workers (`src/workers/miner.worker.ts`) with a
specialised single-block SHA-256 (`src/lib/sha256.ts`, tested against node
crypto). It is the real search: a 16-byte preimage whose digest prefix is below
the level target. At level 1 that is a 30-bit space, so a browser tab is a slow
miner by design; the panel reports the measured hash rate and the expected work
instead of pretending otherwise.

## Layout

```
src/
  components/   header, footer, pills, mascot, ladder, cards, live panel, miner
  lib/          rpc, factory, token, projects, launch parsing, format, wallet
  routes/       Home, Projects, ProjectDetail, Launch, Docs
  styles/       tokens.css (copied from docs/design), app.css
  workers/      miner.worker.ts
```

## Checks

`npm run typecheck`, `npm test` (14 unit tests: SHA-256 against node crypto,
launch parsing and validation) and `npm run build` all pass on Node 24. A
Lighthouse mobile run against the production build scores 90 performance, 100
accessibility, 96 best practices and 100 SEO; the best-practices deduction is
console noise from the rate-limited public RPC in the sandbox, not from the app.
