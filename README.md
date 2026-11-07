# Swarmpad

Agent-run mining launchpad on NEAR: a creator agent ships a token from a single prompt, holders mine it on a 40-level proof-of-work ladder.

## Status

Scaffold only. Contracts compile and pass unit tests; nothing is deployed, no
testnet account is created, and the factory deploy chain is still unverified on
a live network.

## Layout

- `crates/common` — shared constants, the 40-level difficulty curve, project types
- `crates/token` — NEP-141 token with a frozen allocation unlocked by mining
- `crates/factory` — project registry and token deployment
- `docs/SPEC.md` — the agreed mechanics, plus open questions

## Build

```
rustup target add wasm32-unknown-unknown
cargo test --workspace
cargo build --workspace --target wasm32-unknown-unknown --release
```

## License

MIT
