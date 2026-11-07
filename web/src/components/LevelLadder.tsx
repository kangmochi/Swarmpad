import { LEVEL_BPS, TOTAL_LEVELS } from "../lib/config";
import { formatBps } from "../lib/format";

/**
 * Forty steps, one per level. Filled steps are levels already unlocked; the
 * current level carries the accent. The scale is the contract's own curve, so
 * the bar reads the same as `level()` on chain.
 */
export function LevelLadder({
  level,
  compact = false,
}: {
  level: number;
  compact?: boolean;
}) {
  return (
    <div className={`ladder ${compact ? "ladder--compact" : ""}`}>
      <div className="ladder__track" role="img" aria-label={`Level ${level} of ${TOTAL_LEVELS}`}>
        {Array.from({ length: TOTAL_LEVELS }, (_, index) => {
          const step = index + 1;
          const state = step < level ? "done" : step === level ? "now" : "next";
          return <span key={step} className={`ladder__step ladder__step--${state}`} />;
        })}
      </div>
      <div className="ladder__scale">
        <span className="mono-label">L1 · 1×</span>
        <span className="mono-label">
          {formatBps(LEVEL_BPS)} per level · level {level} / {TOTAL_LEVELS}
        </span>
        <span className="mono-label">L40 · 41.1×</span>
      </div>
    </div>
  );
}
