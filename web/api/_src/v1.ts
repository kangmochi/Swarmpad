import type { IncomingMessage, ServerResponse } from "node:http";

import { route } from "../_lib/handlers.js";

/**
 * One entry point for /v1/*. The rewrite in vercel.json puts the rest of the
 * path in ?path=, so routing does not depend on dynamic file names.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const raw = url.searchParams.get("path") ?? "";
  const parts = raw.split("/").filter(Boolean).map((piece) => decodeURIComponent(piece));
  await route(req, res, parts);
}
