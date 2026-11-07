import { useEffect, useMemo, useState } from "react";

import { Mascot } from "../components/Mascot";
import { PillButton, PillLink } from "../components/Pill";
import { FACTORY_ID } from "../lib/config";
import { fetchLaunchDeposit } from "../lib/factory";
import { formatInt, formatNear, hashLabel } from "../lib/format";
import { useAsync, useWallet } from "../lib/hooks";
import {
  deadlineFrom,
  hashFile,
  parseMarkdown,
  resolveLaunch,
  SAMPLE,
  type Draft,
} from "../lib/launch";

export function Launch() {
  const wallet = useWallet();
  const [text, setText] = useState(SAMPLE);
  const [hash, setHash] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const deposit = useAsync(() => fetchLaunchDeposit(), []);

  const draft: Draft = useMemo(() => parseMarkdown(text), [text]);

  useEffect(() => {
    let active = true;
    hashFile(text)
      .then((value) => {
        if (active) {
          setHash(value);
        }
      })
      .catch(() => setHash(""));
    return () => {
      active = false;
    };
  }, [text]);

  const resolved = resolveLaunch(draft, wallet.accountId ?? "", hash);
  const ready = resolved.args !== null && wallet.accountId !== null;

  async function submit() {
    if (!resolved.args) {
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const tx = await wallet.call({
        contractId: FACTORY_ID,
        method: "launch",
        args: resolved.args,
        deposit: deposit.data ?? "0",
        gas: "300000000000000",
      });
      setMessage(`Launch sent · ${tx}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The launch call failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="page launch">
      <div className="page__head">
        <p className="mono-label">Launch</p>
        <h1>Paste a file. Get a token account.</h1>
        <p className="page__lede">
          The factory stores the hash of the file you paste and deploys a token on{" "}
          <code>&lt;slug&gt;.{FACTORY_ID}</code>. It never fetches a URL, so the file cannot
          change after launch.
        </p>
      </div>

      <div className="launch__grid">
        <div className="launch__editor">
          <div className="launch__bar">
            <span className="mono-label">project.md</span>
            <div className="launch__bar-actions">
              {restored ? <span className="mono-label">sample restored</span> : null}
              <button
                type="button"
                className="linkish"
                disabled={text === SAMPLE}
                onClick={() => {
                  setText(SAMPLE);
                  setRestored(true);
                  window.setTimeout(() => setRestored(false), 1600);
                }}
              >
                {text === SAMPLE ? "sample loaded" : "reset to sample"}
              </button>
            </div>
          </div>
          <textarea
            className="launch__textarea"
            spellCheck={false}
            value={text}
            onChange={(event) => setText(event.target.value)}
            aria-label="Project markdown"
            rows={22}
          />
          <p className="mono-label launch__hash">
            config_hash {hash ? hashLabel(hash) : "hashing…"}
          </p>
        </div>

        <aside className="launch__review">
          <p className="mono-label">Review</p>

          <dl className="launch__fields">
            <div>
              <dt>name</dt>
              <dd>{resolved.summary.name || "—"}</dd>
            </div>
            <div>
              <dt>symbol</dt>
              <dd>{resolved.summary.symbol || "—"}</dd>
            </div>
            <div>
              <dt>token account</dt>
              <dd className="mono-value">
                {resolved.summary.slug ? `${resolved.summary.slug}.${FACTORY_ID}` : "—"}
              </dd>
            </div>
            <div>
              <dt>supply</dt>
              <dd>{formatInt(resolved.summary.supply)}</dd>
            </div>
            <div>
              <dt>reward / proof</dt>
              <dd>{formatInt(resolved.summary.reward)}</dd>
            </div>
            <div>
              <dt>epoch cap</dt>
              <dd>{formatInt(resolved.summary.cap)}</dd>
            </div>
            <div>
              <dt>threshold</dt>
              <dd>{resolved.summary.thresholdBps / 100}%</dd>
            </div>
            <div>
              <dt>deadline</dt>
              <dd>
                {resolved.summary.durationHours > 0
                  ? `${resolved.summary.durationHours} h`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>deposit</dt>
              <dd>{deposit.data ? formatNear(deposit.data) : deposit.loading ? "…" : "—"}</dd>
            </div>
          </dl>

          {resolved.errors.length > 0 ? (
            <ul className="errors">
              {resolved.errors.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}

          {resolved.args ? (
            <p className="launch__deadline mono-label">
              closes{" "}
              {new Date(deadlineFrom(resolved.summary.durationHours) / 1e6).toLocaleString(
                "en-GB",
              )}
            </p>
          ) : null}

          <div className="launch__actions">
            {wallet.accountId ? (
              <PillButton disabled={!ready || submitting} onClick={() => void submit()}>
                {submitting ? "Sending…" : "Launch project"}
              </PillButton>
            ) : (
              <p className="notice">Connect a wallet in the header to launch.</p>
            )}
            <p className="launch__fine">
              The deposit pays for the token's own code storage. The project account is created
              without keys, so nobody can upgrade it later.
            </p>
          </div>

          {message ? <p className="notice">{message}</p> : null}
        </aside>
      </div>

      <div className="launch__help">
        <Mascot mood="idle" size={120} decorative />
        <div>
          <h3>Only the fields above become arguments.</h3>
          <p>
            Body text stays off-chain and is never parsed by the contract. The hash covers the
            whole file, so anyone can check that the project you read is the project that
            launched.
          </p>
          <PillLink to="/docs#schema" variant="ghost" size="sm">
            Read the schema
          </PillLink>
        </div>
      </div>
    </section>
  );
}
