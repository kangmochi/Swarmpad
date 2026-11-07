import { useEffect, useState } from "react";

import { CLAIM_FEE, DISPLAY_DECIMALS } from "../lib/config";
import {
  expectedHashes,
  formatDuration,
  formatHashes,
  formatNear,
  formatToken,
} from "../lib/format";
import { useMiner } from "../lib/miner";
import type { TokenState } from "../lib/types";
import { PillButton } from "./Pill";

/**
 * The mining panel. The hash loop is real: workers search for a preimage below
 * the level target, and the button that follows signs one `mine` call with the
 * 0.05 NEAR claim fee attached.
 */
export function MinePanel({
  token,
  accountId,
  onMine,
  disabled,
}: {
  token: TokenState;
  accountId: string | null;
  onMine: (preimage: string) => Promise<void>;
  disabled: boolean;
}) {
  const miner = useMiner(token.target);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    return () => miner.stop();
    // Stop the workers when the project changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token.account]);

  const decimals = token.meta?.decimals ?? DISPLAY_DECIMALS;
  const unit = token.meta?.symbol ?? "";
  const expected = expectedHashes(token.target);
  const rate = miner.hashesPerSecond;
  const eta = rate > 0 ? expected / rate : 0;

  async function submit() {
    if (!miner.preimage) {
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await onMine(miner.preimage);
      setMessage("Proof accepted. The ladder moved.");
      miner.stop();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The call did not go through.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mining">
      <div className="mining__head">
        <div>
          <p className="mono-label">Proof search</p>
          <h3>Find a preimage under the level target</h3>
        </div>
        <span className="mining__level mono-label">level {token.level} / 40</span>
      </div>

      <dl className="mining__stats">
        <div>
          <dt className="mono-label">hash rate</dt>
          <dd>{rate > 0 ? `${formatHashes(rate)}/s` : "—"}</dd>
        </div>
        <div>
          <dt className="mono-label">checked</dt>
          <dd>{formatHashes(miner.attempts)}</dd>
        </div>
        <div>
          <dt className="mono-label">expected</dt>
          <dd>{formatHashes(expected)}</dd>
        </div>
        <div>
          <dt className="mono-label">eta at this rate</dt>
          <dd>{eta > 0 ? formatDuration(eta * 1000) : "—"}</dd>
        </div>
        <div>
          <dt className="mono-label">workers</dt>
          <dd>{miner.workers || "—"}</dd>
        </div>
      </dl>

      <p className="mining__note">
        One proof unlocks {formatToken(token.rewardPerProof, decimals)} {unit || "tokens"}. The
        claim costs {formatNear(CLAIM_FEE)} and the cap is{" "}
        {formatToken(token.epochCap, decimals)} {unit ? unit : "tokens"} per account per level.
      </p>

      <div className="mining__actions">
        {miner.running ? (
          <PillButton variant="ghost" size="sm" onClick={miner.stop}>
            Stop searching
          </PillButton>
        ) : (
          <PillButton
            size="sm"
            onClick={miner.start}
            disabled={disabled || token.status !== "Mining"}
          >
            Start searching
          </PillButton>
        )}

        <PillButton
          size="sm"
          variant={miner.preimage ? "primary" : "ghost"}
          disabled={!miner.preimage || !accountId || submitting || disabled}
          onClick={() => void submit()}
        >
          {submitting ? "Submitting…" : "Submit proof"}
        </PillButton>
      </div>

      {miner.preimage ? (
        <div className="mining__found">
          <p className="mono-label">preimage</p>
          <code>{miner.preimage}</code>
          <p className="mono-label">digest prefix</p>
          <code>{miner.digest}</code>
        </div>
      ) : null}

      {miner.error ? <p className="notice notice--error">{miner.error}</p> : null}
      {message ? <p className="notice">{message}</p> : null}
      {!accountId ? (
        <p className="notice">Connect a wallet to submit the proof you find.</p>
      ) : null}
    </div>
  );
}
