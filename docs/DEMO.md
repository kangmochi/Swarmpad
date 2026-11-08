# Demo script

A three-minute walkthrough for a review call. Every number quoted here is read
from the chain at the time of writing, and every link opens the real transaction.

## 0:00 The landing page

`https://swarmpad.vercel.app`

Say: a token only exists after work. The bar under the headline is not a mock —
it is the leading project's `mined` share read over JSON-RPC, so the percentage
moves when the registry moves.

## 0:30 The registry

`/projects`

Seven projects, oldest first. Point at the two finished ones:

- `validrun` — `Valid`, 50% of supply mined
- `swarm3` — `Failed`, 5% mined, the rest burned

Both are permanent. Project accounts have no access keys, so nothing can be
changed after launch.

## 1:00 The console

`/projects/validrun`

Walk the top row: `TOKEN V2`, `VALID`, `LEVEL 21 / 40`, `50% MINED`,
`DEADLINE PASSED`. Then the ladder: 40 cells, one raised level every 2.5% mined,
each level 1.10x harder. Then the numbers: 1M supply, 500k mined, 500k burned,
0.05 NEAR per claim. On the right, the accrued fee split: 0.025 pool / 0.015
creator / 0.01 protocol.

## 1:30 Mine in the browser

Open `/projects/swarm2` (still `Mining`; it is a v1 token, so its name falls back to the slug) and press **Start searching** in the
proof panel. The hash counter runs on real Web Workers: SHA-256 in the browser,
one worker per core. When a preimage lands below the target, **Submit proof**
signs `mine(preimage)` with 0.05 NEAR attached.

If there is no wallet in the room, skip the signature and use the CLI instead.

## 2:00 The CLI miner

```bash
cd tools/miner
node mine.mjs --project validrun --dry-run
```

Then show the real run that produced the proof on chain:

```
1,325.46M hashes in 2m34s (~8.6 MH/s, 5 threads)
preimage  F4phTDteJUAAAAAAD9lyvA==
digest    00000003e9cb878c62600589663634d2
tx        aHEVHJvHuesV4v7b39SysbZ8wZZCpbQcfL9VxTNBxPu
```

`https://testnet.nearblocks.io/txns/aHEVHJvHuesV4v7b39SysbZ8wZZCpbQcfL9VxTNBxPu`

## 2:30 How it ends

`finalize` closes a project at its deadline: `Valid` if the mined share reached
the threshold, `Failed` otherwise. Either way emission stops and the unmined
remainder is burned. `validrun` finalized to `Valid` and burned 500,000 in the
same call; `swarm3` finalized to `Failed` with 950,000 burned.

## 3:00 Launch, then the agent API

`/launch` — paste a launch file. The page parses it live: token account, deposit
(2.6874 NEAR), threshold, the exact `launch` call. Nothing is signed until the
wallet confirms.

```bash
curl https://swarmpad.vercel.app/v1/projects/validrun
```

Same data for a machine, no key held by the API: every write comes back as an
unsigned call to sign.

## If a question goes past the script

- Difficulty is fixed for every launch: 30-bit base, 40 levels, 1.10x. Supply,
  reward per proof, cap, threshold and deadline are the creator's.
- The market is not deployed: the plan is a wNEAR pool on Rhea (formerly Ref),
  with the 50% pool share accruing from the first claim.
- Old v1 projects (`genesis`, `swarm`, `swarm2`) have no `ft_metadata`; that bug
  was fixed in v2 for `swarm3` onwards, and v1 tokens cannot be upgraded.
