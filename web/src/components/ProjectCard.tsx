import { Link } from "react-router";

import { DISPLAY_DECIMALS } from "../lib/config";
import { countdown, formatBps, formatToken, shortAccount } from "../lib/format";
import type { ProjectView } from "../lib/types";
import { LevelLadder } from "./LevelLadder";
import { StatusChip, VersionChip } from "./StatusChip";

export function ProjectCard({ project, now }: { project: ProjectView; now: number }) {
  const { record, token, meta } = project;
  const supply = token?.supply ?? BigInt(record.supply || "0");
  const name = meta?.name ?? record.slug;
  const decimals = meta?.decimals ?? DISPLAY_DECIMALS;

  return (
    <Link to={`/projects/${record.slug}`} className="projcard">
      <div className="projcard__top">
        <span className="mono-label">project</span>
        <div className="projcard__chips">
          <VersionChip version={project.version} />
          {project.version === "none" ? null : (
            <StatusChip status={project.status} unknown={project.version === "unknown"} />
          )}
        </div>
      </div>

      <div className="projcard__title">
        <h3>{name}</h3>
        {meta ? <span className="projcard__symbol">{meta.symbol}</span> : null}
      </div>

      <dl className="projcard__stats">
        <div>
          <dt className="mono-label">mined</dt>
          <dd>{formatBps(project.minedBps)}</dd>
        </div>
        <div>
          <dt className="mono-label">level</dt>
          <dd>{project.level}/40</dd>
        </div>
        <div>
          <dt className="mono-label">supply</dt>
          <dd>{formatToken(supply, decimals)}</dd>
        </div>
        <div>
          <dt className="mono-label">deadline</dt>
          <dd>{countdown(record.deadline_ns, now)}</dd>
        </div>
      </dl>

      <LevelLadder level={project.level} compact />

      <div className="projcard__foot">
        <span className="mono-label">creator {shortAccount(record.creator_id, 8)}</span>
        <span className="projcard__open">{project.status === "Mining" ? "Mine →" : "Open console →"}</span>
      </div>
    </Link>
  );
}
