# Swarmpad miner (CLI)

A terminal miner for Swarmpad testnet projects. It searches for a 16-byte
preimage whose SHA-256 prefix sits below the level target, then submits
`mine(preimage)` with the claim fee attached. Every number it prints is either
read from the token contract or counted locally: hash rate, attempts, digest,
transaction hash.

```bash
cd tools/miner
npm ci
node mine.mjs --project swarm3 --account agentmine-1107.testnet
```

## What it does

1. Resolves the token account (`swarm3` → `swarm3.swarmpad.testnet`, checked
   against the factory registry).
2. Reads `status`, `level`, `target`, `mined`, `supply`, `claim_fee` and
   `deadline_ns` from chain.
3. Searches with one worker thread per core (capped at eight) and prints the
   measured hash rate, attempts and an ETA.
4. On a hit, signs `mine(preimage)` with the claim fee attached and reports the
   transaction hash, then re-reads `mined` and `level` so the ladder movement is
   visible.

## Flags

| flag | default | meaning |
| --- | --- | --- |
| `--project` | `swarm3` | slug, or a full token account |
| `--account` | — | signer account; reads `~/.near-credentials/testnet/<account>.json` |
| `--key` | — | path to a key JSON instead of the default credential store |
| `--threads` | cores - 1, max 8 | worker count |
| `--dry-run` | off | search and print the proof without submitting |

## Honest numbers

On this mini PC, four threads do about **7 MH/s**, so a level 1 proof (a 2^98
target, ~1.07e9 hashes) takes roughly two to three minutes. Each level past the
first is 1.10x heavier. The demo profile (2.5% of supply per proof) moves the
ladder one level per accepted proof; the production profile needs fifty proofs
per level, which is why a browser tab alone is not a serious miner.

## Keys

The script reads an existing credential file and never prints the private key.
There is no key handling beyond that: no seed phrase prompt, no remote signer,
no telemetry. The claim fee (0.05 NEAR) comes from the signer's balance.
