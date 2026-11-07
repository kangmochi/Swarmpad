#!/usr/bin/env node
/**
 * Swarmpad demo miner.
 *
 * Searches for a preimage below the current level target, then submits
 * `mine(preimage)` with the claim fee attached. Everything it prints comes from
 * the chain or from its own counters: hash rate, attempts, transaction hash.
 *
 *   node mine.mjs --project swarm3
 *   node mine.mjs --project swarm3 --dry-run          # search only
 *   node mine.mjs --project swarm3 --threads 4
 */

import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { cpus } from "node:os";

import { KeyPair } from "@near-js/crypto";
import { KeyPairSigner } from "@near-js/signers";
import {
  SCHEMA,
  SignedTransaction,
  actionCreators,
  createTransaction,
} from "@near-js/transactions";
import { serialize } from "borsh";
import bs58 from "bs58";

import { accessKey, broadcast, latestBlock, viewCall } from "./lib/chain.mjs";

const FACTORY = "swarmpad.testnet";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const project = String(args.project ?? "swarm3");
const threads = Number(args.threads ?? Math.max(1, Math.min(8, cpus().length - 1)));
const dryRun = Boolean(args["dry-run"]);
const accountId = args.account ? String(args.account) : null;

const tokens = (value) => Number(BigInt(value)) / 1e18;
const near = (value) => Number(BigInt(value)) / 1e24;
const short = (value) => `${(Number(value) / 1e6).toFixed(2)}M`;
const duration = (ms) => {
  const seconds = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
};

async function resolveToken() {
  if (project.includes(".")) {
    return project;
  }
  try {
    const record = await viewCall(FACTORY, "project", { slug: project });
    if (record?.token_account) {
      return record.token_account;
    }
  } catch {
    // Fall through: the naming rule is deterministic anyway.
  }
  return `${project}.${FACTORY}`;
}

async function loadKey() {
  const path =
    args.key && args.key !== true
      ? String(args.key)
      : join(homedir(), ".near-credentials", "testnet", `${accountId ?? ""}.json`);
  if (!accountId && !args.key) {
    throw new Error("Pass --account <name> or --key <path to key json>");
  }
  const raw = JSON.parse(await readFile(path, "utf8"));
  return {
    // Ledger-style credential files carry `implicit_account_id` instead.
    accountId: accountId ?? raw.account_id ?? raw.implicit_account_id,
    publicKey: raw.public_key,
    privateKey: raw.private_key,
  };
}

function search(target, onProgress) {
  const goal = BigInt(target);
  const workers = [];
  let attempts = 0;

  return new Promise((resolve, reject) => {
    const startedAt = performance.now();
    const timer = setInterval(() => {
      const rate = attempts / ((performance.now() - startedAt) / 1000);
      onProgress({ attempts, rate, threads: workers.length });
    }, 500);

    const finish = (value) => {
      clearInterval(timer);
      for (const worker of workers) worker.terminate();
      resolve(value);
    };

    for (let index = 0; index < threads; index++) {
      const worker = new Worker(new URL("./lib/miner-worker.mjs", import.meta.url), {
        workerData: { target: goal.toString(), seed: Date.now() + index * 7919 },
      });
      workers.push(worker);

      worker.on("message", (message) => {
        if (message.type === "progress") {
          attempts += message.hashed;
        } else if (message.type === "found") {
          attempts += message.hashed ?? 0;
          finish({
            preimage: Buffer.from(message.preimage).toString("base64"),
            digest: message.digest,
            attempts,
            elapsed: performance.now() - startedAt,
          });
        }
      });
      worker.on("error", reject);
    }

    process.on("SIGINT", () => {
      clearInterval(timer);
      for (const worker of workers) worker.terminate();
      console.log("\nstopped");
      process.exit(130);
    });
  });
}

async function submit(key, token, preimage, fee) {
  const signer = KeyPairSigner.fromSecretKey(key.privateKey);
  const publicKey = KeyPair.fromString(key.privateKey).getPublicKey();
  const block = await latestBlock();
  const blockHash = block?.header?.hash;
  if (!blockHash) {
    throw new Error("block response had no header.hash");
  }
  const access = await accessKey(key.accountId, key.publicKey);
  if (!access?.nonce) {
    throw new Error(`no access key for ${key.accountId} (${key.publicKey})`);
  }
  const action = actionCreators.functionCall(
    "mine",
    { preimage },
    BigInt("150000000000000"),
    BigInt(fee),
  );
  const transaction = createTransaction(
    key.accountId,
    publicKey,
    token,
    BigInt(access.nonce) + 1n,
    [action],
    bs58.decode(blockHash),
  );
  const [, signed] = await signer.signTransaction(transaction);
  const bytes = serialize(SCHEMA.SignedTransaction, new SignedTransaction(signed));
  const outcome = await broadcast(bytes);
  return outcome;
}

async function main() {
  const token = await resolveToken();
  console.log(`project  ${project}`);
  console.log(`token    ${token}`);

  const [status, level, target, mined, supply, fee, reward, deadline] = await Promise.all([
    viewCall(token, "status"),
    viewCall(token, "level"),
    viewCall(token, "target"),
    viewCall(token, "mined"),
    viewCall(token, "supply"),
    viewCall(token, "claim_fee"),
    viewCall(token, "reward_per_proof"),
    viewCall(token, "deadline_ns"),
  ]);
  const state = { status, level, target, mined, supply, fee, reward, deadline };

  if (state.status !== "Mining") {
    console.error(`project is ${state.status}; only Mining accepts proofs`);
    process.exit(1);
  }

  const bits = BigInt(state.target).toString(2).length - 1;
  const expected = 2 ** 128 / Number(BigInt(state.target));
  console.log(
    `level    ${state.level} / 40 · target 2^${bits} · ~${short(expected)} hashes per proof`,
  );
  console.log(
    `mined    ${tokens(state.mined).toLocaleString()} / ${tokens(state.supply).toLocaleString()} tokens`,
  );
  console.log(
    `deadline ${new Date(Number(state.deadline) / 1e6).toISOString()} · fee ${near(state.fee).toFixed(2)} NEAR`,
  );
  console.log(`threads  ${threads}\n`);

  let found;
  if (args["submit-preimage"] && args["submit-preimage"] !== true) {
    found = {
      preimage: String(args["submit-preimage"]),
      digest: "given",
      attempts: 0,
      elapsed: 0,
    };
    console.log(`proof    ${found.preimage} (given, not searched)\n`);
  }

  found ??= await search(state.target, ({ attempts, rate }) => {
    process.stdout.write(
      `\rsearching  ${(rate / 1e6).toFixed(2)} MH/s · ${short(attempts)} tried · eta ${duration(
        (expected - attempts) / Math.max(rate, 1) * 1000,
      )}   `,
    );
  });

  if (found.attempts > 0) {
    process.stdout.write("\r");
    console.log(`found in ${duration(found.elapsed)} after ${short(found.attempts)} hashes`);
  }
  console.log(`preimage ${found.preimage}`);
  console.log(`digest   ${found.digest}`);

  if (dryRun) {
    console.log("\n--dry-run: proof not submitted");
    return;
  }

  const key = await loadKey();
  if (key.accountId !== accountId && accountId) {
    console.warn(`key file is for ${key.accountId}`);
  }

  try {
    const outcome = await submit(key, token, found.preimage, state.fee);
    const tx = outcome.transaction_outcome?.id ?? outcome.transaction?.hash ?? "";
    const status = outcome.status;
    const ok = typeof status === "object" ? Object.keys(status)[0] : String(status);
    console.log(`tx       ${tx} (${ok})`);

    // The receipt is final, but a lagging node can still answer with the old
    // state, so poll until the token reports the new level.
    let mined = state.mined;
    let level = state.level;
    for (let attempt = 0; attempt < 15; attempt++) {
      const [nextMined, nextLevel] = await Promise.all([
        viewCall(token, "mined"),
        viewCall(token, "level"),
      ]);
      if (nextMined !== state.mined || nextLevel !== state.level) {
        mined = nextMined;
        level = nextLevel;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    console.log(
      `on chain mined ${tokens(mined).toLocaleString()} · level ${level}`,
    );
    if (tx) {
      console.log(`explorer https://testnet.nearblocks.io/txns/${tx}`);
    }
  } catch (error) {
    console.error(`\nsubmit failed: ${error.message}`);
    console.error("the proof stays valid while the level does not change");
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
