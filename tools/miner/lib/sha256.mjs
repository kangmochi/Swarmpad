/**
 * SHA-256 of a 16-byte preimage, specialised for the mining loop.
 *
 * This mirrors `web/src/lib/sha256.ts`: one 64-byte block, four digest words,
 * no allocation inside the loop. The contract compares the leading 128 bits, so
 * four words are all the search needs.
 */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const W = new Uint32Array(64);

export function digestPrefix(preimage, out) {
  W[0] = (preimage[0] << 24) | (preimage[1] << 16) | (preimage[2] << 8) | preimage[3];
  W[1] = (preimage[4] << 24) | (preimage[5] << 16) | (preimage[6] << 8) | preimage[7];
  W[2] = (preimage[8] << 24) | (preimage[9] << 16) | (preimage[10] << 8) | preimage[11];
  W[3] = (preimage[12] << 24) | (preimage[13] << 16) | (preimage[14] << 8) | preimage[15];
  W[4] = 0x80000000;
  W[5] = 0;
  W[6] = 0;
  W[7] = 0;
  W[8] = 0;
  W[9] = 0;
  W[10] = 0;
  W[11] = 0;
  W[12] = 0;
  W[13] = 0;
  W[14] = 0;
  W[15] = 0x00000080;

  for (let i = 16; i < 64; i++) {
    const w15 = W[i - 15];
    const w2 = W[i - 2];
    const s0 = ((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3);
    const s1 = ((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10);
    W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
  }

  let a = 0x6a09e667;
  let b = 0xbb67ae85;
  let c = 0x3c6ef372;
  let d = 0xa54ff53a;
  let e = 0x510e527f;
  let f = 0x9b05688c;
  let g = 0x1f83d9ab;
  let h = 0x5be0cd19;

  for (let i = 0; i < 64; i++) {
    const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
    const ch = (e & f) ^ (~e & g);
    const t1 = (h + s1 + ch + K[i] + W[i]) | 0;
    const s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
    const maj = (a & b) ^ (a & c) ^ (b & c);
    const t2 = (s0 + maj) | 0;

    h = g;
    g = f;
    f = e;
    e = (d + t1) | 0;
    d = c;
    c = b;
    b = a;
    a = (t1 + t2) | 0;
  }

  out[0] = (0x6a09e667 + a) | 0;
  out[1] = (0xbb67ae85 + b) | 0;
  out[2] = (0x3c6ef372 + c) | 0;
  out[3] = (0xa54ff53a + d) | 0;
  return out;
}

export function targetWords(target) {
  return new Uint32Array([
    Number((target >> 96n) & 0xffffffffn),
    Number((target >> 64n) & 0xffffffffn),
    Number((target >> 32n) & 0xffffffffn),
    Number(target & 0xffffffffn),
  ]);
}

export function belowTarget(digest, target) {
  for (let i = 0; i < 4; i++) {
    const left = digest[i] >>> 0;
    const right = target[i] >>> 0;
    if (left < right) return true;
    if (left > right) return false;
  }
  return false;
}

export function toHex(digest) {
  return Array.from(digest, (word) => (word >>> 0).toString(16).padStart(8, "0")).join("");
}
