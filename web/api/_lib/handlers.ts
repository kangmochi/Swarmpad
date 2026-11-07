/**
 * The whole /v1 surface in one place.
 *
 * A single catch-all function keeps deployment simple: one entry point, no
 * dynamic-route resolution to rely on, and the same handler answers /api/ping.
 */

import { FACTORY_ID } from "../../src/lib/config.js";
import { buildLaunch, checkProof } from "./prepare.js";
import { fail, json, preflight, readJson } from "./respond.js";
import { projectCount, projectsPage, projectRecord, tokenMetadata, tokenState } from "./state.js";

function segments(request: Request): string[] {
  const path = new URL(request.url).pathname.replace(/^\/(api|v1)/, "");
  return path.split("/").filter(Boolean);
}

async function listOrPrepare(request: Request): Promise<Response> {
  if (request.method === "GET") {
    const url = new URL(request.url);
    const from = Math.max(0, Number(url.searchParams.get("from") ?? 0) || 0);
    const limit = Math.min(24, Math.max(1, Number(url.searchParams.get("limit") ?? 12) || 12));
    try {
      const [count, projects] = await Promise.all([projectCount(), projectsPage(from, limit)]);
      return json({ factory: FACTORY_ID, count, from, limit, projects });
    } catch (error) {
      return fail("factory read failed", 502, error instanceof Error ? error.message : null);
    }
  }

  const body = await readJson<{ markdown?: string; creator?: string }>(request);
  if (!body?.markdown || !body?.creator) {
    return fail("body must be { markdown, creator }");
  }
  try {
    const intent = await buildLaunch(body.markdown, body.creator);
    return json(intent, intent.errors.length > 0 ? 422 : 201);
  } catch (error) {
    return fail("could not prepare the launch", 502, error instanceof Error ? error.message : null);
  }
}

async function readProject(slug: string): Promise<Response> {
  try {
    const record = await projectRecord(slug);
    if (!record) {
      return fail(`no project named ${slug}`, 404);
    }
    const [state, meta] = await Promise.all([
      tokenState(record.token_account),
      tokenMetadata(record.token_account),
    ]);
    return json({
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
    return fail("token read failed", 502, error instanceof Error ? error.message : null);
  }
}

async function prove(request: Request, slug: string): Promise<Response> {
  const body = await readJson<{ preimage?: string }>(request);
  if (!body?.preimage) {
    return fail("body must be { preimage }");
  }
  try {
    const result = await checkProof(slug, body.preimage);
    return json({ slug, ...result }, result.valid ? 202 : 422);
  } catch (error) {
    return fail("proof check failed", 502, error instanceof Error ? error.message : null);
  }
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return preflight();
  }

  const parts = segments(request);

  if (parts.length === 1 && parts[0] === "ping") {
    return json({
      ok: true,
      runtime: typeof process === "undefined" ? "web" : `node ${process.version}`,
      now: new Date().toISOString(),
    });
  }

  if (parts[0] !== "projects") {
    return fail("not found", 404, { path: parts.join("/") });
  }

  if (parts.length === 1) {
    if (request.method !== "GET" && request.method !== "POST") {
      return fail("method not allowed", 405);
    }
    return listOrPrepare(request);
  }

  const slug = decodeURIComponent(parts[1] ?? "");

  if (parts.length === 2) {
    if (request.method !== "GET") {
      return fail("method not allowed", 405);
    }
    return readProject(slug);
  }

  if (parts.length === 3 && parts[2] === "proofs") {
    if (request.method !== "POST") {
      return fail("method not allowed", 405);
    }
    return prove(request, slug);
  }

  return fail("not found", 404, { path: parts.join("/") });
}
