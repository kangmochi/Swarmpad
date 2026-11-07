import { FACTORY_ID } from "../../src/lib/config";
import { buildLaunch } from "../_lib/prepare";
import { fail, json, preflight, readJson } from "../_lib/respond";
import { projectCount, projectsPage } from "../_lib/state";

/**
 * GET  /v1/projects?from=0&limit=12   registry page
 * POST /v1/projects                   parse a launch file, return args + deposit
 *
 * Nothing is signed here. The caller gets the exact call to make with its own
 * key, which keeps this service keyless.
 */
export default async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return preflight();
  }

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

  if (request.method === "POST") {
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

  return fail("method not allowed", 405);
}
