# Swarmpad testnet deploy

Live state on NEAR testnet, checked on 7 November 2026 (Asia/Jakarta). English
only. No keys or credentials appear here.

## Addresses

| Item | Value |
| --- | --- |
| Factory | `swarmpad.testnet` |
| Current project token | `swarm3.swarmpad.testnet` (token v2) |
| Previous project token | `swarm2.swarmpad.testnet` |
| Earlier project tokens | `swarm.swarmpad.testnet`, `genesis.swarmpad.testnet` |
| Ops funding accounts | `swarmpad-ops.testnet`, `swarmpad-buf.testnet` |
| Miner account | `agentmine-1107.testnet` |
| Factory explorer | https://testnet.nearblocks.io/address/swarmpad.testnet |
| Token explorer | https://testnet.nearblocks.io/address/swarm2.swarmpad.testnet |
| Launch tx (swarm2) | `JC15Xu5vfM5AvLhYkiJ3crfSe9oPiwixAHq4eKnjCNej` |
| Mine tx (swarm2) | `7kKSfVTVpEe21TXN8UhXu79q1HY8WFg58kn9N3Nbwtnk` |
| Fee payout tx (swarm2) | `CNwKXro55ph3dUwJuDxafrUQt9pfHCj4qb3hoVLxWPkh` |

## Current build

The factory is the hardened version from `main` at `cae79e4`; the token code
was replaced on 7 November 2026 with the metadata build (see the v2 section):

- factory wasm 199,464 bytes, token wasm 238,740 bytes (v2)
- `launch_deposit()` returns 2.6874 NEAR for the current token code
- factory code was replaced in place with `without-init-call`, keeping the
  existing registry; the token code was replaced with `set_token_code`

## Project `swarm2` (hardened build)

Demo profile: supply 1,000,000 SWRM (18 decimals, `1e24` yocto), reward per
proof 25,000 SWRM (2.5% of supply), per-account cap the same, 50% threshold,
2 hour deadline, level 1 target `3.169e29` = `2^98` (30 bit base).

- Launch used the derived deposit, 2.7 NEAR attached.
- The project appears in the factory registry only because the `on_launch`
  callback saw a successful deploy receipt. This is the path that failed
  silently on the first attempt.
- One proof was found in 34 seconds of local hashing and accepted on-chain:
  `mined` = 25,000 SWRM, level now 2.
- `withdraw_fees` paid the accrued split and left nothing behind:
  token balance 2.75 to 2.70 NEAR, factory +0.035 NEAR (pool 0.025 plus
  protocol 0.01), creator +0.015 NEAR, `accrued_fees` back to `(0, 0, 0)`.

## Immutability check

`near account list-keys swarm2.swarmpad.testnet` returns an empty table: the
project account has no access keys, so nobody can redeploy or upgrade it. The
factory keeps one full-access key because it is the protocol account that
uploads the token code for new projects.

## Projects and history

- `genesis` and `swarm` run the earlier token build. Both had one proof mined
  and both reached level 2.
- `demo` and `demo2` are registry entries from before the deposit fix; neither
  has a working token. The registry is append-only by design.

## Known state

- `swarmpad.testnet` cannot be deleted while its state is large; the protocol
  refuses with "account whose state is large is temporarily banned".
- Balances: factory 4.95 NEAR available (9.28 total, 4.33 locked for storage),
  `swarm2` token 0.387 NEAR available (2.70 total), `swarmpad-ops` 5.00 NEAR,
  `swarmpad-buf` 5.00 NEAR.

## Reproduce

```bash
near contract deploy swarmpad.testnet \
  use-file target/wasm32-unknown-unknown/release/swarmpad_factory.wasm \
  with-init-call new \
  json-args '{"admin":"swarmpad.testnet","protocol_account":"swarmpad.testnet"}' \
  prepaid-gas '100 Tgas' attached-deposit '0 NEAR' \
  network-config testnet sign-with-legacy-keychain send

near contract call-function as-transaction swarmpad.testnet set_token_code \
  file-args token_code.json \
  prepaid-gas '300 Tgas' attached-deposit '3 NEAR' \
  sign-as swarmpad.testnet network-config testnet sign-with-legacy-keychain send

near contract call-function as-transaction swarmpad.testnet launch \
  json-args "$LAUNCH_ARGS" \
  prepaid-gas '300 Tgas' attached-deposit '2.6874 NEAR' \
  sign-as swarmpad.testnet network-config testnet sign-with-legacy-keychain send
```

`token_code.json` is `{"code":"<base64 of swarmpad_token.wasm>"}`.

## Token v2: `ft_metadata`

The first token build implemented `FungibleTokenMetadataProvider` without
`#[near]`, so `ft_metadata` was not an exported method: balances were readable,
name and symbol were not.

Fixed in the token crate by annotating the trait impl with `#[near]`, with a
sandbox assertion in `integration-tests/tests/factory.rs` that would fail
without it. Deployed on 7 November 2026:

- token wasm 238,740 bytes, `set_token_code` called from `swarmpad.testnet`
  with a 3 NEAR deposit, so `token_code_len()` is now 238,740
- `launch_deposit()` is now 2.6874 NEAR (was 2.60615)
- `swarm3.swarmpad.testnet` is the first project on the new code; it was
  launched with the demo profile (1M SWRM, 2.5% per proof, 50% threshold,
  2 hour deadline) and `config_hash` `sha256:5e4d9f24…c05490`
- `ft_metadata` on `swarm3` returns `{"name":"Swarm Three","symbol":"SWRM",
  "decimals":18}`; the older tokens still do not answer it, and the web app
  falls back to the slug for those
