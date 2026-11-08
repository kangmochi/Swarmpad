/**
 * The whole /v1 surface in one router, written against (req, res).
 *
 * Returning a Response object works on the Edge runtime and in tests, but on the
 * Node.js runtime it is not the handler contract, which is why every route
 * answered FUNCTION_INVOCATION_FAILED. res.end is the contract that holds on
 * every runtime, including `vercel dev` and a plain node server.
 */

import type { IncomingMessage, ServerResponse } from "node:http";

import { FACTORY_ID } from "../../src/lib/config.js";
import { buildLaunch, checkProof } from "./prepare.js";
import { fail, json, preflight, readJson } from "./respond.js";
import { RpcReadError } from "./rpc.js";
import { projectCount, projectsPage, projectRecord, tokenMetadata, tokenState, tokenSummary } from "./state.js";

async function listOrPrepare(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === "GET") {
    const url = new URL(req.url ?? "/", "http://localhost");
    const from = Math.max(0, Number(url.searchParams.get("from") ?? 0) || 0);
    const limit = Math.min(24, Math.max(1, Number(url.searchParams.get("limit") ?? 12) || 12));
    try {
      const [count, projects] = await Promise.all([projectCount(), projectsPage(from, limit)]);
      json(res, { factory: FACTORY_ID, count, from, limit, projects });
    } catch (error) {
      fail(res, "factory read failed", 502, error instanceof Error ? error.message : null);
    }
    return;
  }

  const body = await readJson<{ markdown?: string; creator?: string }>(req);
  if (!body?.markdown || !body?.creator) {
    fail(res, "body must be { markdown, creator }");
    return;
  }
  try {
    const intent = await buildLaunch(body.markdown, body.creator);
    json(res, intent, intent.errors.length > 0 ? 422 : 201);
  } catch (error) {
    fail(res, "could not prepare the launch", 502, error instanceof Error ? error.message : null);
  }
}

async function readProject(res: ServerResponse, slug: string): Promise<void> {
  try {
    const record = await projectRecord(slug);
    if (!record) {
      fail(res, `no project named ${slug}`, 404);
      return;
    }

    let read: [Awaited<ReturnType<typeof tokenState>>, Awaited<ReturnType<typeof tokenMetadata>>];
    try {
      read = await Promise.all([
        tokenState(record.token_account),
        tokenMetadata(record.token_account),
      ]);
    } catch (error) {
      if (error instanceof RpcReadError && error.accountMissing) {
        // The registry entry exists but the account behind it never did: two
        // launches predate the deposit fix. Answer with that, not a 502.
        json(res, {
          slug,
          version: "none",
          meta: null,
          record,
          state: null,
          note: "the launch was recorded but its project account does not exist",
        });
        return;
      }
      throw error;
    }

    const [state, meta] = read;
    json(res, {
      slug,
      version: meta ? "v2" : "v1",
      meta,
      record,
      state,
      next: {
        method: "mine",
        args: { preimage: "<16 random bytes, base64>" },
        deposit: state.claim_fee,
        target: state.target,
        level: state.level,
      },
    });
  } catch (error) {
    fail(res, "token read failed", 502, error instanceof Error ? error.message : null);
  }
}

async function prove(req: IncomingMessage, res: ServerResponse, slug: string): Promise<void> {
  const body = await readJson<{ preimage?: string }>(req);
  if (!body?.preimage) {
    fail(res, "body must be { preimage }");
    return;
  }
  try {
    const result = await checkProof(slug, body.preimage);
    json(res, { slug, ...result }, result.valid ? 202 : 422);
  } catch (error) {
    fail(res, "proof check failed", 502, error instanceof Error ? error.message : null);
  }
}


function minedBpsOf(state: { mined: string; supply: string }): number {
  const supply = BigInt(state.supply || "0");
  if (supply === 0n) return 0;
  return Number((BigInt(state.mined || "0") * 10_000n) / supply);
}

/**
 * The home page in one request: the registry count and the project the progress
 * bar speaks about. Without it the browser reads nine contracts in a row before
 * it can paint a number.
 */
async function readOverview(res: ServerResponse): Promise<void> {
  try {
    const count = await projectCount();
    // Only the newest project matters for the bar, and only five fields of it.
    const newest = count > 0 ? (await projectsPage(count - 1, 1))[0] : undefined;
    let lead: {
      slug: string;
      status: string;
      supply: string;
      mined: string;
      mined_bps: number;
      level: number;
      open: boolean;
    } | null = null;
    if (newest) {
      try {
        const state = await tokenSummary(newest.token_account);
        const now = Date.now() * 1e6;
        lead = {
          slug: newest.slug,
          status: state.status,
          supply: state.supply,
          mined: state.mined,
          mined_bps: minedBpsOf(state),
          level: state.level,
          open: state.status === "Mining" && state.deadline_ns > now,
        };
      } catch {
        lead = null;
      }
    }
    json(res, { factory: FACTORY_ID, count, lead });
  } catch (error) {
    fail(res, "overview read failed", 502, error instanceof Error ? error.message : null);
  }
}

/** Routes a request whose path has already been split into segments. */
export async function route(
  req: IncomingMessage,
  res: ServerResponse,
  parts: string[],
): Promise<void> {
  if (req.method === "OPTIONS") {
    preflight(res);
    return;
  }

  if (parts[0] === "overview") {
    if (req.method !== "GET") {
      fail(res, "method not allowed", 405);
      return;
    }
    await readOverview(res);
    return;
  }

  if (parts[0] !== "projects") {
    fail(res, "not found", 404, { path: parts.join("/") });
    return;
  }

  if (parts.length === 1) {
    if (req.method !== "GET" && req.method !== "POST") {
      fail(res, "method not allowed", 405);
      return;
    }
    await listOrPrepare(req, res);
    return;
  }

  const slug = parts[1] ?? "";

  if (parts.length === 2) {
    if (req.method !== "GET") {
      fail(res, "method not allowed", 405);
      return;
    }
    await readProject(res, slug);
    return;
  }

  if (parts.length === 3 && parts[2] === "proofs") {
    if (req.method !== "POST") {
      fail(res, "method not allowed", 405);
      return;
    }
    await prove(req, res, slug);
    return;
  }

  fail(res, "not found", 404, { path: parts.join("/") });
}
