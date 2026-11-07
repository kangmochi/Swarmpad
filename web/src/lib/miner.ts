import { useCallback, useEffect, useRef, useState } from "react";

import { toBase64 } from "./sha256";

export interface MinerState {
  running: boolean;
  attempts: number;
  hashesPerSecond: number;
  workers: number;
  preimage: string | null;
  digest: string | null;
  error: string | null;
}

const INITIAL: MinerState = {
  running: false,
  attempts: 0,
  hashesPerSecond: 0,
  workers: 0,
  preimage: null,
  digest: null,
  error: null,
};

function workerCount(): number {
  const cores = navigator.hardwareConcurrency || 2;
  return Math.max(1, Math.min(8, cores - 1));
}

/**
 * Runs the hash loop in Web Workers, one per core (capped at eight).
 *
 * The search is the real one: a 16-byte preimage whose SHA-256 prefix is below
 * the level target. Everything it reports is measured, including a hash rate
 * that starts at zero because no attempt has happened yet.
 */
export function useMiner(target: string) {
  const [state, setState] = useState<MinerState>(INITIAL);
  const workersRef = useRef<Worker[]>([]);
  const attemptsRef = useRef(0);
  const windowRef = useRef<{ at: number; hashed: number } | null>(null);

  const stop = useCallback(() => {
    for (const worker of workersRef.current) {
      worker.terminate();
    }
    workersRef.current = [];
    setState((current) => ({ ...current, running: false, hashesPerSecond: 0 }));
  }, []);

  const start = useCallback(() => {
    stop();
    if (!target) {
      return;
    }
    let spawn: () => Worker;
    try {
      spawn = () =>
        new Worker(new URL("../workers/miner.worker.ts", import.meta.url), {
          type: "module",
        });
    } catch {
      setState({ ...INITIAL, error: "Workers are blocked in this browser." });
      return;
    }

    attemptsRef.current = 0;
    windowRef.current = { at: performance.now(), hashed: 0 };
    const count = workerCount();
    const workers: Worker[] = [];

    for (let index = 0; index < count; index++) {
      let worker: Worker;
      try {
        worker = spawn();
      } catch {
        setState({ ...INITIAL, error: "Workers are blocked in this browser." });
        return;
      }


      worker.onmessage = (event: MessageEvent<Record<string, unknown>>) => {
        const message = event.data;
        if (message.type === "progress") {
          attemptsRef.current += Number(message.hashed ?? 0);
          const window = windowRef.current;
          if (window) {
            const now = performance.now();
            const elapsed = now - window.at;
            if (elapsed >= 500) {
              const rate = ((attemptsRef.current - window.hashed) / elapsed) * 1000;
              windowRef.current = { at: now, hashed: attemptsRef.current };
              setState((current) => ({
                ...current,
                attempts: attemptsRef.current,
                hashesPerSecond: rate,
              }));
            }
          }
          return;
        }

        if (message.type === "found") {
          const bytes = Uint8Array.from((message.preimage as number[]) ?? []);
          for (const other of workersRef.current) {
            other.terminate();
          }
          workersRef.current = [];
          setState((current) => ({
            ...current,
            running: false,
            hashesPerSecond: 0,
            preimage: toBase64(bytes),
            digest: String(message.digest ?? ""),
          }));
        }
      };

      worker.onerror = () => {
        setState((current) => ({ ...current, error: "A mining worker stopped." }));
      };

      worker.postMessage({ type: "start", target, seed: Date.now() + index * 7919 });
      workers.push(worker);
    }

    workersRef.current = workers;
    setState({ ...INITIAL, running: true, workers: count });
  }, [stop, target]);

  useEffect(() => stop, [stop]);

  return { ...state, start, stop };
}
