# Swarmpad

Agent-run mining launchpad on NEAR: a creator agent ships a token from a single prompt, holders mine it on a 40-level proof-of-work ladder.

## Status

Deployed on NEAR testnet: factory `swarmpad.testnet`, current project
`swarm3.swarmpad.testnet` on the v2 token build (which exports `ft_metadata`),
proofs mined on-chain and the claim fee split paid out. Project accounts hold
zero access keys, so tokens cannot be upgraded. Live addresses, balances and
known state are in `docs/TESTNET.md`.

- Web app: https://swarmpad.vercel.app
- CLI miner: `tools/miner`

## Layout

- `crates/common` - shared constants, the 40-level difficulty curve, project types
- `crates/token` - NEP-141 token with a frozen allocation unlocked by mining
- `crates/factory` - project registry and token deployment
- `web` - React app: registry, project console, launch flow, docs
- `tools/miner` - command line miner for testnet projects
- `docs/SPEC.md` - the agreed mechanics, plus open questions

## How mining works

A token starts with zero circulating supply. Mining unlocks a frozen allocation:
a miner submits a preimage whose SHA-256 digest is below the target of the
current level, and the contract verifies it on-chain. Every 2.5% of the supply
mined raises the level, and each level is 1.10x harder. 40 levels cover 100%.

Difficulty is not selectable per project: the base is 30 bits, the ladder is 40
levels, and the curve is x1.10 for every launch. What a launch chooses are the
parameters that were always per-project: supply, reward per proof, per-account
cap, threshold and deadline.

## Launch profiles

Two parameter sets are used, with identical rules and identical difficulty:

- **Production**: deadline 30 days, reward 0.05% of supply per proof, cap 0.5%
  per account per level. 50% of supply takes ~3.6 days and 100% ~27.5 days at a
  combined 10 MH/s, which fits the deadline.
- **Demo**: deadline 30 minutes, reward 2.5% of supply per proof (one proof per
  level), cap 2.5% per account per level. 50% of supply takes ~30 minutes at
  ~34 MH/s, so the ladder is visible during a review session.

The demo profile does not change the target, the number of levels or the curve;
it only makes the reward coarse enough to show progress live. Both profiles are
recorded on-chain at launch and readable from the token's view methods.

## Build and test

```
rustup target add wasm32-unknown-unknown
cargo build -p swarmpad-common -p swarmpad-token -p swarmpad-factory \
  --target wasm32-unknown-unknown --release
cargo test --workspace
```

`cargo test --workspace` runs the unit tests plus one sandbox test in
`integration-tests/`; the sandbox test loads the wasm artifacts, so build them
first. The sandbox test deploys the factory, uploads the token code, launches a
project and checks that the registry entry only appears through the `on_launch`
callback, that the project account has no access keys, and that an invalid
proof is rejected on-chain.

## Web app

```bash
cd web
npm ci
npm run dev      # http://127.0.0.1:5183
npm test
npm run build
```

Five routes read the factory and each token straight over JSON-RPC: the landing
page, the registry, the project console, the launch flow and the reference page.
Signing goes through `@near-wallet-selector` on testnet.

## Mine from the terminal

```bash
cd tools/miner
npm ci
node mine.mjs --project swarm3 --account <your-testnet-account>
```

The script reads the level target, searches for a preimage below it with one
worker per core, prints the measured hash rate, then submits `mine(preimage)`
with the 0.05 NEAR claim fee and re-reads `mined` and `level`. `--dry-run`
stops before the transaction. On this mini PC it runs at roughly 7-9 MH/s, so a
level 1 proof takes a couple of minutes.

## Agent API

The web deployment also serves a keyless HTTP API for agents, documented on
`/docs#agent`:

```bash
curl https://swarmpad.vercel.app/v1/projects/swarm3
curl -X POST https://swarmpad.vercel.app/v1/projects/swarm3/proofs \
  -H 'content-type: application/json' -d '{"preimage":"<base64, 16 bytes>"}'
```

- `GET /v1/projects?from=&limit=` registry page
- `GET /v1/projects/:slug` record, live state, current target and fee
- `POST /v1/projects/:slug/proofs` checks a preimage against the live target and
  returns the exact `mine` call to sign, or a 422 with the rule that failed
- `POST /v1/projects` parses a launch file into `launch` arguments plus the
  deposit

It never holds a key: every write comes back as an unsigned call for the caller
to sign. Values that exceed 2^53 (targets are 98 bits) are returned as decimal
strings.

## License

MIT
