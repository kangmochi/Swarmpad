import { FACTORY_ID } from "./config";
import type { LaunchArgs } from "./types";

export interface Draft {
  frontmatter: Record<string, string>;
  body: string;
  /** Fields that are missing or out of range, one message each. */
  errors: string[];
}

const REQUIRED = ["name", "symbol", "slug", "supply", "reward_per_proof"] as const;

/** Splits `---` frontmatter from the markdown body. No YAML dependency. */
export function parseMarkdown(text: string): Draft {
  const normalized = text.replace(/\r\n/g, "\n").trimStart();
  const errors: string[] = [];

  if (!normalized.startsWith("---\n")) {
    return {
      frontmatter: {},
      body: normalized,
      errors: ["The file must start with a --- frontmatter block."],
    };
  }

  const end = normalized.indexOf("\n---", 4);
  if (end === -1) {
    return {
      frontmatter: {},
      body: normalized,
      errors: ["The frontmatter block is not closed with ---."],
    };
  }

  const block = normalized.slice(4, end);
  const body = normalized.slice(end + 4).replace(/^\n+/, "");
  const frontmatter: Record<string, string> = {};

  for (const raw of block.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const colon = line.indexOf(":");
    if (colon === -1) {
      errors.push(`Line "${line}" is not a key: value pair.`);
      continue;
    }
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim().replace(/^["']|["']$/g, "");
    frontmatter[key] = value;
  }

  for (const key of REQUIRED) {
    if (!frontmatter[key]) {
      errors.push(`Missing required field: ${key}.`);
    }
  }

  return { frontmatter, body, errors };
}

export function slugProblem(slug: string): string | null {
  if (!/^[a-z0-9-]{1,32}$/.test(slug)) {
    return "Slug must be 1-32 characters: a-z, 0-9 and hyphen only.";
  }
  if (slug.startsWith("-") || slug.endsWith("-")) {
    return "Slug cannot start or end with a hyphen.";
  }
  if (`${slug}.${FACTORY_ID}`.length > 64) {
    return "Slug is too long for an account id on this factory.";
  }
  return null;
}

function integer(field: string, value: string | undefined, errors: string[]): number {
  if (value === undefined || value.trim() === "") {
    errors.push(`${field} is required.`);
    return 0;
  }
  const parsed = Number(value.replace(/_/g, ""));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    errors.push(`${field} must be a positive number.`);
    return 0;
  }
  return parsed;
}

/** Scales a human amount to the smallest unit, without floating point drift. */
export function scale(value: number, decimals: number): bigint {
  const [whole, fraction = ""] = String(value).split(".");
  const digits = fraction.slice(0, decimals).padEnd(decimals, "0");
  return BigInt(`${whole}${digits}` || "0");
}

export interface Resolved {
  args: LaunchArgs | null;
  errors: string[];
  /** Human values for the review table. */
  summary: {
    slug: string;
    name: string;
    symbol: string;
    supply: number;
    reward: number;
    cap: number;
    thresholdBps: number;
    durationHours: number;
    decimals: number;
  };
}

export function resolveLaunch(
  draft: Draft,
  creatorId: string,
  configHash: string,
): Resolved {
  const errors = [...draft.errors];
  const fields = draft.frontmatter;

  if (!creatorId) {
    errors.push("Connect a wallet to fill the creator and payout account.");
  }

  const slug = (fields.slug ?? "").trim();
  const slugIssue = slugProblem(slug);
  if (slugIssue) {
    errors.push(slugIssue);
  }

  const decimals = fields.decimals ? Number(fields.decimals) : 18;
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 24) {
    errors.push("decimals must be a whole number between 0 and 24.");
  }

  const supply = integer("supply", fields.supply, errors);
  const reward = integer("reward_per_proof", fields.reward_per_proof, errors);
  const cap = fields.epoch_cap
    ? integer("epoch_cap", fields.epoch_cap, errors)
    : reward;
  const thresholdBps = fields.threshold_bps ? Number(fields.threshold_bps) : 5000;

  if (thresholdBps < 5000 || thresholdBps > 10_000) {
    errors.push("threshold_bps must be between 5000 and 10000.");
  }
  if (supply > 0 && reward > supply) {
    errors.push("reward_per_proof cannot exceed the supply.");
  }
  if (cap > 0 && reward > 0 && cap < reward) {
    errors.push("epoch_cap cannot be smaller than reward_per_proof.");
  }

  const durationHours = parseDuration(fields.duration ?? "720h");
  if (durationHours === null || durationHours <= 0) {
    errors.push('duration must look like "30d", "2h" or "30m".');
  }

  const summary = {
    slug,
    name: fields.name ?? "",
    symbol: (fields.symbol ?? "").toUpperCase(),
    supply,
    reward,
    cap,
    thresholdBps,
    durationHours: durationHours ?? 0,
    decimals,
  };

  if (errors.length > 0) {
    return { args: null, errors, summary };
  }

  const supplyRaw = scale(supply, decimals);
  const args: LaunchArgs = {
    slug,
    creator_id: creatorId,
    payout_account: fields.payout ?? creatorId,
    name: fields.name ?? "",
    symbol: summary.symbol,
    decimals,
    supply: supplyRaw.toString(),
    reward_per_proof: scale(reward, decimals).toString(),
    epoch_cap: scale(cap, decimals).toString(),
    threshold_bps: thresholdBps,
    duration_ns: Math.round((durationHours ?? 0) * 3600 * 1e9),
    config_hash: configHash,
  };

  return { args, errors, summary };
}

/** "30d" / "12h" / "45m" / "720h" -> hours. */
export function parseDuration(value: string): number | null {
  const match = /^(\d+(?:\.\d+)?)\s*(m|h|d)$/i.exec(value.trim());
  if (!match) {
    return null;
  }
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === "m") return amount / 60;
  if (unit === "h") return amount;
  return amount * 24;
}

export function deadlineFrom(durationHours: number, now = Date.now()): number {
  return Math.round((now + durationHours * 3600 * 1000) * 1e6);
}

/** sha256 of the raw file, written as the contract expects: `sha256:<hex>`. */
export async function hashFile(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
  return `sha256:${hex}`;
}

export const SAMPLE = `---
name: Swarm Token
symbol: SWRM
slug: swarm
decimals: 18
supply: 1000000
reward_per_proof: 25000
epoch_cap: 25000
threshold_bps: 5000
duration: 2h
---

# Swarm Token

A demo project for the Swarmpad testnet. Agents mine proofs; the ladder moves
one level per accepted proof until the deadline closes the launch.
`;
