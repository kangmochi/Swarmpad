import { actionCreators } from "@near-js/transactions";
import {
  setupWalletSelector,
  type WalletModuleFactory,
  type WalletSelector,
} from "@near-wallet-selector/core";

import { FACTORY_ID, NETWORK } from "./config";

export interface CallRequest {
  contractId: string;
  method: string;
  args: object;
  deposit?: string;
  gas?: string;
}

export interface WalletState {
  accountId: string | null;
  connecting: boolean;
  error: string | null;
}

const WALLET_KEY = "swarmpad:wallet";

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // Storage can be blocked; the choice is then simply not remembered.
  }
}

/**
 * The wallet modules are heavy, so they are imported on demand: a visitor who
 * never connects downloads none of the signing stack. Each wallet loads on its
 * own, so one failing chunk only removes that wallet from the picker.
 */
async function loadModules(): Promise<WalletModuleFactory[]> {
  const settled = await Promise.allSettled([
    import("@near-wallet-selector/meteor-wallet").then((mod) => mod.setupMeteorWallet()),
    import("@near-wallet-selector/here-wallet").then((mod) => mod.setupHereWallet()),
    import("@near-wallet-selector/sender").then((mod) => mod.setupSender()),
    import("@near-wallet-selector/nightly").then((mod) => mod.setupNightly()),
  ]);

  const modules: WalletModuleFactory[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") {
      modules.push(result.value);
    }
  }
  return modules;
}

type Listener = (state: WalletState) => void;

class Wallet {
  private selector: WalletSelector | null = null;
  private loading: Promise<WalletSelector> | null = null;
  private state: WalletState = { accountId: null, connecting: false, error: null };
  private listeners = new Set<Listener>();

  get state_(): WalletState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(next: Partial<WalletState>): void {
    this.state = { ...this.state, ...next };
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  private async selectorOnce(): Promise<WalletSelector> {
    if (this.selector) {
      return this.selector;
    }
    this.loading ??= (async () => {
      const modules = await loadModules();
      const selected = await setupWalletSelector({ network: NETWORK, modules });
      const sync = () => {
        const account = selected.store.getState().accounts[0];
        this.emit({ accountId: account?.accountId ?? null, connecting: false });
      };
      selected.on("signedIn", sync);
      selected.on("signedOut", sync);
      selected.on("accountsChanged", sync);
      this.selector = selected;
      sync();
      return selected;
    })();
    return this.loading;
  }

  /** Recovers a wallet that the browser already approved on a previous visit. */
  async restore(): Promise<void> {
    if (!readStorage(WALLET_KEY) && !readStorage("swarmpad:session")) {
      return;
    }
    try {
      await this.selectorOnce();
    } catch {
      writeStorage(WALLET_KEY, null);
    }
  }

  async connect(walletId: string): Promise<void> {
    this.emit({ connecting: true, error: null });
    try {
      const selector = await this.selectorOnce();
      const wallet = await selector.wallet(walletId);
      const params = { contractId: FACTORY_ID, accounts: [] } as never;
      const accounts = await wallet.signIn(params);
      writeStorage(WALLET_KEY, walletId);
      writeStorage("swarmpad:session", "1");
      this.emit({ connecting: false, accountId: accounts[0]?.accountId ?? null });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connection cancelled";
      this.emit({ connecting: false, error: message });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      const selector = await this.selectorOnce();
      const wallet = await selector.wallet();
      await wallet.signOut();
    } catch {
      // Signing out locally is enough when the wallet is already gone.
    }
    writeStorage(WALLET_KEY, null);
    writeStorage("swarmpad:session", null);
    this.emit({ accountId: null, error: null });
  }

  /** Sends one function call on testnet and returns the transaction hash. */
  async call(request: CallRequest): Promise<string> {
    const selector = await this.selectorOnce();
    const wallet = await selector.wallet();
    const result = await wallet.signAndSendTransaction({
      receiverId: request.contractId,
      actions: [
        actionCreators.functionCall(
          request.method,
          request.args,
          BigInt(request.gas ?? "150000000000000"),
          BigInt(request.deposit ?? "0"),
        ),
      ],
    });
    const outcomes = Array.isArray(result) ? result : result ? [result] : [];
    return outcomes[0]?.transaction_outcome.id ?? "";
  }
}

export const wallet = new Wallet();
