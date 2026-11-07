import { FACTORY_ID } from "../../src/lib/config";
import { viewCall } from "./rpc";

export interface ProjectRecord {
  slug: string;
  token_account: string;
  creator_id: string;
  payout_account: string;
  supply: string;
  threshold_bps: number;
  deadline_ns: number;
  config_hash: string;
}

export interface TokenState {
  status: string;
  supply: string;
  mined: string;
  remaining: string;
  burned: string;
  level: number;
  target: string;
  reward_per_proof: string;
  epoch_cap: string;
  threshold_bps: number;
  deadline_ns: number;
  claim_fee: string;
  pool_account: string;
  accrued_fees: [string, string, string];
}

export async function projectCount(): Promise<number> {
  return viewCall<number>(FACTORY_ID, "project_count");
}

export async function projectsPage(from: number, limit: number): Promise<ProjectRecord[]> {
  return viewCall<ProjectRecord[]>(FACTORY_ID, "projects", { from, limit });
}

export async function projectRecord(slug: string): Promise<ProjectRecord | null> {
  return viewCall<ProjectRecord | null>(FACTORY_ID, "project", { slug });
}

export async function launchDeposit(): Promise<string> {
  return viewCall<string>(FACTORY_ID, "launch_deposit");
}

/** One read per view method, all in flight at once. */
export async function tokenState(account: string): Promise<TokenState> {
  const view = <T,>(method: string) => viewCall<T>(account, method);

  const [
    status,
    supply,
    mined,
    remaining,
    burned,
    level,
    target,
    reward,
    cap,
    threshold,
    deadline,
    fee,
    pool,
    accrued,
  ] = await Promise.all([
    view<string>("status"),
    view<string>("supply"),
    view<string>("mined"),
    view<string>("remaining"),
    view<string>("burned"),
    view<number>("level"),
    view<string>("target"),
    view<string>("reward_per_proof"),
    view<string>("epoch_cap"),
    view<number>("threshold_bps"),
    view<number>("deadline_ns"),
    view<string>("claim_fee"),
    view<string>("pool_account"),
    view<[string, string, string]>("accrued_fees"),
  ]);

  return {
    status,
    supply,
    mined,
    remaining,
    burned,
    level,
    target,
    reward_per_proof: reward,
    epoch_cap: cap,
    threshold_bps: threshold,
    deadline_ns: deadline,
    claim_fee: fee,
    pool_account: pool,
    accrued_fees: accrued,
  };
}

/** Metadata is only exported by the v2 token build. */
export async function tokenMetadata(
  account: string,
): Promise<{ name: string; symbol: string; decimals: number } | null> {
  try {
    return await viewCall<{ name: string; symbol: string; decimals: number }>(
      account,
      "ft_metadata",
    );
  } catch {
    return null;
  }
}
