import { createHash, randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { belowTarget, digestPrefix, targetWords, toHex } from "./sha256";

function reference(preimage: Uint8Array): string {
  return createHash("sha256").update(Buffer.from(preimage)).digest("hex").slice(0, 32);
}

describe("digestPrefix", () => {
  it("matches node crypto for a range of preimages", () => {
    for (let i = 0; i < 64; i++) {
      const preimage = randomBytes(16);
      const out = digestPrefix(Uint8Array.from(preimage), new Uint32Array(4));
      expect(toHex(out)).toBe(reference(preimage));
    }
  });

  it("handles all-zero and all-ff preimages", () => {
    for (const fill of [0x00, 0xff, 0x80, 0x7f]) {
      const preimage = new Uint8Array(16).fill(fill);
      const out = digestPrefix(preimage, new Uint32Array(4));
      expect(toHex(out)).toBe(reference(preimage));
    }
  });

  it("produces the known digest for an empty padded block", () => {
    // sha256 of 16 zero bytes
    const out = digestPrefix(new Uint8Array(16), new Uint32Array(4));
    expect(toHex(out).slice(0, 16)).toBe("374708fff7719dd5");
  });
});

describe("belowTarget", () => {
  it("is strict and unsigned", () => {
    const target = targetWords(1n << 98n);
    expect(belowTarget(targetWords(1n << 97n), target)).toBe(true);
    expect(belowTarget(target, target)).toBe(false);
    expect(belowTarget(targetWords((1n << 98n) + 1n), target)).toBe(false);
    // A digest whose first word has the high bit set is larger, not smaller.
    const high = new Uint32Array([0xffffffff, 0, 0, 0]);
    expect(belowTarget(high, target)).toBe(false);
  });
});
