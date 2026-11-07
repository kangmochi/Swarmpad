import { BPS, LEVEL_BPS, TOTAL_LEVELS } from "./config";

const YOCTO = 10n ** 24n;

export function toToken(raw: string | bigint, decimals = 18): number {
  const value = typeof raw === "bigint" ? raw : BigInt(raw || "0");
  return Number(value) / 10 ** decimals;
}

export function formatToken(raw: string | bigint, decimals = 18): string {
  const value = toToken(raw, decimals);
  if (!Number.isFinite(value)) {
    return "0";
  }
  if (value === 0) {
    return "0";
  }
  if (value >= 1_000_000) {
    return `${trim(value / 1_000_000, 2)}M`;
  }
  if (value >= 10_000) {
    return `${trim(value / 1_000, 1)}k`;
  }
  if (value >= 100) {
    return trim(value, 0);
  }
  if (value >= 1) {
    return trim(value, 2);
  }
  return trim(value, 4);
}

export function formatNear(raw: string | bigint): string {
  const value = Number(BigInt(raw || "0")) / 1e24;
  return `${trim(value, value < 1 ? 3 : 2)} NEAR`;
}

function trim(value: number, digits: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

export function formatInt(value: number | bigint): string {
  return Number(value).toLocaleString("en-US");
}

/** Level from mined amount, mirroring `level_for` in the contract. */
export function levelFor(mined: bigint, supply: bigint): number {
  if (supply === 0n) {
    return 1;
  }
  const bps = Number((mined * BigInt(BPS)) / supply);
  return Math.min(TOTAL_LEVELS, Math.max(1, Math.floor(bps / LEVEL_BPS) + 1));
}

export function minedBps(mined: bigint, supply: bigint): number {
  if (supply === 0n) {
    return 0;
  }
  return Number((mined * BigInt(BPS)) / supply);
}

export function formatBps(bps: number): string {
  return `${trim(bps / 100, bps % 100 === 0 ? 0 : 2)}%`;
}

export function targetHex(target: string): string {
  const value = BigInt(target || "0");
  const hex = value.toString(16).toUpperCase();
  return `0x${hex.padStart(32, "0")}`;
}

/** Target as a bit count, which is how difficulty reads at a glance. */
export function targetBits(target: string): number {
  const value = BigInt(target || "0");
  return value === 0n ? 0 : value.toString(2).length;
}

/** Expected hashes for one proof at the current level. */
export function expectedHashes(target: string): number {
  const value = BigInt(target || "0");
  if (value === 0n) {
    return 0;
  }
  return 2 ** 128 / Number(value);
}

export function formatHashes(count: number): string {
  if (count >= 1e12) return `${trim(count / 1e12, 2)}T`;
  if (count >= 1e9) return `${trim(count / 1e9, 2)}B`;
  if (count >= 1e6) return `${trim(count / 1e6, 2)}M`;
  if (count >= 1e3) return `${trim(count / 1e3, 1)}k`;
  return trim(count, 0);
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "0s";
  }
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/** Time left until an on-chain nanosecond deadline. */
export function countdown(deadlineNs: number, now = Date.now()): string {
  const deadlineMs = deadlineNs / 1e6;
  if (deadlineMs <= now) {
    return "closed";
  }
  return formatDuration(deadlineMs - now);
}

export function shortAccount(account: string, size = 6): string {
  if (account.length <= size * 2 + 1) {
    return account;
  }
  return `${account.slice(0, size)}…${account.slice(-4)}`;
}

export function hashLabel(hash: string): string {
  const value = hash.replace(/^sha256:/, "");
  return value.length > 16 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value;
}

export function yoctoToNear(yocto: bigint): number {
  return Number(yocto / 10n ** 12n) / 1e12;
}

export { YOCTO };
