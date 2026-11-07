/** Small helpers so every handler answers the same shape, Node style. */

import type { IncomingMessage, ServerResponse } from "node:http";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type",
  "cache-control": "no-store",
};

export function json(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", ...CORS });
  res.end(JSON.stringify(data, null, 2));
}

export function fail(
  res: ServerResponse,
  message: string,
  status = 400,
  extra: unknown = null,
): void {
  json(res, { error: message, detail: extra }, status);
}

export function preflight(res: ServerResponse): void {
  res.writeHead(204, CORS);
  res.end();
}

export async function readJson<T>(req: IncomingMessage): Promise<T | null> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
