import { parentPort, workerData } from "node:worker_threads";

import { belowTarget, digestPrefix, targetWords, toHex } from "./sha256.mjs";

const { target, seed } = workerData;
const goal = targetWords(BigInt(target));
const digest = new Uint32Array(4);
const preimage = new Uint8Array(16);

let state = (seed >>> 0) || 1;
for (let i = 0; i < 8; i++) {
  state = (state * 1664525 + 1013904223) >>> 0;
  preimage[i] = state & 0xff;
}

const BATCH = 50_000;
const REPORT_MS = 500;
let hashed = 0;
let lastReport = performance.now();

for (;;) {
  for (let i = 0; i < BATCH; i++) {
    digestPrefix(preimage, digest);
    hashed += 1;
    if (belowTarget(digest, goal)) {
      parentPort.postMessage({
        type: "found",
        preimage: Array.from(preimage),
        digest: toHex(digest),
        hashed,
      });
      process.exit(0);
    }
    for (let b = 15; b >= 8; b--) {
      if (preimage[b] < 255) {
        preimage[b] += 1;
        break;
      }
      preimage[b] = 0;
    }
  }

  const now = performance.now();
  if (now - lastReport >= REPORT_MS) {
    parentPort.postMessage({ type: "progress", hashed });
    hashed = 0;
    lastReport = now;
  }
}
