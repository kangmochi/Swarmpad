import { levelFor, minedBps } from "./format";
import { RpcError } from "./rpc";
import { fetchTokenState, fetchTokenSummary } from "./token";
import type { ProjectRecord, ProjectStatus, ProjectView } from "./types";

const CACHE_MS = 20_000;
const cache = new Map<string, { at: number; value: ProjectView }>();

function fallback(record: ProjectRecord, tokenError: string): ProjectView {
  const supply = BigInt(record.supply || "0");
  return {
    record,
    token: null,
    tokenError,
    status: "Mining" satisfies ProjectStatus,
    minedBps: 0,
    level: levelFor(0n, supply),
    progress: 0,
  };
}

/**
 * A registry entry can exist without a working token (launches from before the
 * deposit fix). The console still renders those rows: it shows the record and
 * says plainly that the token cannot be read.
 */
export async function loadProject(record: ProjectRecord): Promise<ProjectView> {
  const cached = cache.get(record.slug);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return cached.value;
  }

  try {
    const token = await fetchTokenState(record.token_account);
    const value: ProjectView = {
      record,
      token,
      tokenError: null,
      status: token.status,
      minedBps: minedBps(token.mined, token.supply),
      level: token.level,
      progress: Number(token.mined) / Math.max(1, Number(token.supply)),
    };
    cache.set(record.slug, { at: Date.now(), value });
    return value;
  } catch (error) {
    if (error instanceof RpcError && error.retryable) {
      throw error;
    }
    return fallback(record, error instanceof Error ? error.message : "token read failed");
  }
}

/** List view: status, mined share and ticker only, three calls per project. */
export async function loadProjectList(record: ProjectRecord): Promise<ProjectView> {
  const supply = BigInt(record.supply || "0");
  try {
    const summary = await fetchTokenSummary(record.token_account);
    return {
      record,
      token: null,
      tokenError: null,
      status: summary.status,
      minedBps: minedBps(summary.mined, supply),
      level: levelFor(summary.mined, supply),
      progress: Number(summary.mined) / Math.max(1, Number(supply)),
    };
  } catch (error) {
    if (error instanceof RpcError && error.retryable) {
      throw error;
    }
    return fallback(record, error instanceof Error ? error.message : "token read failed");
  }
}

export async function loadProjects(records: ProjectRecord[]): Promise<ProjectView[]> {
  return Promise.all(records.map((record) => loadProjectList(record)));
}

export function statusTone(status: ProjectStatus): "live" | "valid" | "failed" {
  if (status === "Valid") return "valid";
  if (status === "Failed") return "failed";
  return "live";
}
