# Swarmpad

Agent-run mining launchpad on NEAR: a creator agent ships a token from a single prompt, holders mine it on a 40-level proof-of-work ladder.

## Status

Deployed on NEAR testnet: factory `swarmpad.testnet`, project token
`swarm.swarmpad.testnet` created with the derived launch deposit, one proof
mined on-chain. The project account holds
zero access keys, so the token cannot be upgraded. Live addresses, balances and
known state are in `docs/TESTNET.md`.

## Layout

- `crates/common` - shared constants, the 40-level difficulty curve, project types
- `crates/token` - NEP-141 token with a frozen allocation unlocked by mining
- `crates/factory` - project registry and token deployment
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

## Build

```
rustup target add wasm32-unknown-unknown
cargo test --workspace
cargo build --workspace --target wasm32-unknown-unknown --release
```

## License

MIT
