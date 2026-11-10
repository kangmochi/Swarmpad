# Swarmpad testnet deploy

Live state on NEAR testnet, checked on 10 November 2026 (Asia/Jakarta). English
only. No keys or credentials appear here.

## Addresses

| Item | Value |
| --- | --- |
| Factory | `swarmpad.testnet` |
| Newest project token | `swarm3.swarmpad.testnet` (token v2, finalized `Failed`) |
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

The factory code on chain is newer than the hardened build from `cae79e4`; the
current `main` is `0abc9bb`. The token code was replaced on 7 November 2026 with
the metadata build (see the v2 section). Read from the chain on 10 November 2026:

- factory wasm 204,836 bytes, sha256
  `b2f19cfb3958437adec070baabfd7c8f067299ac146fa74566f234e58b5220d3`
- token wasm 238,740 bytes (v2)
- `launch_deposit()` returns 2.6874 NEAR for the current token code
- factory code was replaced in place with `without-init-call`, keeping the
  existing registry; the token code was replaced with `set_token_code`

Earlier build, kept as history: factory wasm 199,464 bytes from `main` at
`cae79e4` (7 November 2026).

The published on-chain hash is the source of truth. A local release build is not
byte-identical to it, so a rebuild is not a way to check the deployment.

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

- `genesis` and `swarm` run the earlier token build. Both had one proof mined,
  reached level 2, and were finalized `Failed` once their deadlines passed.
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

## Mining from the CLI

`tools/miner` is a Node 24 script that reads the live target, searches for a
preimage below it with one worker per core, then signs `mine(preimage)` and
re-reads `mined` and `level`.

```bash
cd tools/miner && npm ci
node mine.mjs --project swarm3 --account agentmine-1107.testnet
node mine.mjs --project swarm3 --dry-run          # search only
```

First accepted proof on `swarm3`, mined 7 November 2026:

- tx `Hrwid88dAgQNftvYdh4eXuDpJ9VDt4pVJajf9f4Qryhf`, success
- preimage `iVSjps3IhzoAAAAAAedl4g==`, digest `000000008c3000c774e88f1f1914ca17`
- 161.34M hashes in 18s with five threads, i.e. about 9 MH/s
- result: `mined` 25,000 SWRM, level 2, fee 0.05 NEAR paid from
  `agentmine-1107.testnet`

Second proof, level 2 (target 2^97, 1.10x heavier):

- tx `3xzQ8SxMgPwgkudN1sNEu15EwyWLmdQa6yN4BXxDT5N2`, success
- preimage `+x7lAF8y6TQAAAAAJmcF1w==`, digest `00000002e355fdf24a00ea0c6e108d86`
- 3,222.44M hashes in 6m 19s with five threads, about 8.5 MH/s
- result: `mined` 50,000 SWRM (5%), level 3

The ladder is now at 5% of supply with two accepted proofs; the deadline is the
same 2 hour window, so the demo can be replayed from a terminal.

## Outcome: `swarm3` finalized as Failed

The 2 hour window closed with 5% of supply mined, so `finalize` on 7 November
2026 set the project to `Failed`:

- mined 50,000 SWRM (two accepted proofs), threshold 50%
- `burned` 950,000 SWRM, `remaining` still reports 950,000: `remaining()` is
  supply minus mined, while `burned()` is the record that the amount can never
  be minted
- emission is closed; tokens already mined stay with their miners
- the call costs gas only, no claim fee

Both outcomes are covered by sandbox tests in `integration-tests/tests/finalize.rs`,
which need no testnet funds: one project above the threshold finalizes `Valid`
with the remainder burned, one below finalizes `Failed` and rejects a valid
proof after the deadline.

## Outcome: `validrun` finalized as Valid

The other outcome needed a project that clears its threshold, so one was
launched with `reward_per_proof` = 50% of supply: a single accepted proof is
half the supply, which is the threshold.

- launch deposit 2.6874 NEAR, paid by `swarmpad-ops.testnet`; 12 minute deadline
- one proof mined: tx `aHEVHJvHuesV4v7b39SysbZ8wZZCpbQcfL9VxTNBxPu`, preimage
  `F4phTDteJUAAAAAAD9lyvA==`, 1,325.46M hashes in 2m 34s (~8.6 MH/s, five
  threads), fee 0.05 NEAR
- mined 500,000 SWRM at level 21; after the deadline `finalize` returned `Valid`
- `burned` 500,000, `remaining` 500,000 (same semantics as above)

Both outcomes now exist on testnet: `swarm3` Failed at 5% mined, `validrun`
Valid at 50% mined.

## Outcome: `swarm2` finalized as Failed

The first hardened build, left `Mining` after its deadline passed. Finalizing it
closed the last open project in the registry.

- one accepted proof: 2.5% of supply mined, level 2
- `finalize` returned `Failed`; 975,000 burned, 975,000 reported as remaining
- same immutability: no access keys, so the record is final

At that point three outcomes existed on testnet: `validrun` Valid at 50%,
`swarm3` Failed at 5%, `swarm2` Failed at 2.5%.

## Outcome: `genesis` and `swarm` finalized as Failed

The two oldest tokens still said `Mining` hours after their deadlines, which left
the registry looking unfinished. Both were finalized:

- `genesis`: 25,000 mined, 975,000 burned, `Failed`
- `swarm`: 25,000 mined, 975,000 burned, `Failed`

Every project with a contract now has a final status: one `Valid` (`validrun`,
50%) and four `Failed` (`genesis`, `swarm`, `swarm2` at 2.5%, `swarm3` at 5%).
