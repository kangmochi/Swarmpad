# Submission checklist

What to open, and what each link proves.

## Entry points

- App: https://swarmpad.vercel.app
- Repository: https://github.com/kangmochi/Swarmpad — private while the build is
  being finished, public again at submission. A reviewer who needs it earlier can
  ask for read access.
- Factory: https://testnet.nearblocks.io/address/swarmpad.testnet
- Spec: `docs/SPEC.md` · testnet state: `docs/TESTNET.md` · demo script: `docs/DEMO.md`

## Claims and where to check them

1. **Tokens unlock only through work.**
   `/projects/validrun` shows 1M supply, 500k mined, level 21 of 40. The token's
   `mined` equals the sum of accepted proofs; supply is frozen at launch.

2. **A real proof was mined and accepted.**
   https://testnet.nearblocks.io/txns/aHEVHJvHuesV4v7b39SysbZ8wZZCpbQcfL9VxTNBxPu
   Preimage `F4phTDteJUAAAAAAD9lyvA==`, digest `00000003e9cb878c62600589663634d2`,
   0.05 NEAR attached.

3. **Both endings exist on chain.**
   `validrun` finalized `Valid` (50% mined, 500k burned);
   `swarm3` finalized `Failed` (5% mined, 950k burned).

4. **Launched tokens cannot be edited.**
   Any project account, e.g.
   https://testnet.nearblocks.io/address/validrun.swarmpad.testnet — zero access
   keys. The v1 projects missing `ft_metadata` are evidence, not a claim: they
   are immutable, so that bug is permanent for them.

5. **The fee split is real money, not a chart.**
   The console's "accrued fees" row reads the token's own accounting: 50% pool,
   30% creator, 20% protocol, payable by anyone through `withdraw_fees` because
   the destinations are fixed in state.

6. **Machines can use it.**
   ```bash
   curl https://swarmpad.vercel.app/v1/projects/validrun
   curl -X POST https://swarmpad.vercel.app/v1/projects \
     -H 'content-type: application/json' \
     -d '{"markdown":"<launch file>","creator":"you.testnet"}'
   ```
   The API holds no key; writes come back as unsigned calls.

## Checks that should pass locally

```bash
cargo build -p swarmpad-common -p swarmpad-token -p swarmpad-factory \
  --target wasm32-unknown-unknown --release
cargo test --workspace          # 18 tests, includes the sandbox launch
cd web && npm ci && npm test    # 14 unit tests
npm run build && npm run e2e    # smoke tests over the built app
```

## What is deliberately not done

- **Mainnet.** Testnet only; no audit, so no real money.
- **Market.** No pool, no DEX call. The fee accounting for it exists and accrues
  from the first claim; the planned venue is a wNEAR pool on Rhea, and the README
  and `/docs` say plainly that nothing is deployed.
- **Old token upgrades.** v1 projects stay broken; keys were burned by design.
- **A backend.** Reads go straight to JSON-RPC from the browser; the only server
  code is the keyless `/v1` API.
