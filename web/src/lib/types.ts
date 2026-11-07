/** Wire shapes returned by the contracts. Numbers stay strings until parsed. */

export type ProjectStatus = "Mining" | "Valid" | "Failed";

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

export interface TokenMeta {
  name: string;
  symbol: string;
  decimals: number;
}

export interface TokenState {
  account: string;
  status: ProjectStatus;
  supply: bigint;
  mined: bigint;
  burned: bigint;
  remaining: bigint;
  level: number;
  target: string;
  rewardPerProof: bigint;
  epochCap: bigint;
  thresholdBps: number;
  deadlineNs: number;
  claimFee: bigint;
  accrued: { pool: bigint; creator: bigint; protocol: bigint };
  poolAccount: string;
  /** Null on projects deployed before the token exported `ft_metadata`. */
  meta: TokenMeta | null;
}

/** A project joined with whatever its token reports (or a graceful fallback). */
export interface ProjectView {
  record: ProjectRecord;
  token: TokenState | null;
  /** Set when the registry entry exists but the token cannot be read. */
  tokenError: string | null;
  status: ProjectStatus;
  minedBps: number;
  level: number;
  progress: number;
  meta?: TokenMeta | null;
}

export interface LaunchArgs {
  slug: string;
  creator_id: string;
  payout_account: string;
  name: string;
  symbol: string;
  decimals: number;
  supply: string;
  reward_per_proof: string;
  epoch_cap: string;
  threshold_bps: number;
  duration_ns: number;
  config_hash: string;
}

export interface MineLog {
  signer: string;
  amount: string;
  timestamp: number;
  hash: string;
  outcome: string;
}
