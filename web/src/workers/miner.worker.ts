/// <reference lib="webworker" />

import { belowTarget, digestPrefix, targetWords, toHex } from "../lib/sha256";

interface StartMessage {
  type: "start";
  target: string;
  seed: number;
}

interface StopMessage {
  type: "stop";
}

type Incoming = StartMessage | StopMessage;

const BATCH = 20_000;
const REPORT_MS = 450;

let running = false;

function increment(preimage: Uint8Array): void {
  for (let i = preimage.length - 1; i >= 8; i--) {
    if (preimage[i] < 255) {
      preimage[i] += 1;
      return;
    }
    preimage[i] = 0;
  }
}

function run(target: string, seed: number): void {
  const goal = targetWords(BigInt(target));
  const digest = new Uint32Array(4);
  const preimage = new Uint8Array(16);

  let state = (seed >>> 0) || 1;
  for (let i = 0; i < 8; i++) {
    state = (state * 1664525 + 1013904223) >>> 0;
    preimage[i] = state & 0xff;
  }

  running = true;
  let hashed = 0;
  let lastReport = performance.now();

  while (running) {
    for (let i = 0; i < BATCH; i++) {
      digestPrefix(preimage, digest);
      hashed += 1;
      if (belowTarget(digest, goal)) {
        running = false;
        self.postMessage({
          type: "found",
          preimage: Array.from(preimage),
          digest: toHex(digest),
          hashed,
        });
        return;
      }
      increment(preimage);
    }

    const now = performance.now();
    if (now - lastReport >= REPORT_MS) {
      self.postMessage({ type: "progress", hashed });
      hashed = 0;
      lastReport = now;
    }
  }
}

self.onmessage = (event: MessageEvent<Incoming>) => {
  const message = event.data;
  if (message.type === "stop") {
    running = false;
    return;
  }
  if (message.type === "start") {
    run(message.target, message.seed);
  }
};
