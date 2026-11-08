# Voiceover script

English. One voice, calm, reading to a person who has not seen the repo. Numbers
are spoken plainly: "two point six eight seven four NEAR", "one point one zero
times", "one thousand three hundred twenty-five million" is read as "one point
three billion".

Status: rendered. Runtime 72.4 s (16:9), 28.4 s (30 s cut), 72.4 s (9:16), no burned-in
subtitles (removed at the owner's request), voice Zara. Scene starts 0 / 5.25 / 16.81 / 30.7 / 49.6 / 61.81 s; voice at 0.4 / 5.25 /
16.81 / 30.7 / 49.6 / 61.81 s. Every visual beat is anchored to a word of the take
(measured with forced alignment), so lines and numbers land together.

## Timing

| # | time | words | target speech |
|---|---|---|---|
| 1 | 0:00–0:08 | 11 | ~4s, one beat of silence before line 2 |
| 2 | 0:08–0:24 | 33 | ~13s |
| 3 | 0:24–0:42 | 35 | ~14s |
| 4 | 0:42–1:02 | 38 | ~15s |
| 5 | 1:02–1:16 | 25 | ~10s |
| 6 | 1:16–1:30 | 24 | ~10s |

166 words over 90 seconds, about 110 words per minute of picture: slow enough
that each number lands. After the first take, every line's real duration is
measured and the shot timings are adjusted to the voice, not the reverse.

## Lines

### 1 · Hook — 0:00–0:08

> Most tokens ask for belief. Swarmpad's exist only after the work.

Captions:
`Most tokens ask for belief.` · `Swarmpad's exist only after the work.`

### 2 · The file — 0:08–0:24

> A launch is one markdown file: name, symbol, supply, reward per proof. The factory hashes the whole file into a config hash — the rules you launch are the rules anyone can check.

Captions:
`A launch is one markdown file:` · `name, symbol, supply, reward per proof.` · `The factory hashes the whole file into a config hash —` · `the rules you launch are the rules anyone can check.`

On-screen text (not spoken): `sha256:c8923f7b…70 3c` = `config_hash`

### 3 · Launch — 0:24–0:42

> Paste it, and the review shows the token account before anything is signed. 2.6874 NEAR covers the code storage. The account is created with no access keys, so it can't be patched, upgraded, or rescued.

Captions:
`Paste it, and the review shows the token account` · `before anything is signed.` · `2.6874 NEAR covers the code storage.` · `The account is created with no access keys,` · `so it can't be patched, upgraded, or rescued.`

On-screen text: `validrun.swarmpad.testnet` · `ACCESS KEYS 0`

### 4 · Mining — 0:42–1:02

> Mining is SHA-256, checked on chain. A 16-byte preimage, a digest under the current target, 0.05 NEAR per claim. Forty levels, 2.5% of supply each, 1.10x harder every level. This run: 1.3 billion hashes in two minutes thirty-four.

Captions:
`Mining is SHA-256, checked on chain.` · `A 16-byte preimage, a digest under the current target,` · `0.05 NEAR per claim.` · `Forty levels, 2.5% of supply each,` · `1.10x harder every level.` · `This run: 1.3 billion hashes in two minutes thirty-four.`

On-screen text: `1,325.46M hashes in 2m 34s` · `preimage F4phTDteJUAAAAAAD9lyvA==` · `tx aHEVHJvHuesV4v7b39SysbZ8wZZCpbQcfL9VxTNBxPu`

### 5 · The ending — 1:02–1:16

> At the deadline, finalize. Validrun cleared the bar at fifty percent: Valid, half the supply burned. Swarm3 missed, and 950,000 burned. Neither can be changed.

Captions:
`At the deadline, finalize.` · `Validrun cleared the bar at fifty percent:` · `Valid, half the supply burned.` · `Swarm3 missed, and 950,000 burned.` · `Neither can be changed.`

On-screen text: `VALID · 50% MINED · 500,000 BURNED` · `FAILED · 5% MINED · 950,000 BURNED`

### 6 · Agents and close — 1:16–1:30

> The same state for an agent: one request, no key held. Trading is phase two, and we say so. Built on NEAR testnet. Swarmpad.

Captions:
`The same state for an agent: one request, no key held.` · `Trading is phase two, and we say so.` · `Built on NEAR testnet.` · `Swarmpad.`

On-screen text: `curl /v1/projects/validrun` · `NO MARKET YET · PHASE 2` · `swarmpad.vercel.app`

## Deliverables

| File | Spec |
|---|---|
| `swarmpad-demo-1080p.mp4` | 1920x1080, 30 fps, 72.4 s, H.264, 11 MB |
| `swarmpad-demo-30s.mp4` | 1920x1080, 30 fps, 28.4 s, H.264, 6.0 MB |
| `swarmpad-demo-vertical.mp4` | 1080x1920, 30 fps, 72.4 s, H.264, 11 MB |
| `poster.png` | end card, reads on its own |

## Delivery

- ElevenLabs, one voice for the whole film: **Zara — The Warm, Real-World Conversationalist** (Voice Library, `jqcCZkN6Knx8BJ5TBdYR`), `eleven_multilingual_v2`, stability 0.5, similarity 0.8. No clone is used: a cloned voice needs the recorded owner's written consent, and the sample sent for cloning turned out to be someone else's interview audio (deleted again the same day).
- Measured takes: 4.50 / 11.56 / 13.89 / 18.58 / 12.21 / 9.43 s, placed at 0.5 / 7.4 / 22.4 / 38.3 / 58.2 / 77.0 s (scenes at 0 / 7 / 22 / 38 / 58 / 74 s). Caption breaks were shifted to the measured speech, not to a word-count estimate.
- No performance direction beyond: unhurried, plain, the tone of someone explaining a mechanism they trust.
- Music: one instrumental bed, generated with ElevenLabs Music (`music_v2_5`, prompt
  "minimal lofi beat, muted guitar loop, soft shaker, deep sub, sparse and airy, no vocals"),
  looped to length, mixed at -22 LUFS with a 3 dB sidechain duck under the voice, fade in
  0.8 s / fade out 2 s. Master -16.8 LUFS, true peak -2 dB. The 30 s cut and the 9:16
  version share the same bed and the same voice takes.
- Pauses: 250-400 ms at the dash in line 2, 300 ms after "before anything is signed", 400 ms before "This run", 300 ms before "Neither can be changed".
- The mining beat replays the recorded run verbatim (same hashes, preimage, tx). A live counter cannot be captured today: every project is finalised, so the app disables **Start searching** and `mine.mjs` refuses the project. Decision taken: replay, do not fake a live panel.

## Claims ledger

Every spoken and on-screen number, and where it was checked:

| Claim | Line | Source |
|---|---|---|
| 40 levels, 2.5% per level, 1.10x | 1, 2, 4 | factory `level` + `docs/SPEC.md`; console shows `LEVEL 21 / 40`, `2.5% PER LEVEL`, `L40 · 41.1×` |
| supply 1,000,000, mined 500,000, burned 500,000 | 2, 4, 5 | `/v1/projects/validrun` → `state` |
| reward per proof 500,000 on `validrun` | 2 | `/v1/projects/validrun` → `state.reward_per_proof` (0.5e24) |
| config hash equals the file's SHA-256 | 2 | `sha256sum .scratch/validrun.md` = `c8923f7b…1703c` = `record.config_hash` |
| deposit 2.6874 NEAR | 3 | factory `launch_deposit()`, `docs/TESTNET.md`. The live review panel prints `2.69 NEAR` (the app rounds to 2 decimals), so the film shows the panel as it is and prints `launch_deposit() = 2.6874 NEAR` next to it |
| zero access keys | 3 | RPC `view_access_key_list validrun.swarmpad.testnet` → `"keys": []`, explorer page |
| 0.05 NEAR claim fee | 4 | `/v1/projects/validrun` → `state.claim_fee` (0.05e24) |
| 1,325.46M hashes in 2m 34s, preimage and tx | 4 | `docs/DEMO.md` §2:00, tx `aHEVHJvHuesV4v7b39SysbZ8wZZCpbQcfL9VxTNBxPu` |
| `validrun` Valid at 50%, 500,000 burned | 5 | `/v1/projects/validrun` → `status: Valid`, `burned` |
| `swarm3` Failed at 5%, 950,000 burned | 5 | `/v1/projects/swarm3` → `status: Failed`, `burned` |
| no market, phase 2 | 6 | README §Market, `docs/SUBMISSION.md` §"What is deliberately not done" |

Nothing else is claimed. No mainnet, no audit, no DEX, no price, no user count.
