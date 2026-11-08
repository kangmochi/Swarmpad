/**
 * JSON-RPC reads for the agent API.
 *
 * Same three public nodes the web app uses, ordered by measured latency, with
 * the first call racing all of them. No keys and no writes happen here: the API
 * only reads chain state and prepares call arguments for a caller that signs.
 */

// fastnear answers first in practice; the official endpoint is the fallback.
const ENDPOINTS = [
  "https://rpc.testnet.fastnear.com",
  "https://rpc.testnet.near.org",
];

const latency = new Map<string, number>();

function order(): string[] {
  return [...ENDPOINTS].sort(
    (a, b) => (latency.get(a) ?? Number.MAX_SAFE_INTEGER) - (latency.get(b) ?? Number.MAX_SAFE_INTEGER),
  );
}

/** An answer that is not a usable result, classified for the routes. */
export class RpcReadError extends Error {
  constructor(
    message: string,
    readonly accountMissing = false,
    readonly missingMethod = false,
  ) {
    super(message);
    this.name = "RpcReadError";
  }
}

async function post(endpoint: string, method: string, params: unknown): Promise<unknown> {
  const started = Date.now();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: method, method, params }),
    signal: AbortSignal.timeout(10_000),
  });
  const text = await response.text();
  const body = JSON.parse(text) as {
    result?: unknown;
    error?: {
      message?: string;
      data?: unknown;
      cause?: { name?: string; info?: { error_message?: string } };
    };
  };
  if (!body.error) {
    latency.set(endpoint, Date.now() - started);
  }
  if (body.error || body.result === undefined) {
    // Some nodes answer 429 with a bare { statusCode, message } body, which has
    // no JSON-RPC error field. Treat that as a node failure, not an empty result.
    const error = body.error;
    const message = String(
      error?.cause?.info?.error_message ??
        error?.cause?.name ??
        (typeof error?.data === "string" ? error.data : undefined) ??
        error?.message ??
        "rpc error",
    );
    throw new RpcReadError(message, /UNKNOWN_ACCOUNT|does not exist/i.test(message));
  }
  return body.result;
}

export async function rpc(method: string, params: unknown): Promise<unknown> {
  if (latency.size === 0) {
    const racers = ENDPOINTS.map((endpoint) =>
      post(endpoint, method, params).then((result) => ({ endpoint, result })),
    );
    try {
      const first = await Promise.any(racers);
      return first.result;
    } catch {
      // Fall through to the sequential path.
    }
  }

  let lastError: Error | null = null;
  let flagged: RpcReadError | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const endpoint of order()) {
      try {
        return await post(endpoint, method, params);
      } catch (error) {
        const failure = error instanceof Error ? error : new Error("rpc failed");
        lastError = failure;
        // One node can answer a deprecated-endpoint notice where another gives
        // the real reason (an unknown account, a missing method). Keep the
        // classified answer: the routes decide on it.
        if (
          failure instanceof RpcReadError &&
          (failure.accountMissing || failure.missingMethod) &&
          flagged === null
        ) {
          flagged = failure;
        }
      }
    }
  }
  throw flagged ?? lastError ?? new Error("no node answered");
}

export async function viewCall<T>(
  account: string,
  method: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const answer = (await rpc("query", {
    request_type: "call_function",
    finality: "final",
    account_id: account,
    method_name: method,
    args_base64: btoa(JSON.stringify(args)),
  })) as { result?: number[]; error?: string };

  if (typeof answer?.error === "string" && answer.error !== "") {
    // A contract that never exported the method answers inside `result`, not as
    // a JSON-RPC error: the oldest token builds do this for `ft_metadata` and
    // `pool_account`. Callers decide whether that is fatal.
    throw new RpcReadError(
      answer.error,
      false,
      /MethodResolveError|MethodNotFound/i.test(answer.error),
    );
  }
  if (!Array.isArray(answer?.result)) {
    throw new RpcReadError("node returned no result bytes");
  }

  const text = new TextDecoder().decode(Uint8Array.from(answer.result)).trim();
  if (text === "") {
    return null as T;
  }
  // A 98-bit target does not survive the double round trip JSON.parse does, and
  // a view that returns one arrives as bare digits rather than an object.
  if (/^-?\d{16,}$/.test(text)) {
    return text as unknown as T;
  }
  const quoted = text.replace(/([:\[,]\s*)(-?\d{16,})(\s*[,\]}])/g, '$1"$2"$3');
  return JSON.parse(quoted) as T;
}

export async function latestBlock(): Promise<{ hash: string; height: number }> {
  const block = (await rpc("block", { finality: "final" })) as {
    header: { hash: string; height: number };
  };
  return { hash: block.header.hash, height: block.header.height };
}
