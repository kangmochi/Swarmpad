import { useState } from "react";
import { Link, useParams } from "react-router";

import { LevelLadder } from "../components/LevelLadder";
import { Mascot } from "../components/Mascot";
import { MinePanel } from "../components/MinePanel";
import { PillButton, PillExternal } from "../components/Pill";
import { StatusChip, VersionChip } from "../components/StatusChip";
import { CLAIM_FEE, DISPLAY_DECIMALS, DOCS_LINKS, FACTORY_ID } from "../lib/config";
import { fetchProject } from "../lib/factory";
import {
  countdown,
  formatBps,
  formatInt,
  formatNear,
  formatToken,
  hashLabel,
  shortAccount,
  targetBits,
  targetHex,
} from "../lib/format";
import { useAsync, useNow, useWallet } from "../lib/hooks";
import { fetchMineLog } from "../lib/indexer";
import { loadProject } from "../lib/projects";

export function ProjectDetail() {
  const { slug = "" } = useParams();
  const now = useNow(1000);
  const wallet = useWallet();
  const project = useAsync(async () => {
    const record = await fetchProject(slug);
    if (!record) {
      throw new Error(`No project named ${slug} in the registry.`);
    }
    return loadProject(record);
  }, [slug]);

  const miners = useAsync(async () => {
    if (!project.data) {
      return [];
    }
    return fetchMineLog(project.data.record.token_account);
  }, [project.data?.record.token_account]);

  const view = project.data;
  const token = view?.token ?? null;
  const [message, setMessage] = useMessage();

  async function withdraw() {
    if (!token) return;
    await run(async () => {
      const hash = await wallet.call({
        contractId: token.account,
        method: "withdraw_fees",
        args: {},
      });
      setMessage(`Fee payout sent · ${hash.slice(0, 8)}…`);
      project.reload();
    });
  }

  async function finalize() {
    if (!token) return;
    await run(async () => {
      const hash = await wallet.call({
        contractId: token.account,
        method: "finalize",
        args: {},
      });
      setMessage(`Project finalized · ${hash.slice(0, 8)}…`);
      project.reload();
    });
  }

  async function mine(preimage: string) {
    if (!token) return;
    const hash = await wallet.call({
      contractId: token.account,
      method: "mine",
      args: { preimage },
      deposit: CLAIM_FEE.toString(),
    });
    setMessage(`Proof accepted · ${hash.slice(0, 8)}…`);
    project.reload();
    miners.reload();
  }

  async function run(action: () => Promise<void>) {
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The call failed.");
    }
  }

  if (project.error) {
    return (
      <section className="page">
        <div className="empty">
          <Mascot mood="sad" size={180} decorative />
          <p>{project.error}</p>
          <Link className="pill pill--ghost pill--sm" to="/projects">
            Back to the registry
          </Link>
        </div>
      </section>
    );
  }

  if (!view) {
    return (
      <section className="page console">
        <Link to="/projects" className="console__back mono-label">
          ← registry
        </Link>
        <header className="console__head">
          <div className="console__title">
            <Mascot mood="idle" size={96} className="console__mascot" decorative />
            <div>
              <p className="mono-label">{slug}</p>
              <h1>{slug}</h1>
              <p className="notice">Reading from chain…</p>
            </div>
          </div>
        </header>
        <div className="console__skeleton" aria-hidden="true" />
      </section>
    );
  }

  const { record, meta } = view;
  const decimals = meta?.decimals ?? DISPLAY_DECIMALS;
  const expired = token !== null && record.deadline_ns / 1e6 <= now;
  const mood = view.status === "Valid" ? "happy" : view.status === "Failed" ? "sad" : "idle";

  return (
    <section className="page console">
      <Link to="/projects" className="console__back mono-label">
        ← registry
      </Link>

      <header className="console__head">
        <div className="console__title">
          <Mascot mood={mood} size={96} className="console__mascot" decorative />
          <div>
            <p className="mono-label">
              {slug} · {record.token_account}
            </p>
            <h1>{meta?.name ?? slug}</h1>
            <div className="console__meta">
              <VersionChip version={view.version} />
              {view.version === "none" ? null : (
                <StatusChip status={view.status} unknown={view.version === "unknown"} />
              )}
              <span className="mono-label">level {view.level} / 40</span>
              <span className="mono-label">{formatBps(view.minedBps)} mined</span>
              <span className="mono-label">
                {record.deadline_ns / 1e6 <= now
                  ? "deadline passed"
                  : `${countdown(record.deadline_ns, now)} left`}
              </span>
            </div>
          </div>
        </div>

        <div className="console__actions">
          <PillExternal href={DOCS_LINKS.explorerToken(record.token_account)} size="sm">
            Explorer
          </PillExternal>
          <PillButton
            size="sm"
            variant="ghost"
            disabled={!wallet.accountId || !token}
            onClick={() => void withdraw()}
          >
            Withdraw fees
          </PillButton>
          <PillButton
            size="sm"
            variant="ghost"
            disabled={!wallet.accountId || !token || view.status !== "Mining" || !expired}
            onClick={() => void finalize()}
          >
            Finalize
          </PillButton>
        </div>
      </header>

      {message ? <p className="notice">{message}</p> : null}

      {view.version === "v1" ? (
        <p className="notice">
          <strong>Token v1.</strong> This build never exported <code>ft_metadata</code>, so the
          name and ticker come from the registry slug. Project accounts are created without
          keys, so the code cannot be upgraded in place; every launch after the v2 upload gets
          metadata instead.
        </p>
      ) : null}

      {view.version === "none" ? (
        <p className="notice notice--error">
          <strong>No project account.</strong> The launch was recorded but the account behind
          it does not exist: these entries predate the deposit fix, which forwarded the deploy
          deposit before the callback recorded the project. The registry is append-only, so the
          entry stays.
        </p>
      ) : null}

      {view.version === "unknown" ? (
        <p className="notice notice--error">
          The token could not be read: {view.tokenError}.
        </p>
      ) : null}

      <LevelLadder level={view.level} />

      {token ? (
        <>
          <dl className="statgrid">
            <div>
              <dt className="mono-label">supply</dt>
              <dd>{formatToken(token.supply, decimals)}</dd>
            </div>
            <div>
              <dt className="mono-label">mined</dt>
              <dd>{formatToken(token.mined, decimals)}</dd>
            </div>
            <div>
              <dt className="mono-label">remaining</dt>
              <dd>{formatToken(token.remaining, decimals)}</dd>
            </div>
            <div>
              <dt className="mono-label">burned</dt>
              <dd>{formatToken(token.burned, decimals)}</dd>
            </div>
            <div>
              <dt className="mono-label">reward / proof</dt>
              <dd>{formatToken(token.rewardPerProof, decimals)}</dd>
            </div>
            <div>
              <dt className="mono-label">epoch cap</dt>
              <dd>{formatToken(token.epochCap, decimals)}</dd>
            </div>
            <div>
              <dt className="mono-label">threshold</dt>
              <dd>{formatBps(token.thresholdBps)}</dd>
            </div>
            <div>
              <dt className="mono-label">target</dt>
              <dd className="mono-value">{targetHex(token.target)}</dd>
            </div>
            <div>
              <dt className="mono-label">search space</dt>
              <dd>{targetBits(token.target)} bits</dd>
            </div>
            <div>
              <dt className="mono-label">claim fee</dt>
              <dd>{formatNear(token.claimFee)}</dd>
            </div>
          </dl>

          <div className="console__cols">
            <MinePanel
              token={token}
              accountId={wallet.accountId}
              onMine={mine}
              disabled={expired || view.status !== "Mining"}
            />

            <div className="feeside">
              <p className="mono-label">Accrued fees</p>
              <dl className="feeside__list">
                <div>
                  <dt>pool · {token.poolAccount}</dt>
                  <dd>{formatNear(token.accrued.pool)}</dd>
                </div>
                <div>
                  <dt>creator · {record.payout_account}</dt>
                  <dd>{formatNear(token.accrued.creator)}</dd>
                </div>
                <div>
                  <dt>protocol · {FACTORY_ID}</dt>
                  <dd>{formatNear(token.accrued.protocol)}</dd>
                </div>
              </dl>
              <p className="feeside__note">
                Anyone can call <code>withdraw_fees</code>. Shares go to fixed accounts; a
                caller can trigger the payout but never redirect it.
              </p>
            </div>
          </div>

          <div className="miners">
            <div className="miners__head">
              <div>
                <p className="mono-label">Recent claims</p>
                <h2>Who called mine()</h2>
              </div>
              <button type="button" className="linkish" onClick={miners.reload}>
                refresh
              </button>
            </div>

            {miners.loading ? <p className="notice">Reading the indexer…</p> : null}
            {miners.error ? (
              <p className="notice">
                The testnet indexer is not reachable right now. The chain state above is still
                current.
              </p>
            ) : null}

            {miners.data && miners.data.length > 0 ? (
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">miner</th>
                    <th scope="col">paid</th>
                    <th scope="col">when</th>
                    <th scope="col">tx</th>
                    <th scope="col">result</th>
                  </tr>
                </thead>
                <tbody>
                  {miners.data.map((row) => (
                    <tr key={row.hash}>
                      <td className="mono-value">{shortAccount(row.signer, 10)}</td>
                      <td>{formatNear(row.amount)}</td>
                      <td>{new Date(row.timestamp).toLocaleString("en-GB")}</td>
                      <td>
                        <a
                          href={`${DOCS_LINKS.explorerToken(token.account)}?tab=txns`}
                          target="_blank"
                          rel="noreferrer"
                          className="mono-value"
                        >
                          {row.hash.slice(0, 10)}…
                        </a>
                      </td>
                      <td>{row.outcome}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}

            {miners.data && miners.data.length === 0 && !miners.error ? (
              <p className="notice">
                No accepted <code>mine</code> call on this token yet. The first proof writes the
                first row.
              </p>
            ) : null}
          </div>
        </>
      ) : null}

      <dl className="record">
        <div>
          <dt className="mono-label">creator</dt>
          <dd className="mono-value">{record.creator_id}</dd>
        </div>
        <div>
          <dt className="mono-label">payout</dt>
          <dd className="mono-value">{record.payout_account}</dd>
        </div>
        <div>
          <dt className="mono-label">config hash</dt>
          <dd className="mono-value">{hashLabel(record.config_hash)}</dd>
        </div>
        <div>
          <dt className="mono-label">registered supply</dt>
          <dd>{formatInt(BigInt(record.supply || "0") / 10n ** 18n)}</dd>
        </div>
        <div>
          <dt className="mono-label">deadline</dt>
          <dd>{new Date(record.deadline_ns / 1e6).toLocaleString("en-GB")}</dd>
        </div>
        <div>
          <dt className="mono-label">factory</dt>
          <dd className="mono-value">{FACTORY_ID}</dd>
        </div>
      </dl>
    </section>
  );
}

function useMessage() {
  const [message, setMessage] = useState<string | null>(null);
  return [message, setMessage] as const;
}
