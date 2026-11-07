import type { ProjectStatus, TokenVersion } from "../lib/types";

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
        read failed
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

const VERSION_LABEL: Record<TokenVersion, string> = {
  v2: "token v2",
  v1: "token v1",
  none: "no token",
  unknown: "token unknown",
};

const VERSION_NOTE: Record<TokenVersion, string> = {
  v2: "This build exports ft_metadata.",
  v1: "This build does not export ft_metadata.",
  none: "The registry entry has no project account.",
  unknown: "The token could not be read.",
};

/** Which token build the project runs: the two builds behave differently. */
export function VersionChip({ version }: { version: TokenVersion }) {
  return (
    <span className={`chip chip--ver chip--ver-${version}`} title={VERSION_NOTE[version]}>
      {VERSION_LABEL[version]}
    </span>
  );
}
