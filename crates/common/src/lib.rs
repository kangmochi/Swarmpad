//! Shared constants, difficulty curve and project types for Swarmpad.
//!
//! The curve is the heart of the mechanic: every 2.5% of the supply that has
//! been mined raises the puzzle level by one, and every level makes the proof
//! 10% harder. 40 levels cover 100% of the supply.

use near_sdk::json_types::U128;
use near_sdk::{near, AccountId};

/// A project needs 40 levels of 2.5% to reach 100% of the supply.
pub const TOTAL_LEVELS: u32 = 40;

/// Basis points of supply unlocked per level: 2.5% = 250 bps.
pub const LEVEL_BPS: u32 = 250;

/// Supply unit in basis points.
pub const BPS_DENOMINATOR: u32 = 10_000;

/// A launch is only valid when at least 50% of the supply was mined.
pub const MIN_THRESHOLD_BPS: u32 = 5_000;

/// The first level accepts hashes whose leading 128 bits are below 2^(128-30).
pub const BASE_BITS: u32 = 30;

/// Difficulty multiplier per level is 10/11 of the previous target (x1.10 work).
pub const TARGET_NUM: u128 = 10;
pub const TARGET_DEN: u128 = 11;

/// Only the first 128 bits of the 256 bit SHA-256 digest are compared, which
/// keeps the check inside u128 and still leaves a 30 bit search space at level 1.
pub const DIGEST_BYTES: usize = 16;

/// Claim fee in yoctoNEAR: 0.05 NEAR.
pub const CLAIM_FEE_YOCTO: u128 = 50_000_000_000_000_000_000_000;

/// Fee split, in basis points of the claim fee.
pub const POOL_BPS: u32 = 5_000;
pub const CREATOR_BPS: u32 = 3_000;
pub const PROTOCOL_BPS: u32 = 2_000;

/// Target of the first level.
pub const fn base_target() -> u128 {
    1u128 << (128 - BASE_BITS)
}

/// Level for a given amount of mined supply. Level 1 covers 0%..2.5%,
/// level 40 covers 97.5%..100%.
pub fn level_for(mined: u128, supply: u128) -> u32 {
    if supply == 0 {
        return 1;
    }
    let bps = (mined.saturating_mul(BPS_DENOMINATOR as u128) / supply) as u32;
    let level = (bps / LEVEL_BPS) + 1;
    level.clamp(1, TOTAL_LEVELS)
}

/// Accepted target for a level. Targets shrink by 10/11 per level, which makes
/// the expected work grow by 1.10 per level.
pub fn target_for(level: u32) -> u128 {
    let mut target = base_target();
    let mut step = 1;
    while step < level.clamp(1, TOTAL_LEVELS) {
        target = target * TARGET_NUM / TARGET_DEN;
        step += 1;
    }
    target
}

/// Compares the leading 16 bytes of a SHA-256 digest with `target`.
pub fn digest_below_target(digest: &[u8], target: u128) -> bool {
    if digest.len() < DIGEST_BYTES {
        return false;
    }
    let mut prefix = [0u8; DIGEST_BYTES];
    prefix.copy_from_slice(&digest[..DIGEST_BYTES]);
    u128::from_be_bytes(prefix) < target
}

/// Status of a project. `Mining` accepts proofs; the other two are final.
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ProjectStatus {
    Mining,
    Valid,
    Failed,
}

/// Public view of a project, held by the factory.
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct Project {
    pub slug: String,
    pub token_account: AccountId,
    pub creator_id: AccountId,
    pub payout_account: AccountId,
    pub supply: U128,
    pub threshold_bps: u32,
    pub deadline_ns: u64,
    pub config_hash: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn level_starts_at_one() {
        assert_eq!(level_for(0, 1_000), 1);
    }

    #[test]
    fn level_advances_every_2_5_percent() {
        let supply = 1_000_000u128;
        assert_eq!(level_for(24_999, supply), 1);
        assert_eq!(level_for(25_000, supply), 2);
        assert_eq!(level_for(499_999, supply), 20);
        assert_eq!(level_for(500_000, supply), 21);
        assert_eq!(level_for(974_999, supply), 39);
        assert_eq!(level_for(975_000, supply), 40);
        assert_eq!(level_for(1_000_000, supply), 40);
    }

    #[test]
    fn level_is_capped_at_40() {
        assert_eq!(level_for(5_000_000, 1_000_000), TOTAL_LEVELS);
    }

    #[test]
    fn target_shrinks_ten_percent_per_level() {
        let l1 = target_for(1);
        let l2 = target_for(2);
        assert_eq!(l1, base_target());
        assert_eq!(l2, l1 * TARGET_NUM / TARGET_DEN);
        assert!(target_for(3) < l2);
    }

    #[test]
    fn targets_match_the_agreed_curve() {
        // Difficulty (base target / target) at 50% and 100% supply.
        let l20 = base_target() as f64 / target_for(20) as f64;
        let l40 = base_target() as f64 / target_for(40) as f64;
        assert!((l20 - 6.12).abs() < 0.05, "level 20 was {l20}");
        assert!((l40 - 41.14).abs() < 0.2, "level 40 was {l40}");
    }

    #[test]
    fn digest_comparison_uses_leading_bits() {
        let target = target_for(1);
        let mut low = [0u8; 32];
        low[15] = 1;
        assert!(digest_below_target(&low, target));

        let mut high = [0xffu8; 32];
        high[0] = 0xff;
        assert!(!digest_below_target(&high, target));
    }
}
