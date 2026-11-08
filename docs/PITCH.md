# Submission copy

Text blocks ready to paste. Everything below is checked against the live testnet
deployment; nothing describes a feature that is not deployed.

## One line

Swarmpad turns a markdown file into a fixed-supply NEAR token that only unlocks
through proof-of-work.

## 50 words

A creator agent writes a markdown file and gets a token on NEAR testnet. The
supply is frozen at launch and starts locked. Miners submit SHA-256 proofs to
unlock it level by level, 40 levels, each 1.10x harder. At the deadline the
project is finalized `Valid` or `Failed`, and the rest is burned.

## 150 words

Most token launches ask for belief. Swarmpad asks for work.

An agent writes a markdown file — name, symbol, supply, reward per proof — and
the factory deploys a token whose entire supply is locked at birth. Nothing is
transferable until someone mines it: a 16-byte preimage whose SHA-256 digest sits
under the target of the current level, verified on chain, 0.05 NEAR per claim.
Forty levels, 2.5% of supply each, 1.10x harder every time.

The fee splits 50/30/20 for the liquidity pool, the creator and the protocol, and
the destinations are fixed in state, so anyone can pay it out and nobody can
redirect it. At the deadline the project is finalized: `Valid` if the mined share
cleared the threshold, `Failed` otherwise, with the remainder burned.

Project accounts have no access keys. A token cannot be patched, upgraded or
rescued — the rules you read are the rules that run.

## Things to open, in this order

1. https://swarmpad.vercel.app — the landing page reads its minting bar from chain
2. `/projects/validrun` — a project that cleared its threshold and burned the rest
3. `/projects/swarm3` — a project that missed, and is permanent
4. `/docs#mining` — how to mine from the browser, the CLI or the API
5. `https://swarmpad.vercel.app/v1/projects/validrun` — the same state for a machine

## Facts for a form

- Network: NEAR testnet, factory `swarmpad.testnet`
- Token standard: NEP-141, custom unlock mechanics
- Claim fee: 0.05 NEAR, split 50 pool / 30 creator / 20 protocol
- Ladder: 40 levels, 2.5% of supply per level, 1.10x per level
- Launch deposit: 2.6874 NEAR (token code storage), paid by the caller
- Agent surface: keyless HTTP API at `/v1`, documented at `/docs#agent`
- Verified outcomes: `validrun` `Valid` at 50% mined, 500,000 burned; four other projects finalized `Failed`
- Repository: https://github.com/kangmochi/Swarmpad

## If asked what is missing

- No market yet: the plan is a wNEAR pool on Rhea (formerly Ref), with the pool
  share accruing from the first claim. Stated as planned, not deployed, everywhere.
- No mainnet: testnet only, no audit, so no real money.
- No backend beyond the keyless API: the web app reads JSON-RPC directly.
