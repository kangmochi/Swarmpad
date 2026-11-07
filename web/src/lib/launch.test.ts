import { describe, expect, it } from "vitest";

import { parseDuration, parseMarkdown, resolveLaunch, scale, slugProblem, SAMPLE } from "./launch";

describe("parseMarkdown", () => {
  it("reads frontmatter and body", () => {
    const draft = parseMarkdown(SAMPLE);
    expect(draft.errors).toEqual([]);
    expect(draft.frontmatter.slug).toBe("swarm");
    expect(draft.body.startsWith("# Swarm Token")).toBe(true);
  });

  it("reports a missing fence", () => {
    const draft = parseMarkdown("name: x");
    expect(draft.errors[0]).toMatch(/must start with/);
  });

  it("reports missing fields", () => {
    const draft = parseMarkdown("---\nname: x\n---\nbody");
    expect(draft.errors.some((line) => line.includes("symbol"))).toBe(true);
  });
});

describe("slugProblem", () => {
  it("accepts the documented shape", () => {
    expect(slugProblem("swarm-2")).toBeNull();
  });

  it("rejects uppercase, edges and length", () => {
    expect(slugProblem("Swarm")).not.toBeNull();
    expect(slugProblem("-swarm")).not.toBeNull();
    expect(slugProblem("a".repeat(33))).not.toBeNull();
  });
});

describe("parseDuration", () => {
  it("converts units to hours", () => {
    expect(parseDuration("30d")).toBe(720);
    expect(parseDuration("2h")).toBe(2);
    expect(parseDuration("30m")).toBe(0.5);
    expect(parseDuration("soon")).toBeNull();
  });
});

describe("resolveLaunch", () => {
  it("builds launch args scaled to yocto", () => {
    const draft = parseMarkdown(SAMPLE);
    const resolved = resolveLaunch(draft, "agent.testnet", "sha256:abc");
    expect(resolved.errors).toEqual([]);
    expect(resolved.args?.supply).toBe("1000000000000000000000000");
    expect(resolved.args?.reward_per_proof).toBe("25000000000000000000000");
    expect(resolved.args?.duration_ns).toBe(2 * 3600 * 1e9);
    expect(resolved.args?.threshold_bps).toBe(5000);
  });

  it("stops on a threshold below the minimum", () => {
    const draft = parseMarkdown(SAMPLE.replace("threshold_bps: 5000", "threshold_bps: 4000"));
    const resolved = resolveLaunch(draft, "agent.testnet", "sha256:abc");
    expect(resolved.args).toBeNull();
    expect(resolved.errors.some((line) => line.includes("threshold_bps"))).toBe(true);
  });

  it("stops when no wallet is connected", () => {
    const resolved = resolveLaunch(parseMarkdown(SAMPLE), "", "sha256:abc");
    expect(resolved.args).toBeNull();
  });
});

describe("scale", () => {
  it("keeps integer precision", () => {
    expect(scale(1_000_000, 18)).toBe(10n ** 24n);
    expect(scale(0.5, 6)).toBe(500_000n);
  });
});
