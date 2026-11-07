import { rpcView } from "./rpc";
import type { ProjectStatus, TokenMeta, TokenState } from "./types";

export interface TokenSummary {
  account: string;
  status: ProjectStatus;
  mined: bigint;
  meta: TokenMeta | null;
}

type Accrued = [string, string, string];

const META_TTL = 300_000;
const STORAGE_PREFIX = "swarmpad:meta:";
const STORAGE_TTL = 3_600_000;

function readStored(account: string): { at: number; value: TokenMeta | null } | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + account);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { at: number; value: TokenMeta | null };
    if (Date.now() - parsed.at > STORAGE_TTL) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(account: string, value: TokenMeta | null): void {
  try {
    window.localStorage.setItem(
      STORAGE_PREFIX + account,
      JSON.stringify({ at: Date.now(), value }),
    );
  } catch {
    // Storage can be full or blocked; the in-memory cache still works.
  }
}

const metaCache = new Map<string, { at: number; value: TokenMeta | null }>();

/**
 * `ft_metadata` is only exported by the token v2 build. Projects launched on
 * the first code answer "Method not found", which is a normal state here, not
 * an error to show: the caller falls back to the slug and 18 decimals. Both
 * outcomes are cached so a list of old projects does not retry the failing view
 * on every render.
 */
export async function fetchMetadata(account: string): Promise<TokenMeta | null> {
  const cached = metaCache.get(account);
  if (cached && Date.now() - cached.at < META_TTL) {
    return cached.value;
  }
  const stored = readStored(account);
  if (stored) {
    metaCache.set(account, stored);
    return stored.value;
  }

  try {
    const raw = await rpcView<{ name: string; symbol: string; decimals: number }>(
      account,
      "ft_metadata",
    );
    const value: TokenMeta = {
      name: raw.name,
      symbol: raw.symbol,
      decimals: raw.decimals,
    };
    metaCache.set(account, { at: Date.now(), value });
    writeStored(account, value);
    return value;
  } catch {
    metaCache.set(account, { at: Date.now(), value: null });
    writeStored(account, null);
    return null;
  }
}

/** Full token state, for the project console. */
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
    meta,
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
    fetchMetadata(account),
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
    meta,
  };
}

/**
 * Lists show status, mined share and the ticker. The registry carries the
 * supply, so the level is derived with `levelFor` instead of another call.
 */
export async function fetchTokenSummary(account: string): Promise<TokenSummary> {
  const [status, mined, meta] = await Promise.all([
    rpcView<ProjectStatus>(account, "status"),
    rpcView<string>(account, "mined"),
    fetchMetadata(account),
  ]);

  return { account, status, mined: BigInt(mined), meta };
}
