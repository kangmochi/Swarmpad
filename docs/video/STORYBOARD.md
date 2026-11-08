---
format: 1920x1080
duration: 90s
message: "A token that does not exist until someone works for it."
arc: Hook → The file → Launch → Mining → The ending → Agents and close
audience: hackathon judges who have not seen the repo
mode: collaborative
fps: 30
language: English (voiceover and burned-in subtitles)
tone: calm, factual, no hype
---

# Swarmpad demo — storyboard

Status: outline. Nothing is built yet; this file and `SCRIPT.md` are the plan to
approve before any render.

Every screen in this film is the deployed app or real chain output. No mock UI,
no invented numbers. The claims ledger at the bottom says where each number
comes from.

## Frame 1 — Hook

- scene: Banner and mascot on ink; the real minting bar fills from 0% to 50%
- duration: 8s
- transition_in: cut
- status: outline
- voiceover: "Most tokens ask for belief. Swarmpad's exist only after the work."
- reads: banner headline "Tokens that exist only after the work" (0.4-3.2s); mascot idle settles, no motion past 1.6s (1.2-4.0s); minting bar fills 0 percent → 50 percent, level 21 / 40 (4.0-7.4s)
- sound: bed enters at 0.2s, low and quiet; soft rise under the bar fill; no impact yet
- src: compositions/frames/01-hook.html
- assets: docs/design/brand/swarmpad-banner-1500x500.png, docs/design/mascot/mascot-idle-1024.png, live capture of the home page minting bar

The bar is the home page's own component, reading `validrun` over JSON-RPC: it
arrives at 50 percent with `LEVEL 21 / 40`. The film animates it up to that
value, which is the only motion in this frame.

## Frame 2 — The file

- scene: The real launch page; `validrun.md` types itself, field names highlight, then the file hashes
- duration: 16s
- transition_in: cut
- status: outline
- voiceover: "A launch is one markdown file: name, symbol, supply, reward per proof. The factory hashes the whole file into a config hash — the rules you launch are the rules anyone can check."
- reads: page and editor panel land (8.0-9.0s); frontmatter types line by line, keys `name` `symbol` `slug` `supply` `reward_per_proof` highlight cyan as each lands (9.0-16.4s); body paragraph stays muted (16.4-18.2s); hash strip resolves to `sha256:c8923f7b…70 3c` and is marked equal to the on-chain `config_hash` (18.2-23.4s)
- sound: soft key ticks only while the file types; one click as the hash resolves
- src: compositions/frames/02-file.html
- assets: live capture of `https://swarmpad.vercel.app/launch` at 1440x900, typed with the real `.scratch/validrun.md`

The file typed on screen is the one that launched `validrun`. Its SHA-256 is
`c8923f7b6b4eb99271a1afeb55150908123ab6e3ad2065939eb720649cb1703c`, which is
byte-for-byte the `config_hash` the factory stored — so the last beat of this
frame is a check, not a decoration.

## Frame 3 — Launch

- scene: Review panel fills; token account and 2.6874 NEAR deposit; account created with no access keys
- duration: 18s
- transition_in: cut
- status: outline
- voiceover: "Paste it, and the review shows the token account before anything is signed. 2.6874 NEAR covers the code storage. The account is created with no access keys, so it can't be patched, upgraded, or rescued."
- reads: review rows fill top to bottom (24.0-27.2s); `validrun.swarmpad.testnet` and `2.6874 NEAR` take the highlight (27.2-31.4s); explorer account page, access keys table empty (31.4-37.6s); console top row confirms `TOKEN V2` on the deployed account (37.6-41.6s)
- sound: one pop per row group, at most four; whoosh on the cut to the explorer
- src: compositions/frames/03-launch.html
- assets: live capture of the launch review panel, explorer capture of `validrun.swarmpad.testnet`, `docs/screenshots/03-console-validrun.png`

The access-key table is the proof, not a caption: the account has zero keys, so
the token cannot be upgraded after launch. If the explorer capture fails, the
same fact is shown as the raw JSON-RPC answer `"keys": []` in a terminal, which
is what the RPC returned when this storyboard was written.

## Frame 4 — Mining

- scene: Proof panel numbers, then the recorded terminal run, then the transaction
- duration: 20s
- transition_in: cut
- status: outline
- voiceover: "Mining is SHA-256, checked on chain. A 16-byte preimage, a digest under the current target, 0.05 NEAR per claim. Forty levels, 2.5% of supply each, 1.10x harder every level. This run: 1.3 billion hashes in two minutes thirty-four."
- reads: proof panel `LEVEL 21 / 40`, `TARGET`, `CLAIM FEE 0.05 NEAR` highlighted in turn (42.0-47.0s); terminal prints the real run header, then the counter climbs to `1,325.46M` (47.0-55.0s); `preimage F4phTDteJUAAAAAAD9lyvA==`, `digest`, `tx aHEVHJ…` (55.0-57.6s); explorer transaction, success, 0.05 NEAR attached (57.6-61.6s)
- sound: no ticks under the terminal; one soft tick when the tx line lands; bed dips under the counter
- src: compositions/frames/04-mining.html
- assets: live capture of the proof panel, verbatim terminal run from `docs/DEMO.md` §2:00, explorer capture of tx `aHEVHJvHuesV4v7b39SysbZ8wZZCpbQcfL9VxTNBxPu`

Note for approval: all seven projects are finalised, so the app disables
**Start searching** and `mine.mjs` refuses to run against them. A live counter
cannot be re-captured without launching a new project on chain. The frame as
planned replays the recorded run verbatim — same numbers, same tx — instead of
faking a live panel.

## Frame 5 — The ending

- scene: `validrun` Valid at 50% mined, 500,000 burned; cut to `swarm3` Failed, 950,000 burned
- duration: 14s
- transition_in: cut
- status: outline
- voiceover: "At the deadline, finalize. Validrun cleared the bar at fifty percent: Valid, half the supply burned. Swarm3 missed, and 950,000 burned. Neither can be changed."
- reads: `VALID`, `LEVEL 21 / 40`, `50% MINED` (62.0-65.2s); burned counter 0 → 500,000 (65.2-69.4s); cutaway to mascot sad, one line (69.4-71.2s); `swarm3` `FAILED`, `5% MINED`, burned 950,000 (71.2-75.6s)
- sound: riser into the Valid stamp, one impact; then the bed drops for the Failed card
- src: compositions/frames/05-ending.html
- assets: live captures of `/projects/validrun` and `/projects/swarm3`, `docs/design/mascot/mascot-sad-1024.png`

The mascot appears here as a full-frame cutaway on ink, never as a sticker over
the numbers. It is the third mood, after idle in the hook and happy on the end
card.

## Frame 6 — Agents and close

- scene: One `curl` returns the same state as JSON; the phase 2 line; end card
- duration: 14s
- transition_in: cut
- status: outline
- voiceover: "The same state for an agent: one request, no key held. Trading is phase two, and we say so. Built on NEAR testnet. Swarmpad."
- reads: request line, then real JSON scrolls: `status: Valid`, `mined`, `level 21`, `claim_fee`, `next.method: mine` (76.0-82.6s); phase 2 line alone on ink (82.6-86.4s); end card: avatar, wordmark, `swarmpad.vercel.app`, `Built on NEAR testnet`, mascot happy (86.4-90.0s)
- sound: one click on the request; bed resolves and fades on the end card
- src: compositions/frames/06-close.html
- assets: real `curl https://swarmpad.vercel.app/v1/projects/validrun` output trimmed to the cited keys, `docs/design/brand/swarmpad-avatar-1000.png`, `docs/design/mascot/mascot-happy-1024.png`

The JSON is the live API response, truncated with a visible ellipsis — never a
rewritten payload. The phase 2 line is on screen as text as well as in the
voiceover, so the claim cannot be missed when the film plays muted.

## Variants

**30 second cut** — same beats, fewer shots:

| time | beat | source frame |
|---|---|---|
| 0:00–0:04 | Hook, bar at 50% | Frame 1 |
| 0:04–0:10 | File types, hash lands | Frame 2 |
| 0:10–0:16 | Review panel, 2.6874 NEAR, no access keys | Frame 3 |
| 0:16–0:23 | Counter to 1,325.46M, tx success | Frame 4 |
| 0:23–0:27 | Valid / burned, Failed / burned | Frame 5 |
| 0:27–0:30 | End card | Frame 6 |

Voiceover is re-cut, not sped up: lines shorten, the delivery stays the same
pace.

**9:16 vertical** — recomposed, not cropped. Each screen is rebuilt in a
1080x1920 composition: the panel that matters is cropped to 1.15x and stacked
under the headline, captions sit at 78% height, type scales up 20%, and the
ladder and stat rows wrap to two columns. Same voiceover, same order, same
numbers.

**Poster** — `poster.png` from the hook at 5.5s: banner headline, the bar at 50%,
`Built on NEAR testnet`. It has to read with no audio.

## Rules this plan keeps

- Every screen is a live capture or real output; the only drawn elements are the ink field, the caption bar and the hash/tx highlights.
- Numbers: 0.05 NEAR claim, 40 levels, 2.5% per level, 1.10x, 2.6874 NEAR deposit, `validrun` 50% Valid, `swarm3` 5% Failed, 1,325.46M hashes in 2m34s.
- No market, no DEX, no mainnet, no audit — the phase 2 line is in frame 6.
- Motion 200-400 ms ease-out, no bounce, no fake cursor performing a click that did not happen. Clicks shown are on the real page; nothing is signed on screen.
- Mascot: idle, sad, happy — three moods, none over data.
