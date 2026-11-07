/** Network constants for the testnet build. Nothing here is a secret. */

export const NETWORK = "testnet";
export const RPC_URL = "https://rpc.testnet.near.org";
export const FACTORY_ID = "swarmpad.testnet";
export const TOKEN_SUFFIX = ".swarmpad.testnet";

/**
 * Every launch so far used 18 decimals. The token exports `ft_balance_of` but
 * not `ft_metadata`, so the app formats amounts with this constant and the docs
 * say so.
 */
export const DISPLAY_DECIMALS = 18;
export const EXPLORER = "https://testnet.nearblocks.io";
export const INDEXER = "https://api-testnet.nearblocks.io/v3";

/** Share of the supply one level unlocks, in basis points. */
export const LEVEL_BPS = 250;
export const TOTAL_LEVELS = 40;
export const BPS = 10_000;
/** Claim fee in yoctoNEAR. */
export const CLAIM_FEE = 50_000_000_000_000_000_000_000n;

export const DOCS_LINKS = {
  explorerFactory: `${EXPLORER}/address/${FACTORY_ID}`,
  explorerToken: (account: string) => `${EXPLORER}/address/${account}`,
  x: "https://x.com/swarmpad_near",
  agent: "/docs#agent",
  nearDocs: "https://docs.near.org/",
} as const;
