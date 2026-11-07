import type { IncomingMessage, ServerResponse } from "node:http";

/** Health check with no imports: if this answers, the runtime works. */
export default function handler(_req: IncomingMessage, res: ServerResponse) {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(
    JSON.stringify({ ok: true, runtime: `node ${process.version}`, now: new Date().toISOString() }),
  );
}
