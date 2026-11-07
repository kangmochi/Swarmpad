import { useState } from "react";

import { CLAIM_FEE, DISPLAY_DECIMALS, TOTAL_LEVELS } from "../lib/config";
import {
  expectedHashes,
  formatBps,
  formatHashes,
  formatToken,
  targetBits,
  targetHex,
} from "../lib/format";
import type { ProjectView } from "../lib/types";
import { LevelLadder } from "./LevelLadder";
import { StatusChip } from "./StatusChip";

const TABS = ["Registry", "Ladder", "Fees"] as const;
type Tab = (typeof TABS)[number];

const SPLIT = [
  { label: "pool", bps: 5000, note: "liquidity, held until a pool exists" },
  { label: "creator", bps: 3000, note: "payout account set at launch" },
  { label: "protocol", bps: 2000, note: "factory account" },
];

export function LivePanel({
  projects,
  loading,
}: {
  projects: ProjectView[];
  loading: boolean;
}) {
  const [tab, setTab] = useState<Tab>("Registry");
  const lead = [...projects].sort((a, b) => b.minedBps - a.minedBps)[0] ?? null;

  return (
    <div className="panel">
      <div className="panel__head">
        <div>
          <p className="mono-label">Live from testnet</p>
          <h2>One console, read straight from chain.</h2>
        </div>
        <div className="segmented" role="tablist" aria-label="Console view">
          {TABS.map((entry) => (
            <button
              key={entry}
              type="button"
              role="tab"
              aria-selected={tab === entry}
              className={tab === entry ? "is-active" : undefined}
              onClick={() => setTab(entry)}
            >
              {entry}
            </button>
          ))}
        </div>
      </div>

      <div className="panel__body">
        {loading ? <p className="panel__empty">Reading the factory…</p> : null}

        {!loading && tab === "Registry" ? (
          <div className="reg">
            <div className="reg__head mono-label">
              <span>project</span>
              <span>mined</span>
              <span>level</span>
              <span>status</span>
            </div>
            {projects.slice(0, 6).map((project) => (
              <div className="reg__row" key={project.record.slug}>
                <span className="reg__slug">{project.record.slug}</span>
                <span className="reg__mined">
                  <span className="reg__track">
                    <span style={{ width: `${Math.min(100, project.minedBps / 100)}%` }} />
                  </span>
                  <em>{formatBps(project.minedBps)}</em>
                </span>
                <span className="reg__level">
                  {project.level}/{TOTAL_LEVELS}
                </span>
                <StatusChip status={project.status} unknown={project.tokenError !== null} />
              </div>
            ))}
            {projects.length === 0 ? (
              <p className="panel__empty">The registry is empty.</p>
            ) : null}
          </div>
        ) : null}

        {!loading && tab === "Ladder" && lead ? (
          <div className="ladder-panel">
            <div className="ladder-panel__top">
              <div>
                <p className="mono-label">{lead.record.slug} · current level</p>
                <p className="ladder-panel__num">{lead.level}</p>
              </div>
              <div className="ladder-panel__facts">
                <p>
                  <span className="mono-label">target</span>
                  {lead.token ? targetHex(lead.token.target) : "—"}
                </p>
                <p>
                  <span className="mono-label">search space</span>
                  {lead.token ? `${targetBits(lead.token.target)} bits` : "—"}
                </p>
                <p>
                  <span className="mono-label">expected work</span>
                  {lead.token ? `${formatHashes(expectedHashes(lead.token.target))} hashes` : "—"}
                </p>
                <p>
                  <span className="mono-label">reward</span>
                  {lead.token
                    ? formatToken(lead.token.rewardPerProof, lead.token.meta?.decimals ?? DISPLAY_DECIMALS)
                    : "—"}
                </p>
              </div>
            </div>
            <LevelLadder level={lead.level} />
          </div>
        ) : null}

        {!loading && tab === "Ladder" && !lead ? (
          <p className="panel__empty">No project to read a ladder from yet.</p>
        ) : null}

        {!loading && tab === "Fees" ? (
          <div className="fees">
            <p className="fees__lead">
              Every claim is {(Number(CLAIM_FEE) / 1e24).toFixed(2)} NEAR, split three ways by
              the token contract.
            </p>
            {SPLIT.map((row) => (
              <div className="fees__row" key={row.label}>
                <span className="mono-label">{row.label}</span>
                <span className="fees__track">
                  <span style={{ width: `${row.bps / 100}%` }} />
                </span>
                <span className="fees__pct">{row.bps / 100}%</span>
                <span className="fees__note">{row.note}</span>
              </div>
            ))}
            <p className="panel__foot">
              Accrued shares are paid by <code>withdraw_fees</code>, which anyone can call.
              State is cleared before the transfers are scheduled, so a caller can trigger a
              payout but never redirect it.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
