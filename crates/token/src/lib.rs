//! Swarmpad token contract.
//!
//! A fixed-supply NEP-141 token whose allocation is handed out by mining. The
//! token starts with zero circulating supply: every mint is a proof of work,
//! and the minted amount is capped by the project supply. When the deadline
//! passes, `finalize` decides VALID / FAILED and stops emission for good. The
//! unmined remainder is never minted, which is what "burn the rest" means
//! here: it is recorded as burned and can never enter circulation.

use near_contract_standards::fungible_token::core::FungibleTokenCore;
use near_contract_standards::fungible_token::metadata::{
    FungibleTokenMetadata, FungibleTokenMetadataProvider, FT_METADATA_SPEC,
};
use near_contract_standards::fungible_token::resolver::FungibleTokenResolver;
use near_contract_standards::fungible_token::FungibleToken;
use near_contract_standards::storage_management::{
    StorageBalance, StorageBalanceBounds, StorageManagement,
};
use near_sdk::collections::LookupMap;
use near_sdk::json_types::{Base64VecU8, U128};
use near_sdk::{
    env, log, near, require, AccountId, BorshStorageKey, NearToken, PanicOnDefault, Promise,
    PromiseOrValue,
};
use swarmpad_common::{
    digest_below_target, level_for, target_for, ProjectStatus, BPS_DENOMINATOR, CLAIM_FEE_YOCTO,
    CREATOR_BPS, MIN_THRESHOLD_BPS, POOL_BPS, PROTOCOL_BPS,
};

#[derive(BorshStorageKey, near_sdk::borsh::BorshSerialize)]
#[borsh(crate = "near_sdk::borsh")]
enum StorageKey {
    FungibleToken,
    EpochClaims,
}

/// Spec section 4.
#[derive(PanicOnDefault)]
#[near(contract_state)]
pub struct Token {
    ft: FungibleToken,
    metadata: FungibleTokenMetadata,
    creator_id: AccountId,
    payout_account: AccountId,
    /// Module address that receives the protocol share of the claim fee.
    protocol_account: AccountId,
    /// Address that receives the pool share. Until the liquidity pool exists
    /// this is the protocol account, so the share cannot be stranded.
    pool_account: AccountId,
    /// Hard cap of the token, fixed at launch.
    supply: u128,
    /// Tokens handed out by mining. Always equals `ft.total_supply`.
    mined: u128,
    /// Remainder recorded at finalize. Never minted.
    burned: u128,
    /// Tokens released per accepted proof.
    reward_per_proof: u128,
    /// Maximum tokens one account can mine per level.
    epoch_cap: u128,
    /// Minimum share of supply that must be mined for a VALID launch.
    threshold_bps: u32,
    deadline_ns: u64,
    status: ProjectStatus,
    claim_fee: u128,
    pool_accrued: u128,
    creator_accrued: u128,
    protocol_accrued: u128,
    epoch_claims: LookupMap<(u32, AccountId), u128>,
}

#[near]
impl Token {
    /// Creates the token. Called once by the factory right after deployment.
    /// The long argument list is the launch ABI, not an internal helper.
    #[allow(clippy::too_many_arguments)]
    #[init]
    pub fn new(
        creator_id: AccountId,
        payout_account: AccountId,
        protocol_account: AccountId,
        pool_account: AccountId,
        name: String,
        symbol: String,
        decimals: u8,
        supply: U128,
        reward_per_proof: U128,
        epoch_cap: U128,
        threshold_bps: u32,
        deadline_ns: u64,
    ) -> Self {
        require!(supply.0 > 0, "Supply must be positive");
        require!(reward_per_proof.0 > 0, "Reward must be positive");
        require!(
            epoch_cap.0 >= reward_per_proof.0,
            "Epoch cap must cover at least one proof"
        );
        require!(
            (MIN_THRESHOLD_BPS..=BPS_DENOMINATOR).contains(&threshold_bps),
            "Threshold must be between 50% and 100%"
        );
        require!(
            deadline_ns > env::block_timestamp(),
            "Deadline must be in the future"
        );
        Self {
            ft: FungibleToken::new(StorageKey::FungibleToken),
            metadata: FungibleTokenMetadata {
                spec: FT_METADATA_SPEC.to_string(),
                name,
                symbol,
                icon: None,
                reference: None,
                reference_hash: None,
                decimals,
            },
            creator_id,
            payout_account,
            protocol_account,
            pool_account,
            supply: supply.0,
            mined: 0,
            burned: 0,
            reward_per_proof: reward_per_proof.0,
            epoch_cap: epoch_cap.0,
            threshold_bps,
            deadline_ns,
            status: ProjectStatus::Mining,
            claim_fee: CLAIM_FEE_YOCTO,
            pool_accrued: 0,
            creator_accrued: 0,
            protocol_accrued: 0,
            epoch_claims: LookupMap::new(StorageKey::EpochClaims),
        }
    }

    /// Submits a proof. The digest of `preimage` must be below the target of
    /// the current level, and the caller must attach the claim fee.
    #[payable]
    pub fn mine(&mut self, preimage: Base64VecU8) -> U128 {
        let digest = env::sha256(&preimage.0);
        let reward = self.try_mine(
            &digest,
            env::predecessor_account_id(),
            env::attached_deposit().as_yoctonear(),
            env::block_timestamp(),
        );
        U128(reward)
    }

    /// Closes the project after the deadline. Anyone can call it: the result
    /// depends only on how much supply was mined, never on the caller.
    pub fn finalize(&mut self) -> ProjectStatus {
        let now = env::block_timestamp();
        require!(self.status == ProjectStatus::Mining, "Project is finalized");
        require!(now >= self.deadline_ns, "Deadline has not passed");
        let mined_bps = self.mined.saturating_mul(BPS_DENOMINATOR as u128) / self.supply;
        self.status = if mined_bps >= self.threshold_bps as u128 {
            ProjectStatus::Valid
        } else {
            ProjectStatus::Failed
        };
        self.burned = self.supply.saturating_sub(self.mined);
        self.status.clone()
    }

    /// Pays out the claim fee shares. Permissionless on purpose: every payout
    /// goes to a fixed recipient, so a caller can only trigger it, never
    /// redirect it. State is cleared before the transfers are scheduled.
    pub fn withdraw_fees(&mut self) -> (U128, U128, U128) {
        let pool = self.pool_accrued;
        let creator = self.creator_accrued;
        let protocol = self.protocol_accrued;
        require!(
            pool > 0 || creator > 0 || protocol > 0,
            "Nothing to withdraw"
        );
        self.pool_accrued = 0;
        self.creator_accrued = 0;
        self.protocol_accrued = 0;
        if pool > 0 {
            Promise::new(self.pool_account.clone())
                .transfer(NearToken::from_yoctonear(pool))
                .detach();
        }
        if creator > 0 {
            Promise::new(self.payout_account.clone())
                .transfer(NearToken::from_yoctonear(creator))
                .detach();
        }
        if protocol > 0 {
            Promise::new(self.protocol_account.clone())
                .transfer(NearToken::from_yoctonear(protocol))
                .detach();
        }
        (U128(pool), U128(creator), U128(protocol))
    }

    // Views

    pub fn status(&self) -> ProjectStatus {
        self.status.clone()
    }

    pub fn creator_id(&self) -> AccountId {
        self.creator_id.clone()
    }

    pub fn payout_account(&self) -> AccountId {
        self.payout_account.clone()
    }

    pub fn supply(&self) -> U128 {
        U128(self.supply)
    }

    pub fn mined(&self) -> U128 {
        U128(self.mined)
    }

    pub fn burned(&self) -> U128 {
        U128(self.burned)
    }

    pub fn remaining(&self) -> U128 {
        U128(self.supply.saturating_sub(self.mined))
    }

    pub fn level(&self) -> u32 {
        level_for(self.mined, self.supply)
    }

    pub fn target(&self) -> u128 {
        target_for(self.level())
    }

    pub fn reward_per_proof(&self) -> U128 {
        U128(self.reward_per_proof)
    }

    pub fn epoch_cap(&self) -> U128 {
        U128(self.epoch_cap)
    }

    pub fn threshold_bps(&self) -> u32 {
        self.threshold_bps
    }

    pub fn deadline_ns(&self) -> u64 {
        self.deadline_ns
    }

    pub fn claim_fee(&self) -> U128 {
        U128(self.claim_fee)
    }

    pub fn pool_account(&self) -> AccountId {
        self.pool_account.clone()
    }

    /// Share of the supply mined so far, in basis points. The dashboard uses
    /// this instead of deriving it from two numbers.
    pub fn mined_bps(&self) -> u32 {
        if self.supply == 0 {
            return 0;
        }
        (self.mined.saturating_mul(BPS_DENOMINATOR as u128) / self.supply) as u32
    }

    pub fn accrued_fees(&self) -> (U128, U128, U128) {
        (
            U128(self.pool_accrued),
            U128(self.creator_accrued),
            U128(self.protocol_accrued),
        )
    }

    /// Internal mining path, split out so unit tests can drive a chosen digest.
    pub(crate) fn try_mine(
        &mut self,
        digest: &[u8],
        caller: AccountId,
        deposit: u128,
        now: u64,
    ) -> u128 {
        require!(self.status == ProjectStatus::Mining, "Project is finalized");
        require!(now < self.deadline_ns, "Deadline has passed");
        require!(deposit == self.claim_fee, "Attach the claim fee");

        let level = level_for(self.mined, self.supply);
        require!(
            digest_below_target(digest, target_for(level)),
            "Invalid proof"
        );

        let remaining = self.supply.saturating_sub(self.mined);
        let reward = self.reward_per_proof.min(remaining);
        require!(reward > 0, "Allocation is empty");

        let claimed = self.epoch_claims.get(&(level, caller.clone())).unwrap_or(0);
        require!(
            claimed.saturating_add(reward) <= self.epoch_cap,
            "Epoch cap reached for this account"
        );
        self.epoch_claims
            .insert(&(level, caller.clone()), &(claimed + reward));

        // Credit the miner. The allocation exists only as a ceiling, so the
        // mint is also what raises the FT total supply.
        let balance = self.ft.accounts.get(&caller).unwrap_or(0);
        self.ft.accounts.insert(&caller, &(balance + reward));
        self.ft.total_supply += reward;
        self.mined += reward;

        self.split_fee();
        self.emit_mine(&caller, reward, level);
        reward
    }

    fn split_fee(&mut self) {
        let fee = self.claim_fee;
        self.pool_accrued += fee * POOL_BPS as u128 / BPS_DENOMINATOR as u128;
        self.creator_accrued += fee * CREATOR_BPS as u128 / BPS_DENOMINATOR as u128;
        self.protocol_accrued += fee * PROTOCOL_BPS as u128 / BPS_DENOMINATOR as u128;
    }

    fn emit_mine(&self, caller: &AccountId, reward: u128, level: u32) {
        let payload = format!(
            "{{\"standard\":\"swarmpad\",\"version\":\"1.0.0\",\"event\":\"mine\",\"data\":{{\"account\":\"{}\",\"reward\":\"{}\",\"level\":{},\"mined\":\"{}\"}}}}",
            caller, reward, level, self.mined
        );
        env::log_str(&format!("EVENT_JSON:{payload}"));
    }
}

/// `#[near]` is what exports the method. Without it the trait is implemented
/// but `ft_metadata` is not callable on chain, which is how the first token
/// version shipped: wallets and the web app could read balances but not the
/// name, symbol or decimals.
#[near]
impl FungibleTokenMetadataProvider for Token {
    fn ft_metadata(&self) -> FungibleTokenMetadata {
        self.metadata.clone()
    }
}

#[near]
impl FungibleTokenCore for Token {
    #[payable]
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>) {
        self.ft.ft_transfer(receiver_id, amount, memo)
    }

    #[payable]
    fn ft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        amount: U128,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<U128> {
        self.ft.ft_transfer_call(receiver_id, amount, memo, msg)
    }

    fn ft_total_supply(&self) -> U128 {
        self.ft.ft_total_supply()
    }

    fn ft_balance_of(&self, account_id: AccountId) -> U128 {
        self.ft.ft_balance_of(account_id)
    }
}

#[near]
impl FungibleTokenResolver for Token {
    #[private]
    fn ft_resolve_transfer(
        &mut self,
        sender_id: AccountId,
        receiver_id: AccountId,
        amount: U128,
    ) -> U128 {
        let (used, burned) = self
            .ft
            .internal_ft_resolve_transfer(&sender_id, receiver_id, amount);
        if burned > 0 {
            log!("Account @{} burned {}", sender_id, burned);
        }
        U128(used)
    }
}

#[near]
impl StorageManagement for Token {
    #[payable]
    fn storage_deposit(
        &mut self,
        account_id: Option<AccountId>,
        registration_only: Option<bool>,
    ) -> StorageBalance {
        self.ft.storage_deposit(account_id, registration_only)
    }

    #[payable]
    fn storage_withdraw(&mut self, amount: Option<near_sdk::NearToken>) -> StorageBalance {
        self.ft.storage_withdraw(amount)
    }

    #[payable]
    fn storage_unregister(&mut self, force: Option<bool>) -> bool {
        if let Some((account_id, balance)) = self.ft.internal_storage_unregister(force) {
            log!("Closed @{} with {}", account_id, balance);
            true
        } else {
            false
        }
    }

    fn storage_balance_bounds(&self) -> StorageBalanceBounds {
        self.ft.storage_balance_bounds()
    }

    fn storage_balance_of(&self, account_id: AccountId) -> Option<StorageBalance> {
        self.ft.storage_balance_of(account_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::{testing_env, Gas, NearToken};

    const SUPPLY: u128 = 1_000_000_000_000_000_000_000_000; // 1M tokens, 18 decimals
    const REWARD: u128 = 10_000_000_000_000_000_000; // 10 tokens
    const CAP: u128 = 30_000_000_000_000_000_000; // 30 tokens per level

    const NOW: u64 = 1_000_000_000_000_000_000;

    fn setup(deposit: u128) -> Token {
        let context = VMContextBuilder::new()
            .predecessor_account_id(accounts(1))
            .attached_deposit(NearToken::from_yoctonear(deposit))
            .block_timestamp(NOW)
            .prepaid_gas(Gas::from_tgas(300))
            .build();
        testing_env!(context);
        Token::new(
            accounts(1),
            accounts(2),
            accounts(3),
            accounts(4),
            "Swarm".to_string(),
            "SWRM".to_string(),
            18,
            U128(SUPPLY),
            U128(REWARD),
            U128(CAP),
            5_000,
            NOW + 1_000_000_000_000_000,
        )
    }

    /// Demo profile: one proof releases 2.5% of supply, so 40 proofs cover the
    /// whole ladder and 20 proofs reach the 50% threshold.
    fn setup_demo() -> Token {
        let context = VMContextBuilder::new()
            .predecessor_account_id(accounts(1))
            .block_timestamp(NOW)
            .prepaid_gas(Gas::from_tgas(300))
            .build();
        testing_env!(context);
        let reward = SUPPLY / 40;
        Token::new(
            accounts(1),
            accounts(2),
            accounts(3),
            accounts(4),
            "Swarm".to_string(),
            "SWRM".to_string(),
            18,
            U128(SUPPLY),
            U128(reward),
            U128(reward),
            5_000,
            NOW + 1_000_000_000_000_000,
        )
    }

    fn valid_digest() -> [u8; 32] {
        // Any digest whose first 16 bytes are zero is below every target.
        [0u8; 32]
    }

    fn signed(deposit: u128) -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder
            .predecessor_account_id(accounts(1))
            .attached_deposit(NearToken::from_yoctonear(deposit))
            .block_timestamp(NOW)
            .prepaid_gas(Gas::from_tgas(300));
        builder
    }

    fn register(account: AccountId, deposit: u128) {
        let ctx = VMContextBuilder::new()
            .predecessor_account_id(account)
            .attached_deposit(NearToken::from_yoctonear(deposit))
            .block_timestamp(NOW)
            .prepaid_gas(Gas::from_tgas(300))
            .build();
        testing_env!(ctx);
    }

    #[test]
    fn storage_deposit_registers_an_account() {
        let mut token = setup(0);
        register(accounts(2), 10_000_000_000_000_000_000_000);
        token.storage_deposit(Some(accounts(2)), None);
        assert!(token.storage_balance_of(accounts(2)).is_some());
        assert_eq!(token.ft_balance_of(accounts(2)), U128(0));
    }

    #[test]
    fn ft_transfer_moves_tokens_between_registered_accounts() {
        let mut token = setup(0);
        register(accounts(2), 10_000_000_000_000_000_000_000);
        token.storage_deposit(Some(accounts(2)), None);
        let now = env::block_timestamp();
        token.try_mine(&valid_digest(), accounts(1), CLAIM_FEE_YOCTO, now);

        // 1 yoctoNEAR is required to authorise a transfer.
        register(accounts(1), 1);
        token.ft_transfer(accounts(2), U128(REWARD / 2), None);

        assert_eq!(token.ft_balance_of(accounts(1)), U128(REWARD / 2));
        assert_eq!(token.ft_balance_of(accounts(2)), U128(REWARD / 2));
        assert_eq!(token.ft_total_supply(), U128(REWARD));
    }

    #[test]
    #[should_panic(expected = "is not registered")]
    fn ft_transfer_to_unregistered_account_is_rejected() {
        let mut token = setup(0);
        let now = env::block_timestamp();
        token.try_mine(&valid_digest(), accounts(1), CLAIM_FEE_YOCTO, now);
        register(accounts(1), 1);
        token.ft_transfer(accounts(5), U128(1), None);
    }

    #[test]
    #[should_panic(expected = "Requires attached deposit of exactly 1 yoctoNEAR")]
    fn ft_transfer_without_yocto_is_rejected() {
        let mut token = setup(0);
        register(accounts(2), 10_000_000_000_000_000_000_000);
        token.storage_deposit(Some(accounts(2)), None);
        let now = env::block_timestamp();
        token.try_mine(&valid_digest(), accounts(1), CLAIM_FEE_YOCTO, now);
        register(accounts(1), 0);
        token.ft_transfer(accounts(2), U128(1), None);
    }

    #[test]
    fn ft_transfer_call_returns_a_promise_for_registered_receiver() {
        let mut token = setup(0);
        register(accounts(2), 10_000_000_000_000_000_000_000);
        token.storage_deposit(Some(accounts(2)), None);
        let now = env::block_timestamp();
        token.try_mine(&valid_digest(), accounts(1), CLAIM_FEE_YOCTO, now);
        register(accounts(1), 1);
        match token.ft_transfer_call(accounts(2), U128(1), None, "{}".to_string()) {
            PromiseOrValue::Promise(_) => {}
            PromiseOrValue::Value(_) => panic!("expected a cross-contract call"),
        }
        assert_eq!(token.ft_total_supply(), U128(REWARD));
    }

    #[test]
    fn mining_mints_one_reward() {
        let mut token = setup(CLAIM_FEE_YOCTO);
        let now = env::block_timestamp();
        let reward = token.try_mine(&valid_digest(), accounts(1), CLAIM_FEE_YOCTO, now);
        assert_eq!(reward, REWARD);
        assert_eq!(token.ft.total_supply, REWARD);
        assert_eq!(token.ft.accounts.get(&accounts(1)), Some(REWARD));
        assert_eq!(token.mined(), U128(REWARD));
    }

    #[test]
    fn claim_fee_is_split() {
        let mut token = setup(CLAIM_FEE_YOCTO);
        let now = env::block_timestamp();
        token.try_mine(&valid_digest(), accounts(1), CLAIM_FEE_YOCTO, now);
        assert_eq!(token.pool_accrued, CLAIM_FEE_YOCTO * 5 / 10);
        assert_eq!(token.creator_accrued, CLAIM_FEE_YOCTO * 3 / 10);
        assert_eq!(token.protocol_accrued, CLAIM_FEE_YOCTO * 2 / 10);
    }

    #[test]
    #[should_panic(expected = "Invalid proof")]
    fn high_digest_is_rejected() {
        let mut token = setup(CLAIM_FEE_YOCTO);
        let now = env::block_timestamp();
        token.try_mine(&[0xffu8; 32], accounts(1), CLAIM_FEE_YOCTO, now);
    }

    #[test]
    #[should_panic(expected = "Attach the claim fee")]
    fn mining_without_fee_is_rejected() {
        let mut token = setup(0);
        let now = env::block_timestamp();
        token.try_mine(&valid_digest(), accounts(1), 0, now);
    }

    #[test]
    #[should_panic(expected = "Epoch cap reached")]
    fn per_epoch_cap_stops_one_account() {
        let mut token = setup(CLAIM_FEE_YOCTO);
        let now = env::block_timestamp();
        token.try_mine(&valid_digest(), accounts(1), CLAIM_FEE_YOCTO, now);
        token.try_mine(&valid_digest(), accounts(1), CLAIM_FEE_YOCTO, now);
        token.try_mine(&valid_digest(), accounts(1), CLAIM_FEE_YOCTO, now);
        // 3 x 10 tokens hits the 30 token cap for level 1.
        token.try_mine(&valid_digest(), accounts(1), CLAIM_FEE_YOCTO, now);
    }

    #[test]
    fn another_account_still_mines() {
        let mut token = setup(CLAIM_FEE_YOCTO);
        let now = env::block_timestamp();
        for _ in 0..3 {
            token.try_mine(&valid_digest(), accounts(1), CLAIM_FEE_YOCTO, now);
        }
        let reward = token.try_mine(&valid_digest(), accounts(2), CLAIM_FEE_YOCTO, now);
        assert_eq!(reward, REWARD);
    }

    #[test]
    fn finalize_fails_below_threshold() {
        let mut token = setup(CLAIM_FEE_YOCTO);
        let now = env::block_timestamp();
        token.try_mine(&valid_digest(), accounts(1), CLAIM_FEE_YOCTO, now);
        testing_env!(signed(0).block_timestamp(token.deadline_ns + 1).build());
        assert_eq!(token.finalize(), ProjectStatus::Failed);
        assert_eq!(token.burned(), U128(SUPPLY - REWARD));
    }

    #[test]
    #[should_panic(expected = "Project is finalized")]
    fn no_mining_after_finalize() {
        let mut token = setup(CLAIM_FEE_YOCTO);
        let now = env::block_timestamp();
        token.try_mine(&valid_digest(), accounts(1), CLAIM_FEE_YOCTO, now);
        testing_env!(signed(0).block_timestamp(token.deadline_ns + 1).build());
        token.finalize();
        testing_env!(signed(CLAIM_FEE_YOCTO).build());
        token.try_mine(&valid_digest(), accounts(2), CLAIM_FEE_YOCTO, now);
    }

    #[test]
    #[should_panic(expected = "Deadline has not passed")]
    fn finalize_before_deadline_is_rejected() {
        let mut token = setup(CLAIM_FEE_YOCTO);
        token.finalize();
    }

    #[test]
    fn withdraw_fees_pays_three_shares_and_clears() {
        let mut token = setup(CLAIM_FEE_YOCTO);
        let now = env::block_timestamp();
        token.try_mine(&valid_digest(), accounts(1), CLAIM_FEE_YOCTO, now);
        let (pool, creator, protocol) = token.withdraw_fees();
        assert_eq!(pool, U128(CLAIM_FEE_YOCTO * 5 / 10));
        assert_eq!(creator, U128(CLAIM_FEE_YOCTO * 3 / 10));
        assert_eq!(protocol, U128(CLAIM_FEE_YOCTO * 2 / 10));
        assert_eq!(
            token.accrued_fees(),
            (U128(0), U128(0), U128(0)),
            "accrued shares must be cleared before the transfers"
        );
    }

    #[test]
    #[should_panic(expected = "Nothing to withdraw")]
    fn withdraw_without_fees_is_rejected() {
        let mut token = setup(CLAIM_FEE_YOCTO);
        token.withdraw_fees();
    }

    #[test]
    fn finalize_is_valid_once_half_the_supply_is_mined() {
        let mut token = setup_demo();
        let now = env::block_timestamp();
        // One proof releases 2.5% of supply, so 20 proofs reach the threshold.
        for index in 0..20u32 {
            let miner: AccountId = format!("miner{}.testnet", index).parse().unwrap();
            token.try_mine(&valid_digest(), miner, CLAIM_FEE_YOCTO, now);
        }
        assert_eq!(token.mined_bps(), 5_000);
        testing_env!(signed(0).block_timestamp(token.deadline_ns + 1).build());
        assert_eq!(token.finalize(), ProjectStatus::Valid);
        assert_eq!(token.burned(), U128(SUPPLY - token.mined().0));
    }

    #[test]
    fn a_large_reward_can_skip_levels() {
        // 10% of supply per proof means one proof moves four levels.
        let mut token = setup(CLAIM_FEE_YOCTO);
        let now = env::block_timestamp();
        token.reward_per_proof = SUPPLY / 10;
        token.epoch_cap = SUPPLY / 10;
        token.try_mine(&valid_digest(), accounts(1), CLAIM_FEE_YOCTO, now);
        assert_eq!(token.mined_bps(), 1_000);
        assert_eq!(token.level(), 5);
    }
}
