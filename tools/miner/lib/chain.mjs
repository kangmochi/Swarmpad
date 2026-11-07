/**
 * Minimal NEAR RPC client for the miner: view calls plus one broadcast.
 *
 * The public testnet nodes are rate limited and unevenly slow, so every call is
 * sent to the endpoints in order of measured latency. The first call of a
 * session races all of them and keeps the fastest answer.
 */

export const ENDPOINTS = [
  "https://rpc.testnet.near.org",
  "https://near-testnet.gateway.tatum.io",
  "https://rpc.testnet.fastnear.com",
];

const latency = new Map();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function order() {
  return [...ENDPOINTS].sort(
    (a, b) => (latency.get(a) ?? Number.MAX_SAFE_INTEGER) - (latency.get(b) ?? Number.MAX_SAFE_INTEGER),
  );
}

async function post(endpoint, body) {
  const started = Date.now();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    latency.delete(endpoint);
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 120)}`);
  }
  if (!response.ok && !parsed.error) {
    latency.delete(endpoint);
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 120)}`);
  }
  if (parsed.error) {
    // A contract error is a real answer: the node is healthy.
    latency.set(endpoint, Date.now() - started);
    return parsed;
  }
  latency.set(endpoint, Date.now() - started);
  return parsed;
}

const payload = (method, params) => ({ jsonrpc: "2.0", id: method, method, params });

export async function rpc(method, params) {
  // Nothing measured yet: ask everyone at once and keep the first answer.
  if (latency.size === 0) {
    const racers = ENDPOINTS.map((endpoint) =>
      post(endpoint, payload(method, params)).then((body) => ({ endpoint, body })),
    );
    try {
      const { body } = await Promise.any(racers);
      if (body.error) {
        throw new Error(String(body.error.data ?? body.error.message));
      }
      return body.result;
    } catch {
      // Fall through to the sequential path below.
    }
  }

  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const endpoint of order()) {
      try {
        const body = await post(endpoint, payload(method, params));
        if (body.error) {
          const reason = body.error.data ?? body.error.message ?? "rpc error";
          throw new Error(String(reason));
        }
        return body.result;
      } catch (error) {
        lastError = error;
      }
    }
    await sleep(500 * (attempt + 1));
  }
  throw lastError ?? new Error("no node answered");
}

export async function viewCall(account, method, args = {}) {
  const result = await rpc("query", {
    request_type: "call_function",
    finality: "final",
    account_id: account,
    method_name: method,
    args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
  });
  const text = Buffer.from(result.result).toString("utf8");
  return text ? JSON.parse(text) : null;
}

export async function accessKey(accountId, publicKey) {
  return rpc("query", {
    request_type: "view_access_key",
    finality: "final",
    account_id: accountId,
    public_key: publicKey,
  });
}

export async function latestBlock() {
  return rpc("block", { finality: "final" });
}

export async function broadcast(signedBytes) {
  return rpc("broadcast_tx_commit", [Buffer.from(signedBytes).toString("base64")]);
}
