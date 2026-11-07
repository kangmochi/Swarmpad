import { fail, json, preflight } from "../_lib/respond";
import { projectRecord, tokenMetadata, tokenState } from "../_lib/state";

function slugFrom(request: Request): string {
  const parts = new URL(request.url).pathname.split("/").filter(Boolean);
  return decodeURIComponent(parts[parts.length - 1] ?? "");
}

/**
 * GET /v1/projects/:slug
 *
 * The project record from the factory plus the live token state, including the
 * target an agent has to beat and the fee it has to attach.
 */
export default async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return preflight();
  }
  if (request.method !== "GET") {
    return fail("method not allowed", 405);
  }

  const slug = slugFrom(request);
  if (!slug) {
    return fail("missing slug");
  }

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
