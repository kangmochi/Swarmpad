import { RPC_URL } from "./config";

/**
 * Public testnet nodes are rate limited and a browser reaches them from one
 * address for every visitor behind it. So: a small node list, one call at a
 * time, a per-node cooldown when a node refuses, and a hard timeout so a dead
 * node never blocks the page.
 */
// fastnear answers in ~0.3 s from most networks; the official endpoint can take
// several seconds and rate-limits a shared IP, so it is the fallback, not the first try.
const ENDPOINTS = ["https://rpc.testnet.fastnear.com", RPC_URL, "https://near-testnet.gateway.tatum.io"];

const TIMEOUT_MS = 3_500;
const COOLDOWN_MS = 60_000;
const ATTEMPTS = 2;
const BACKOFF = [600, 1500];

const cooldownUntil = new Map<string, number>();
/** +1 for every answer, -3 for every refusal: healthy nodes sort first. */
const health = new Map<string, number>();
let active = 0;
const waiting: Array<() => void> = [];

async function acquire(): Promise<void> {
  if (active === 0) {
    active = 1;
    return;
  }
  await new Promise<void>((resolve) => waiting.push(resolve));
  active = 1;
}

function release(): void {
  active = 0;
  const next = waiting.shift();
  next?.();
}

export class RpcError extends Error {
  constructor(
    message: string,
    readonly method: string,
    readonly account: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "RpcError";
  }
}

interface QueryResponse {
  result?: { result: number[] };
  error?: {
    message?: string;
    code?: number;
    data?: unknown;
    cause?: { name?: string; info?: { error_message?: string; requested_account_id?: string } };
  };
}

/** A registry entry whose project account was never created. */
export function isMissingAccount(error: unknown): boolean {
  if (!(error instanceof RpcError)) {
    return false;
  }
  return /does not exist|UNKNOWN_ACCOUNT/i.test(error.message);
}

/**
 * u128 values arrive as bare JSON numbers. Anything wider than 2^53 loses
 * digits in JSON.parse, so long integers are quoted before parsing and the
 * caller keeps the exact value (targets are 98 bits at level 1).
 */
export function parseLossless(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed === "") {
    return null;
  }
  // A view that returns a single u128 arrives as bare digits.
  if (/^-?\d{16,}$/.test(trimmed)) {
    return trimmed;
  }
  const quoted = trimmed.replace(/([:\[,]\s*)(-?\d{16,})(\s*[,\]}])/g, '$1"$2"$3');
  return JSON.parse(quoted) as unknown;
}

function decode(bytes: number[]): unknown {
  const text = new TextDecoder().decode(Uint8Array.from(bytes));
  return parseLossless(text);
}

function cool(endpoint: string): void {
  noteFailure(endpoint);
  cooldownUntil.set(endpoint, Date.now() + COOLDOWN_MS);
}

function available(): string[] {
  const now = Date.now();
  const fresh = ENDPOINTS.filter((endpoint) => (cooldownUntil.get(endpoint) ?? 0) < now);
  const pool = fresh.length > 0 ? fresh : [...ENDPOINTS];
  return pool.sort((a, b) => (health.get(b) ?? 0) - (health.get(a) ?? 0));
}

function noteSuccess(endpoint: string): void {
  health.set(endpoint, Math.min(5, (health.get(endpoint) ?? 0) + 1));
  cooldownUntil.delete(endpoint);
}

function noteFailure(endpoint: string): void {
  health.set(endpoint, Math.max(-6, (health.get(endpoint) ?? 0) - 3));
}

async function post(
  endpoint: string,
  account: string,
  method: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: method,
        method: "query",
        params: {
          request_type: "call_function",
          finality: "final",
          account_id: account,
          method_name: method,
          args_base64: btoa(JSON.stringify(args)),
        },
      }),
    });
  } catch {
    cool(endpoint);
    throw new RpcError("Node unreachable", method, account, true);
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 429) {
    cool(endpoint);
    throw new RpcError("Node is rate limiting", method, account, true);
  }
  if (!response.ok) {
    if (response.status >= 500) {
      cool(endpoint);
    }
    throw new RpcError(
      `Node answered HTTP ${response.status}`,
      method,
      account,
      response.status >= 500,
    );
  }

  const body = (await response.json().catch(() => null)) as QueryResponse | null;
  if (!body) {
    cool(endpoint);
    throw new RpcError("Node returned an unreadable answer", method, account, true);
  }
  if (body.error || !body.result) {
    const limited = body.error?.code === -429 || /rate limit/i.test(body.error?.message ?? "");
    if (limited) {
      cool(endpoint);
      throw new RpcError("Node is rate limiting", method, account, true);
    }
    const data = typeof body.error?.data === "string" ? body.error.data : undefined;
    const reason =
      body.error?.cause?.info?.error_message ?? data ?? body.error?.message ?? "no result";
    throw new RpcError(reason, method, account, false);
  }

  noteSuccess(endpoint);
  return decode(body.result.result);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Reads a view method. Nodes answer with the JSON return value as raw bytes, so
 * the payload is decoded here. Calls run one at a time and skip nodes that have
 * just refused a request.
 */
export async function rpcView<T>(
  account: string,
  method: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  await acquire();
  try {
    let lastError: Error | null = null;

    // First call of a session: no node has answered yet, so ask them all at
    // once and take the first reply. On a network where one node is blocked or
    // slow this saves the visitor the whole retry ladder.
    if (health.size === 0) {
      const endpoints = available();
      try {
        const first = await new Promise<{ endpoint: string; value: unknown }>(
          (resolve, reject) => {
            let pending = endpoints.length;
            let failure: Error | null = null;
            for (const endpoint of endpoints) {
              post(endpoint, account, method, args)
                .then((value) => resolve({ endpoint, value }))
                .catch((error: unknown) => {
                  failure = error instanceof Error ? error : new Error("RPC view failed");
                  pending -= 1;
                  if (pending === 0) {
                    reject(failure);
                  }
                });
            }
          },
        );
        noteSuccess(first.endpoint);
        return first.value as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("No NEAR node answered");
      }
    }

    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      for (const endpoint of available()) {
        try {
          return (await post(endpoint, account, method, args)) as T;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error("RPC view failed");
          if (error instanceof RpcError && !error.retryable) {
            throw error;
          }
        }
      }

      if (attempt < ATTEMPTS - 1) {
        await sleep(BACKOFF[Math.min(attempt, BACKOFF.length - 1)]);
      }
    }

    throw lastError ?? new Error("No NEAR node answered");
  } finally {
    release();
  }
}
