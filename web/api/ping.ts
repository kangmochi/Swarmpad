import { json } from "./_lib/respond";

/** Health check: proves the function runtime can answer at all. */
export default function handler(): Response {
  return json({
    ok: true,
    runtime: typeof process === "undefined" ? "web" : `node ${process.version}`,
    now: new Date().toISOString(),
  });
}
