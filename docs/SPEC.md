# Swarmpad - Spec

Agreed mechanics for the first release. Everything in this file is a decision,
not an idea; anything still open is listed at the end.

## 1. Ownership

- A project is owned by the protocol, not by its creator.
- The factory deploys each token on `<slug>.<factory account>`. After init no
  party holds an upgrade or admin key on that token: the code cannot be
  replaced, the rules cannot be changed, and nobody can withdraw funds.
- The creator is recorded only as `creator_id` and as the payout account for
  the creator share of the claim fee. The creator gets no free allocation and
  mines under the same rules as everyone else.
- The factory keeps an admin (the protocol) for one reason only: uploading the
  token wasm used by *new* projects. Existing projects are unaffected.
- Cost of immutability: a bug cannot be patched in place. A fix ships as a new
  token version and old projects keep running as deployed.

## 2. Supply and mining

- Supply is fixed at launch. Mining does not create new supply; it unlocks a
  frozen allocation, so `reward_per_proof` is a claim against the ceiling.
- The token starts with zero circulating supply. Every mint is a proof of work.
- Mining means finding a preimage whose SHA-256 digest is below the target of
  the current level. The contract verifies it on-chain; no oracle is trusted.
- 40 levels. Each level covers 2.5% of the supply (250 bps), so level 40
  covers 100%.
- Difficulty grows x1.10 per level. Level 1 target is `2^(128-30)`, i.e. a 30
  bit search space. The contract compares the leading 128 bits of the digest,
  which keeps verification inside u128.
- At 50% supply the proof is ~6.12x heavier than level 1; at 100% it is ~41.1x
  heavier, and the total work to reach 100% is ~443x the first level.
- Each accepted proof mints `reward_per_proof`, capped by the remaining
  allocation.
- One account can claim at most `epoch_cap` tokens per level. The cap resets
  when the level changes, which is the anti-sybil brake as well.

## 3. Claim fee

- Every claim costs 0.05 NEAR.
- Split: 50% pool (liquidity), 30% creator, 20% protocol.
- The split is accrued in the token contract. No withdrawal path exists yet;
  moving the pool share is phase 2 (see section 6).
- No claims means no fee for anyone, so the creator only earns if the token is
  actually mined.

## 4. Deadline and outcome

- Each project has a deadline, 30 days by default, set at launch and immutable.
- The creator may raise the threshold, never lower it. Minimum is 50%.
- After the deadline anyone can call `finalize`:
  - mined >= threshold -> `Valid`
  - mined < threshold -> `Failed`
- Either way emission stops. Tokens already mined stay with their miners.
- The unmined remainder is recorded as burned and can never be minted. It never
  existed on-chain, so "burn" is an accounting fact, not a transfer.

## 5. Creating a project

- Input is a `.md` file plus one prompt. The factory never fetches a URL: the
  caller submits the file hash (`config_hash`) and the launch arguments.
- Factory launch arguments: slug, creator, payout account, name, symbol,
  decimals, supply, reward per proof, epoch cap, threshold, duration, hash.
- Slug rules: lowercase `a-z0-9-`, 1..=32 characters, no leading or trailing
  hyphen.

## 6. Liquidity (phase 2)

- Market is a classic Rhea/Ref pool: permissionless, token paired with wNEAR.
- Who provides liquidity is an economic decision, not a contract detail. The
  planned path is: creator or operator creates the pool once the threshold is
  reached, and the LP tokens are burned.
- The contract keeps the pool share of the fee accrued so this can become
  automatic later; the cross-contract call to Ref is not in this release.

## 7. Launch profiles

The rules above are identical for every project: 30-bit base, 40 levels, 2.5%
of supply per level, x1.10 per level, 50% threshold, 0.05 NEAR claim fee split
50/30/20. A launch only chooses values that were always per-project parameters
(supply, reward, cap, deadline). Two profiles are used in practice.

### Production profile

- Deadline: 30 days.
- `reward_per_proof` = 0.05% of supply, so one level needs 50 proofs and 100%
  needs 2000 proofs.
- `epoch_cap` = 0.5% of supply per account per level (10 proofs), so at least
  five accounts are needed to fill one level.
- Work: 50% of supply is ~3.08e12 hashes, 100% is ~2.37e13 hashes. At a
  combined 10 MH/s that is ~3.6 days to 50% and ~27.5 days to 100%, which fits
  the 30-day deadline.

### Demo profile

- Deadline: 30 minutes.
- `reward_per_proof` = 2.5% of supply, so one proof moves the ladder exactly
  one level and 100% needs 40 proofs.
- `epoch_cap` = 2.5% of supply per account per level, i.e. one proof per level
  per account. Miners take turns instead of one account sweeping a level.
- Work: 50% of supply is ~6.15e10 hashes. At ~34 MH/s (about 8 cores) that is
  ~30 minutes, so judges can watch the ladder move during a session. Reaching
  100% needs ~4 hours, which the demo does not attempt.

The demo profile changes no rule and no difficulty: the target, the 40 levels
and the x1.10 curve are byte-for-byte the same as production. It only makes the
reward coarse enough to show progress live. Nothing about the profile is
hidden: the factory records the launch arguments on-chain and the token exposes
them through its view methods.

## 8. Open questions

These block a testnet launch, not the scaffold:

1. Exact `.md` schema (fields the agent endpoint maps to launch arguments).
2. Whether the factory deletes its access key on the new account after init.
   The scaffold does not claim immutability is enforced until this is verified
   against testnet.
3. Launch deposit floor (`MIN_LAUNCH_DEPOSIT`), currently 0.5 NEAR.
