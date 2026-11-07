import { FACTORY_ID } from "../../src/lib/config";
import { parseMarkdown, resolveLaunch, type Draft } from "../../src/lib/launch";
import { belowTarget, digestPrefix, targetWords, toHex } from "../../src/lib/sha256";
import { launchDeposit, projectRecord, tokenState, type TokenState } from "./state";

export interface LaunchIntent {
  slug: string;
  token_account: string;
  config_hash: string;
  launch_args: Record<string, unknown>;
  deposit: string;
  errors: string[];
  call: CallIntent;
}

export interface CallIntent {
  receiverId: string;
  methodName: string;
  args: Record<string, unknown>;
  deposit: string;
  gas: string;
}

async function configHash(markdown: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(markdown));
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `sha256:${hex}`;
}

export async function buildLaunch(markdown: string, creator: string): Promise<LaunchIntent> {
  const draft: Draft = parseMarkdown(markdown);
  const hash = await configHash(markdown);
  const resolved = resolveLaunch(draft, creator, hash);
  const deposit = await launchDeposit();
  const slug = draft.frontmatter.slug ?? "";

  return {
    slug,
    token_account: slug ? `${slug}.${FACTORY_ID}` : "",
    config_hash: hash,
    launch_args: (resolved.args ?? {}) as Record<string, unknown>,
    deposit,
    errors: resolved.errors,
    call: {
      receiverId: FACTORY_ID,
      methodName: "launch",
      args: { args: resolved.args },
      deposit,
      gas: "300000000000000",
    },
  };
}

export interface ProofResult {
  valid: boolean;
  reason?: string;
  digest?: string;
  level?: number;
  reward?: string;
  call?: CallIntent;
}

/**
 * Checks a proof against the live target. Nothing is submitted: the caller
 * signs and sends the returned call with its own key.
 */
export async function checkProof(token: string, preimage: string): Promise<ProofResult> {
  const record = await projectRecord(token.replace(`.${FACTORY_ID}`, ""));
  if (!record) {
    return { valid: false, reason: "unknown project" };
  }

  const state: TokenState = await tokenState(record.token_account);
  if (state.status !== "Mining") {
    return { valid: false, reason: `project is ${state.status}` };
  }
  if (Date.now() * 1e6 >= state.deadline_ns) {
    return { valid: false, reason: "deadline has passed" };
  }

  let bytes: Uint8Array;
  try {
    const binary = atob(preimage);
    bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return { valid: false, reason: "preimage is not base64" };
  }
  if (bytes.length !== 16) {
    return { valid: false, reason: "preimage must be 16 bytes" };
  }

  const digest = digestPrefix(bytes, new Uint32Array(4));
  const target = targetWords(BigInt(state.target));
  if (!belowTarget(digest, target)) {
    return {
      valid: false,
      reason: `digest is not below the level ${state.level} target`,
      digest: toHex(digest),
      level: state.level,
    };
  }

  return {
    valid: true,
    digest: toHex(digest),
    level: state.level,
    reward: state.reward_per_proof,
    call: {
      receiverId: record.token_account,
      methodName: "mine",
      args: { preimage },
      deposit: state.claim_fee,
      gas: "150000000000000",
    },
  };
}
