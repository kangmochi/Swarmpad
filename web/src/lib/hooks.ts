import { useEffect, useRef, useState } from "react";

import type { WalletState } from "./wallet";

const IDLE: WalletState = { accountId: null, connecting: false, error: null };

type WalletModule = typeof import("./wallet");
let loading: Promise<WalletModule> | null = null;

/**
 * The wallet stack (selector core, transaction builder, four wallet modules) is
 * a few hundred kilobytes. It is imported on first use: a visitor who never
 * connects never pays for it.
 */
function loadWallet(): Promise<WalletModule> {
  loading ??= import("./wallet");
  return loading;
}

function hasSession(): boolean {
  try {
    return window.localStorage.getItem("swarmpad:session") !== null;
  } catch {
    return false;
  }
}

export function useWallet() {
  const [state, setState] = useState<WalletState>(IDLE);
  const mounted = useRef(true);
  const bound = useRef(false);

  useEffect(() => {
    mounted.current = true;
    if (hasSession()) {
      void loadWallet().then(({ wallet }) => {
        if (!mounted.current) {
          return;
        }
        bound.current = true;
        setState(wallet.state_);
        wallet.subscribe(setState);
        void wallet.restore();
      });
    }
    return () => {
      mounted.current = false;
    };
  }, []);

  async function withWallet<T>(action: (wallet: WalletModule["wallet"]) => Promise<T>): Promise<T> {
    const { wallet } = await loadWallet();
    if (!bound.current) {
      bound.current = true;
      wallet.subscribe((next) => {
        if (mounted.current) {
          setState(next);
        }
      });
      setState(wallet.state_);
    }
    return action(wallet);
  }

  return {
    ...state,
    connect: (walletId: string) => withWallet((wallet) => wallet.connect(walletId)),
    disconnect: () => withWallet((wallet) => wallet.disconnect()),
    call: (request: Parameters<WalletModule["wallet"]["call"]>[0]) =>
      withWallet((wallet) => wallet.call(request)),
  };
}

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/** One-shot read with a manual reload, used by every page that touches chain. */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    loadRef
      .current()
      .then((value) => {
        if (active) {
          setData(value);
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Read failed");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
    // deps are supplied by the caller; nonce forces a reload.
  }, [...deps, nonce]);

  return { data, error, loading, reload: () => setNonce((value) => value + 1) };
}

/** Re-renders on an interval, for countdowns and tickers. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}
