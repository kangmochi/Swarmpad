# Video brief

What the demo video is for, and what it must show. Written so a fresh session can
start rendering without re-reading the whole repo.

## Target

- **90 seconds**, 16:9, 1920×1080, 30 fps, H.264 MP4 under 40 MB.
- A **30 second cut** for social, plus a **9:16 vertical** version of the same beats.
- Language: **English voiceover**, burned-in English subtitles (the product is
  English-only; the owner's chat language is not the submission language).
- Audience: hackathon judges who have not seen the repo. They should understand
  the mechanic by 0:30 and see it proven on chain by 1:10.

## The one idea

A token that does not exist until someone works for it. Every claim on screen is
backed by a transaction that can be opened.

## Beats

| time | beat | on screen |
|---|---|---|
| 0:00–0:08 | Hook | Banner and mascot; the minting bar fills from 0% to 50%. Line: "Tokens that exist only after the work." |
| 0:08–0:24 | The file | The sample markdown typing itself, field names highlighting: name, symbol, slug, supply, reward_per_proof. Note that the whole file is hashed into `config_hash`. |
| 0:24–0:42 | Launch | Click "Launch a token", review panel fills (token account, 2.6874 NEAR deposit), the account is created with **no access keys**. |
| 0:42–1:02 | Mining | The console's proof panel at work: hash counter climbing; cut to the CLI printing `1,325.46M hashes in 2m 34s`, preimage `F4phTDteJUAAAAAAD9lyvA==`, then the transaction. |
| 1:02–1:16 | The ending | `validrun` at 50% mined: level 21 of 40, `finalize` → **Valid**, 500,000 burned. Cut to `swarm3` → **Failed**, 950,000 burned. |
| 1:16–1:30 | Agents and close | `curl /v1/projects/validrun` returning JSON; one honest line that the market is phase 2; logo, URL, "built on NEAR testnet". |

## Assets that already exist

- `docs/design/brand/swarmpad-banner-1500x500.png`, `swarmpad-avatar-1000.png`
- `docs/design/mascot/mascot-{idle,happy,sad}-1024.png` (three moods, all used)
- `docs/screenshots/01-home.png` … `06-home-mobile.png` (1280×900, captured from the build)
- Palette: ink `#140C2B`, surface `#1E1340`, raised `#2A1B4D`, border `#3A2A66`, cream `#F1EBD6`, muted `#A79FC4`, cyan `#3DD9E8`, pink `#FF4FA3`, green `#6DFF9C`, amber `#FFB000`, screen `#0B0F1A`
- Fonts: Outfit (headings), Inter (body), JetBrains Mono (labels) — all variable, in `web/node_modules/@fontsource-variable`
- Track: pick a CC0 loop, credit it in `docs/CREDITS.md` if one is added

## Rules

- **No invented UI.** Every screen shown must be the real app; record at 1440×900 and scale, or animate real screenshots.
- **Every number must match chain**: 0.05 NEAR per claim, 40 levels, 2.5% per level, ×1.10, 2.6874 NEAR deposit, `validrun` 50% Valid, `swarm3` 5% Failed.
- **Do not claim** a market, a DEX integration, mainnet or an audit. The market is phase 2 and the video says so in one line.
- Motion is calm: 200–400 ms ease-out, no bouncing text, no fake cursors doing impossible clicks.
- The mascot appears in at least two moods, and never as a decorative sticker over data.

## Deliverables

1. `docs/video/swarmpad-demo-1080p.mp4` (90 s)
2. `docs/video/swarmpad-demo-30s.mp4` (cut)
3. `docs/video/swarmpad-demo-vertical.mp4` (9:16)
4. `docs/video/poster.png` (first frame that reads on its own)
5. `docs/video/SCRIPT.md` — the exact voiceover lines, numbered to the beats above
