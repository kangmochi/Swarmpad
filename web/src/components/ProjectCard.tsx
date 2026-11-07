import { Link } from "react-router";

import { DISPLAY_DECIMALS } from "../lib/config";
import { countdown, formatBps, formatToken, shortAccount } from "../lib/format";
import type { ProjectView } from "../lib/types";
import { LevelLadder } from "./LevelLadder";
import { StatusChip } from "./StatusChip";

export function ProjectCard({ project, now }: { project: ProjectView; now: number }) {
  const { record, token } = project;
  const supply = token?.supply ?? BigInt(record.supply || "0");

  return (
    <Link to={`/projects/${record.slug}`} className="projcard">
      <div className="projcard__top">
        <span className="mono-label">project</span>
        <StatusChip status={project.status} unknown={project.tokenError !== null} />
      </div>

      <div className="projcard__title">
        <h3>{record.slug}</h3>
      </div>

      <div className="projcard__meter" aria-hidden="true">
        <span
          style={{
            width: `${Math.max(project.minedBps / 100, project.minedBps > 0 ? 1 : 0)}%`,
          }}
        />
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
          <dd>{formatToken(supply, DISPLAY_DECIMALS)}</dd>
        </div>
        <div>
          <dt className="mono-label">deadline</dt>
          <dd>{countdown(record.deadline_ns, now)}</dd>
        </div>
      </dl>

      <LevelLadder level={project.level} compact />

      <div className="projcard__foot">
        <span className="mono-label">creator {shortAccount(record.creator_id, 8)}</span>
        <span className="projcard__open">Open console →</span>
      </div>
    </Link>
  );
}
