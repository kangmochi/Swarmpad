# Swarmpad testnet deploy

Live state on NEAR testnet, checked on 7 November 2026 (Asia/Jakarta). English
only. No keys or credentials appear here.

## Addresses

| Item | Value |
| --- | --- |
| Factory | `swarmpad.testnet` |
| Current project token | `swarm.swarmpad.testnet` |
| Earlier project token | `genesis.swarmpad.testnet` |
| Ops funding account | `swarmpad-ops.testnet` |
| Miner account | `agentmine-1107.testnet` |
| Factory explorer | https://testnet.nearblocks.io/address/swarmpad.testnet |
| Token explorer | https://testnet.nearblocks.io/address/swarm.swarmpad.testnet |
| Launch tx (current) | `BgxtP3njp87pKeQkW4y2r9fjyoyJmKYqnrTotNrNibWm` |
| Mine tx (current) | `8juHi6Cfy82wRHXGb4ujGY5XdGtdzgctmCPhCEEWMP9Z` |
| Launch tx (genesis) | `7R83EcakdbKLqvfEka6gL43iH4QQucAw7LXahAEw41P5` |
| First mine tx (genesis) | `zDkrDjLBaZEWmwjoVvr8c8upg4GroEWh2ASbnbsrg6N` |

## Projects on this factory

Both use the demo profile: supply 1,000,000 SWRM (18 decimals, `1e24` yocto),
reward per proof 25,000 SWRM (2.5% of supply), per-account cap the same, 50%
threshold, 30 minute deadline, level 1 target `3.169e29` = `2^98` (30 bit base).

- `swarm` was created after the fix, with the deposit the factory derived
  itself. One proof mined on-chain: `mined` = 25,000 SWRM, level now 2.
- `genesis` was created on the pre-fix build by attaching 3 NEAR by hand. One
  proof was mined and the level also moved to 2.

Mining evidence for `genesis`: the first proof was found in 36 seconds of local
hashing (about 5.7 MH/s on 6 cores). The claim fee split is visible on-chain:
0.025 NEAR pool, 0.015 NEAR creator, 0.01 NEAR protocol.

## Immutability check

`near account list-keys swarm.swarmpad.testnet` and the same call for `genesis`
return an empty table: those accounts have no access keys, so nobody can
redeploy or upgrade them. The factory keeps one full-access key because it is
the protocol account that uploads the token code for new projects.

## Bug found on the first attempts, and the fix

- `demo.swarmpad.testnet` was never created. `launch` returned success because
  promise results are not awaited, but the token account was absent.
- `demo2.swarmpad.testnet` was created and then failed with
  `LackBalanceForState` (deficit 1.78751 NEAR): the 0.5 NEAR floor did not cover
  storing the 228 KB token wasm.
- `set_token_code` trapped whenever a deposit was attached, because the method
  was not `#[payable]`.

Both are fixed on `main` (PR #3) and the fixed factory code is now deployed on
`swarmpad.testnet`, keeping the existing registry. `launch_deposit()` returns
2.58303 NEAR for the 228,303 byte token wasm, which is
`storage_byte_cost * code_len + 0.3 NEAR`.

## Known state

- Registry entries `demo` and `demo2` predate the fix and have no working token.
  The registry is append-only by design, so they stay until a fresh factory.
- `swarmpad.testnet` cannot be deleted while its state is large; the protocol
  refuses with "account whose state is large is temporarily banned".
- Balances: factory 2.76 NEAR available (6.96 total, 4.21 locked for storage),
  `swarm` token 0.760 NEAR available (3.05 total), ops account 5.00 NEAR.

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
  prepaid-gas '300 Tgas' attached-deposit '2.58303 NEAR' \
  sign-as swarmpad.testnet network-config testnet sign-with-legacy-keychain send
```

`token_code.json` is `{"code":"<base64 of swarmpad_token.wasm>"}`.
