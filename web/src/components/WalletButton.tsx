import { useState } from "react";

import hereIcon from "../assets/wallets/here.png";
import meteorIcon from "../assets/wallets/meteor.png";
import nightlyIcon from "../assets/wallets/nightly.png";
import senderIcon from "../assets/wallets/sender.png";
import { useWallet } from "../lib/hooks";
import { shortAccount } from "../lib/format";

const WALLETS = [
  { id: "meteor-wallet", name: "Meteor", note: "extension or popup", icon: meteorIcon },
  { id: "here-wallet", name: "HERE", note: "popup sign-in", icon: hereIcon },
  { id: "sender", name: "Sender", note: "extension", icon: senderIcon },
  { id: "nightly", name: "Nightly", note: "extension or app", icon: nightlyIcon },
] as const;

export function WalletButton() {
  const wallet = useWallet();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function connect(walletId: string) {
    setPending(walletId);
    try {
      await wallet.connect(walletId);
      setOpen(false);
    } catch {
      // The error line under the list is enough; the picker stays open.
    } finally {
      setPending(null);
    }
  }

  async function copy() {
    if (!wallet.accountId) {
      return;
    }
    try {
      await navigator.clipboard.writeText(wallet.accountId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  if (wallet.accountId) {
    return (
      <div className="wallet wallet--on">
        <button type="button" className="wallet__account" onClick={copy} title="Copy account">
          <span className="wallet__dot" aria-hidden="true" />
          {shortAccount(wallet.accountId)}
        </button>
        <button
          type="button"
          className="wallet__signout"
          onClick={() => void wallet.disconnect()}
        >
          {copied ? "Copied" : "Disconnect"}
        </button>
      </div>
    );
  }

  return (
    <div className="wallet">
      <button
        type="button"
        className="pill pill--ghost pill--sm"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        {wallet.connecting ? "Connecting…" : "Connect wallet"}
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="wallet__scrim"
            aria-label="Close wallet picker"
            onClick={() => setOpen(false)}
          />
          <div className="wallet__panel" role="dialog" aria-label="Choose a wallet">
            <p className="mono-label">NEAR testnet</p>
            {WALLETS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className="wallet__option"
                onClick={() => void connect(entry.id)}
                disabled={pending !== null}
              >
                <span className="wallet__brand">
                  <img src={entry.icon} alt="" width={24} height={24} />
                  {entry.name}
                </span>
                <span className="wallet__note">
                  {pending === entry.id ? "opening…" : entry.note}
                </span>
              </button>
            ))}
            {wallet.error ? <p className="wallet__error">{wallet.error}</p> : null}
            <p className="wallet__hint">
              Keys stay in the wallet. This site never asks for a seed phrase.
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
