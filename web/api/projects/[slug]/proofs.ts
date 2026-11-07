import { checkProof } from "../../_lib/prepare";
import { fail, json, preflight, readJson } from "../../_lib/respond";

function slugFrom(request: Request): string {
  const parts = new URL(request.url).pathname.split("/").filter(Boolean);
  return decodeURIComponent(parts[parts.length - 2] ?? "");
}

/**
 * POST /v1/projects/:slug/proofs   { preimage: "<base64, 16 bytes>" }
 *
 * Verifies the proof against the live target and returns the exact `mine` call
 * to sign. The API holds no keys, so it cannot submit on its own.
 */
export default async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return preflight();
  }
  if (request.method !== "POST") {
    return fail("method not allowed", 405);
  }

  const slug = slugFrom(request);
  const body = await readJson<{ preimage?: string }>(request);
  if (!slug || !body?.preimage) {
    return fail("body must be { preimage }");
  }

  try {
    const result = await checkProof(slug, body.preimage);
    return json({ slug, ...result }, result.valid ? 202 : 422);
  } catch (error) {
    return fail("proof check failed", 502, error instanceof Error ? error.message : null);
  }
}
