import { rpcView } from "./rpc";
import type { ProjectStatus, TokenState } from "./types";

export interface TokenSummary {
  account: string;
  status: ProjectStatus;
  mined: bigint;
}

type Accrued = [string, string, string];

/**
 * The token exports `ft_balance_of` but not `ft_metadata` (the metadata trait
 * is implemented without the `#[near]` attribute, so it is not an exported
 * method). Nothing here reads a name, a ticker or a decimals value from chain:
 * the app shows the slug and formats with DISPLAY_DECIMALS.
 */
export async function fetchTokenState(account: string): Promise<TokenState> {
  const view = <T,>(method: string): Promise<T> => rpcView<T>(account, method);

  const [
    status,
    supply,
    mined,
    burned,
    remaining,
    level,
    target,
    reward,
    cap,
    thresholdBps,
    deadlineNs,
    claimFee,
    accrued,
    poolAccount,
  ] = await Promise.all([
    view<ProjectStatus>("status"),
    view<string>("supply"),
    view<string>("mined"),
    view<string>("burned"),
    view<string>("remaining"),
    view<number>("level"),
    view<string>("target"),
    view<string>("reward_per_proof"),
    view<string>("epoch_cap"),
    view<number>("threshold_bps"),
    view<number>("deadline_ns"),
    view<string>("claim_fee"),
    view<Accrued>("accrued_fees"),
    view<string>("pool_account"),
  ]);

  return {
    account,
    status,
    supply: BigInt(supply),
    mined: BigInt(mined),
    burned: BigInt(burned),
    remaining: BigInt(remaining),
    level,
    target,
    rewardPerProof: BigInt(reward),
    epochCap: BigInt(cap),
    thresholdBps,
    deadlineNs,
    claimFee: BigInt(claimFee),
    accrued: {
      pool: BigInt(accrued[0]),
      creator: BigInt(accrued[1]),
      protocol: BigInt(accrued[2]),
    },
    poolAccount,
  };
}

/**
 * Two calls instead of fourteen. Lists show status and the mined share, and the
 * registry already carries the supply, so the level is derived with `levelFor`.
 */
export async function fetchTokenSummary(account: string): Promise<TokenSummary> {
  const [status, mined] = await Promise.all([
    rpcView<ProjectStatus>(account, "status"),
    rpcView<string>(account, "mined"),
  ]);

  return { account, status, mined: BigInt(mined) };
}
