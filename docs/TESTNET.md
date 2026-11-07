# Swarmpad testnet deploy

Live state on NEAR testnet, checked on 7 November 2026 (Asia/Jakarta). English
only. No keys or credentials appear here.

## Addresses

| Item | Value |
| --- | --- |
| Factory | `swarmpad.testnet` |
| Demo project token | `genesis.swarmpad.testnet` |
| Factory explorer | https://testnet.nearblocks.io/address/swarmpad.testnet |
| Token explorer | https://testnet.nearblocks.io/address/genesis.swarmpad.testnet |
| Launch tx | `7R83EcakdbKLqvfEka6gL43iH4QQucAw7LXahAEw41P5` |
| First mine tx | `zDkrDjLBaZEWmwjoVvr8c8upg4GroEWh2ASbnbsrg6N` |

## Demo project (`genesis`)

- Supply 1,000,000 SWRM (18 decimals, `1e24` yocto).
- Reward per proof 25,000 SWRM (2.5% of supply), per-account cap the same, so
  one proof moves the ladder exactly one level.
- Threshold 5,000 bps (50%), deadline 30 minutes after launch.
- Level 1 target `3.169e29` = `2^98`, i.e. the agreed 30-bit base.
- The first proof was found in 36 seconds of local hashing (about 5.7 MH/s on
  6 cores) and accepted on-chain: `mined` moved to 25,000 SWRM and the level
  advanced to 2.
- Claim fee split confirmed on-chain: 0.025 NEAR pool, 0.015 NEAR creator,
  0.01 NEAR protocol.

## Immutability check

`near account list-keys genesis.swarmpad.testnet` returns an empty table: the
project account has no access keys at all. Nobody can redeploy or upgrade that
token. The factory keeps one full-access key because it is the protocol account
that uploads the token code for new projects.

## What went wrong on the first attempts

- `demo.swarmpad.testnet` was never created. `launch` returned success because
  promise results are not awaited, but the token account was absent.
- `demo2.swarmpad.testnet` was created and then failed with
  `LackBalanceForState` (deficit 1.78751 NEAR): the 0.5 NEAR deposit did not
  cover storing the 228 KB token wasm.
- `set_token_code` trapped whenever a deposit was attached, because the method
  was not `#[payable]`.

Both contract bugs are fixed on `main` (PR #3): `launch` derives the deposit
from the code size, and `set_token_code` accepts a deposit.

## Known state of this deploy

- The factory on chain still runs the pre-fix build. It works when the caller
  attaches about 3 NEAR to `launch`, because the deposit is forwarded in full;
  `genesis` was created that way.
- `demo` and `demo2` stay in the factory registry without a working token. The
  registry is append-only by design; a clean factory deploy drops them.
- Deleting `swarmpad.testnet` is refused by the protocol right now ("account
  whose state is large is temporarily banned"), so the account is kept.
- Balances: factory 0.793 NEAR available (4.98 total, 4.18 locked for storage),
  token 0.760 NEAR available (3.05 total).

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
  prepaid-gas '300 Tgas' attached-deposit '3 NEAR' \
  sign-as swarmpad.testnet network-config testnet sign-with-legacy-keychain send
```

`token_code.json` is `{"code":"<base64 of swarmpad_token.wasm>"}`.
