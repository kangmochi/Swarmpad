import type { ProjectStatus } from "../lib/types";

const LABEL: Record<ProjectStatus, string> = {
  Mining: "Mining",
  Valid: "Valid",
  Failed: "Failed",
};

const TONE: Record<ProjectStatus, string> = {
  Mining: "live",
  Valid: "valid",
  Failed: "failed",
};

export function StatusChip({
  status,
  unknown = false,
}: {
  status: ProjectStatus;
  unknown?: boolean;
}) {
  if (unknown) {
    return (
      <span className="chip chip--unknown">
        <span className="chip__dot" aria-hidden="true" />
        unreadable
      </span>
    );
  }
  return (
    <span className={`chip chip--${TONE[status]}`}>
      <span className="chip__dot" aria-hidden="true" />
      {LABEL[status]}
    </span>
  );
}
