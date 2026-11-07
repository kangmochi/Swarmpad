import { INDEXER } from "./config";
import type { MineLog } from "./types";

interface IndexerTxn {
  signer_account_id?: string;
  signer?: string;
  block?: { block_timestamp?: string; block_height?: string };
  block_timestamp?: string;
  transaction_hash?: string;
  hash?: string;
  actions?: Array<{ action?: string; method?: string }>;
  actions_agg?: { deposit?: string };
  outcomes?: { status?: boolean | string };
}

interface IndexerResponse {
  data?: IndexerTxn[];
  errors?: Array<{ message?: string }>;
}

/**
 * Recent calls to `mine` on a project token, read from the testnet indexer.
 * The token does not keep a miner list, so this is a log view, not state.
 */
export async function fetchMineLog(account: string, limit = 12): Promise<MineLog[]> {
  const url = `${INDEXER}/accounts/${account}/txns?limit=50`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);

  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(`indexer answered ${response.status}`);
  }
  const body = (await response.json()) as IndexerResponse;
  const rows = body.data ?? [];

  return rows
    .filter((row) => (row.actions ?? []).some((action) => action.method === "mine"))
    .slice(0, limit)
    .map((row) => ({
      signer: row.signer_account_id ?? row.signer ?? "unknown",
      amount: row.actions_agg?.deposit ?? "0",
      timestamp: Number(row.block?.block_timestamp ?? row.block_timestamp ?? 0) / 1e6,
      hash: row.transaction_hash ?? row.hash ?? "",
      outcome: row.outcomes?.status === true ? "success" : "failed",
    }));
}
