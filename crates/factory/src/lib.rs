//! Swarmpad factory.
//!
//! Registers projects and deploys one token contract per project on a
//! sub-account. The factory holds the protocol's admin rights (token code
//! upgrades); deployed projects do not, which is what makes a project
//! immutable once launched.

use near_sdk::collections::{LookupMap, UnorderedMap};
use near_sdk::json_types::{Base64VecU8, U128};
use near_sdk::serde_json::json;
use near_sdk::{
    env, log, near, require, AccountId, BorshStorageKey, Gas, NearToken, PanicOnDefault, Promise,
};
use swarmpad_common::{Project, BPS_DENOMINATOR, MIN_THRESHOLD_BPS};

/// Gas for the token `new` call. Deployment itself does not use this budget.
const TOKEN_INIT_GAS: Gas = Gas::from_tgas(60);

/// Gas reserved for the `on_launch` callback that records the project.
const LAUNCH_CALLBACK_GAS: Gas = Gas::from_tgas(25);

/// Account ids are capped at 64 characters, so a slug plus the dot and the
/// factory id has to fit.
const MAX_ACCOUNT_ID_LEN: usize = 64;

/// Head room on top of the code storage cost: account creation, the initial
/// state and the first claim records.
const LAUNCH_BUFFER: NearToken = NearToken::from_millinear(300);

#[derive(BorshStorageKey, near_sdk::borsh::BorshSerialize)]
#[borsh(crate = "near_sdk::borsh")]
enum StorageKey {
    Projects,
    Tokens,
}

#[derive(PanicOnDefault)]
#[near(contract_state)]
pub struct Factory {
    admin: AccountId,
    protocol_account: AccountId,
    /// Compiled token wasm. Uploaded by the protocol, never by a creator.
    token_code: Vec<u8>,
    projects: UnorderedMap<String, Project>,
    tokens: LookupMap<String, AccountId>,
}

/// Arguments for one launch. Kept flat so the agent endpoint can build it from
/// a `.md` file without extra encoding.
#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct LaunchArgs {
    pub slug: String,
    pub creator_id: AccountId,
    pub payout_account: AccountId,
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
    pub supply: U128,
    pub reward_per_proof: U128,
    pub epoch_cap: U128,
    pub threshold_bps: u32,
    pub duration_ns: u64,
    /// Hash of the project `.md`. The factory never fetches the URL itself.
    pub config_hash: String,
}

#[near]
impl Factory {
    #[init]
    pub fn new(admin: AccountId, protocol_account: AccountId) -> Self {
        Self {
            admin,
            protocol_account,
            token_code: Vec::new(),
            projects: UnorderedMap::new(StorageKey::Projects),
            tokens: LookupMap::new(StorageKey::Tokens),
        }
    }

    /// Uploads the token wasm used for new projects. Only the protocol admin
    /// can call it, and it never changes a project that is already deployed.
    /// Payable because the protocol covers the storage of the code with the
    /// attached deposit; calling it with a deposit but without `#[payable]`
    /// makes the call trap before the body runs.
    #[payable]
    pub fn set_token_code(&mut self, code: Base64VecU8) {
        self.assert_admin();
        require!(!code.0.is_empty(), "Code must not be empty");
        self.token_code = code.0;
    }

    /// Deploys the token on `<slug>.<factory>`. The project is recorded by the
    /// `on_launch` callback only after the deployment succeeds, so a failed
    /// deploy cannot leave a dead entry in the registry.
    #[payable]
    pub fn launch(&mut self, args: LaunchArgs) -> Promise {
        require!(!self.token_code.is_empty(), "Token code is not set");
        require!(
            env::attached_deposit() >= self.launch_deposit(),
            "Attach the launch deposit"
        );
        require!(is_valid_slug(&args.slug), "Invalid slug");
        require!(
            args.slug.len() + 1 + env::current_account_id().as_str().len() <= MAX_ACCOUNT_ID_LEN,
            "Slug too long for this factory id"
        );
        require!(
            (MIN_THRESHOLD_BPS..=BPS_DENOMINATOR).contains(&args.threshold_bps),
            "Threshold must be between 50% and 100%"
        );
        require!(args.duration_ns > 0, "Duration must be positive");
        require!(self.projects.get(&args.slug).is_none(), "Slug is taken");

        let token_account: AccountId = format!("{}.{}", args.slug, env::current_account_id())
            .parse()
            .expect("valid sub-account");

        let deadline_ns = env::block_timestamp() + args.duration_ns;
        let project = Project {
            slug: args.slug.clone(),
            token_account: token_account.clone(),
            creator_id: args.creator_id.clone(),
            payout_account: args.payout_account.clone(),
            supply: args.supply,
            threshold_bps: args.threshold_bps,
            deadline_ns,
            config_hash: args.config_hash.clone(),
        };
        let init_args = json!({
            "creator_id": args.creator_id,
            "payout_account": args.payout_account,
            "protocol_account": self.protocol_account,
            // Phase 2 points this at the liquidity pool account; until then the
            // pool share goes to the protocol account instead of being stranded.
            "pool_account": self.protocol_account,
            "name": args.name,
            "symbol": args.symbol,
            "decimals": args.decimals,
            "supply": args.supply,
            "reward_per_proof": args.reward_per_proof,
            "epoch_cap": args.epoch_cap,
            "threshold_bps": args.threshold_bps,
            "deadline_ns": deadline_ns,
        })
        .to_string();

        let deposit = env::attached_deposit();
        let deploy = Promise::new(token_account)
            .create_account()
            .transfer(deposit)
            .deploy_contract(self.token_code.clone())
            .function_call(
                "new".to_string(),
                init_args.into_bytes(),
                NearToken::from_yoctonear(0),
                TOKEN_INIT_GAS,
            );

        // The deployed account is created without an access key, which is what
        // makes a project immutable. The callback records the project only on
        // success, so the registry never points at a token that does not exist.
        deploy.then(
            Self::ext(env::current_account_id())
                .with_static_gas(LAUNCH_CALLBACK_GAS)
                .on_launch(project),
        )
    }

    /// Records a launch after the deploy receipt settles. Private, so only this
    /// contract can call it.
    #[private]
    pub fn on_launch(&mut self, project: Project) {
        match env::promise_result_checked(0, 0) {
            Ok(_) => {
                self.projects.insert(&project.slug, &project);
                self.tokens.insert(&project.slug, &project.token_account);
                log!("launch recorded: {}", project.token_account);
            }
            Err(_) => {
                env::log_str(&format!(
                    "launch failed for slug {}, nothing recorded",
                    project.slug
                ));
            }
        }
    }

    /// Deposit a caller has to attach so the new token account can pay for its
    /// own code storage. The first live launch failed with LackBalanceForState
    /// because this was a fixed 0.5 NEAR floor instead of the code cost.
    pub fn launch_deposit(&self) -> NearToken {
        env::storage_byte_cost()
            .saturating_mul(self.token_code.len() as u128)
            .saturating_add(LAUNCH_BUFFER)
    }

    fn assert_admin(&self) {
        require!(
            env::predecessor_account_id() == self.admin,
            "Only the protocol admin can call this"
        );
    }

    // Views

    pub fn admin(&self) -> AccountId {
        self.admin.clone()
    }

    pub fn protocol_account(&self) -> AccountId {
        self.protocol_account.clone()
    }

    pub fn token_code_len(&self) -> u64 {
        self.token_code.len() as u64
    }

    pub fn project(&self, slug: String) -> Option<Project> {
        self.projects.get(&slug)
    }

    pub fn token_account(&self, slug: String) -> Option<AccountId> {
        self.tokens.get(&slug)
    }

    pub fn project_count(&self) -> u64 {
        self.projects.len()
    }

    /// Registry page for the web app. The registry is an unordered map, so the
    /// order is the insertion order and can change when an entry is removed,
    /// which never happens today. `limit` is capped at 100 to keep the view
    /// cheap to serve.
    pub fn projects(&self, from: Option<u64>, limit: Option<u64>) -> Vec<Project> {
        let from = from.unwrap_or(0) as usize;
        let limit = limit.unwrap_or(50).min(100) as usize;
        self.projects
            .iter()
            .skip(from)
            .take(limit)
            .map(|(_, project)| project)
            .collect()
    }
}

/// `[a-z0-9-]`, 1..=32 characters, no leading or trailing hyphen.
pub fn is_valid_slug(slug: &str) -> bool {
    let bytes = slug.as_bytes();
    if bytes.is_empty() || bytes.len() > 32 {
        return false;
    }
    if slug.starts_with('-') || slug.ends_with('-') {
        return false;
    }
    bytes
        .iter()
        .all(|b| matches!(b, b'a'..=b'z' | b'0'..=b'9' | b'-'))
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::testing_env;

    fn build() -> Factory {
        testing_env!(VMContextBuilder::new()
            .predecessor_account_id(accounts(1))
            .build());
        Factory::new(accounts(1), accounts(2))
    }

    #[test]
    fn only_admin_can_set_token_code() {
        let mut factory = build();
        testing_env!(VMContextBuilder::new()
            .predecessor_account_id(accounts(3))
            .build());
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            factory.set_token_code(Base64VecU8(vec![1, 2, 3]))
        }));
        assert!(result.is_err());
    }

    #[test]
    fn admin_sets_token_code() {
        let mut factory = build();
        factory.set_token_code(Base64VecU8(vec![1, 2, 3]));
        assert_eq!(factory.token_code_len(), 3);
    }

    #[test]
    fn set_token_code_accepts_deposit() {
        let mut factory = build();
        testing_env!(VMContextBuilder::new()
            .predecessor_account_id(accounts(1))
            .attached_deposit(NearToken::from_millinear(10))
            .build());
        factory.set_token_code(Base64VecU8(vec![1, 2, 3]));
        assert_eq!(factory.token_code_len(), 3);
    }

    #[test]
    fn launch_requires_deposit_covering_code_storage() {
        let mut factory = build();
        factory.set_token_code(Base64VecU8(vec![0u8; 1000]));
        testing_env!(VMContextBuilder::new()
            .predecessor_account_id(accounts(1))
            .attached_deposit(NearToken::from_millinear(1))
            .build());
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            factory.launch(sample_args())
        }));
        assert!(result.is_err());
    }

    #[test]
    fn launch_requires_registered_code() {
        let mut factory = build();
        testing_env!(VMContextBuilder::new()
            .predecessor_account_id(accounts(1))
            .attached_deposit(NearToken::from_millinear(500))
            .build());
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            factory.launch(sample_args())
        }));
        assert!(result.is_err());
    }

    fn sample_args() -> LaunchArgs {
        LaunchArgs {
            slug: "swarm".to_string(),
            creator_id: accounts(4),
            payout_account: accounts(4),
            name: "Swarm".to_string(),
            symbol: "SWRM".to_string(),
            decimals: 18,
            supply: U128(1_000_000),
            reward_per_proof: U128(1),
            epoch_cap: U128(10),
            threshold_bps: 5_000,
            duration_ns: 2_592_000_000_000_000,
            config_hash: "sha256:00".to_string(),
        }
    }

    #[test]
    #[should_panic(expected = "Slug too long")]
    fn launch_rejects_slug_that_breaks_the_account_id_limit() {
        let mut factory = build();
        factory.set_token_code(Base64VecU8(vec![0u8; 100]));
        let long_factory: AccountId = format!("{}.testnet", "f".repeat(40)).parse().unwrap();
        testing_env!(VMContextBuilder::new()
            .current_account_id(long_factory)
            .predecessor_account_id(accounts(1))
            .attached_deposit(NearToken::from_millinear(500))
            .build());
        let mut args = sample_args();
        args.slug = "a".repeat(32);
        let _ = factory.launch(args);
    }

    fn project_ref(slug: &str) -> Project {
        Project {
            slug: slug.to_string(),
            token_account: format!("{}.factory.testnet", slug).parse().unwrap(),
            creator_id: accounts(4),
            payout_account: accounts(4),
            supply: U128(1_000_000),
            threshold_bps: 5_000,
            deadline_ns: 1,
            config_hash: format!("sha256:{slug}"),
        }
    }

    #[allow(deprecated)]
    fn record(factory: &mut Factory, slug: &str) {
        near_sdk::test_utils::testing_env_with_promise_results(
            VMContextBuilder::new()
                .predecessor_account_id("factory.testnet".parse().unwrap())
                .build(),
            near_sdk::PromiseResult::Successful(vec![]),
        );
        factory.on_launch(project_ref(slug));
    }

    #[test]
    fn projects_view_paginates() {
        let mut factory = build();
        for slug in ["alpha", "beta", "gamma"] {
            record(&mut factory, slug);
        }
        assert_eq!(factory.projects(None, None).len(), 3);
        assert_eq!(factory.projects(Some(1), Some(1)).len(), 1);
        assert_eq!(factory.projects(Some(1), Some(1))[0].slug, "beta");
        assert_eq!(factory.projects(Some(3), None).len(), 0);
        // A limit above the cap is clamped, not rejected.
        assert_eq!(factory.projects(None, Some(500)).len(), 3);
    }

    #[test]
    #[allow(deprecated)]
    fn on_launch_records_the_project_after_success() {
        let mut factory = build();
        let project = project_ref("swarm");
        near_sdk::test_utils::testing_env_with_promise_results(
            VMContextBuilder::new()
                .predecessor_account_id("factory.testnet".parse().unwrap())
                .build(),
            near_sdk::PromiseResult::Successful(vec![]),
        );
        factory.on_launch(project);
        assert_eq!(factory.project_count(), 1);
        assert_eq!(
            factory.token_account("swarm".to_string()),
            Some("swarm.factory.testnet".parse().unwrap())
        );
    }

    #[test]
    #[allow(deprecated)]
    fn on_launch_skips_the_registry_when_the_deploy_failed() {
        let mut factory = build();
        let project = Project {
            slug: "swarm".to_string(),
            token_account: "swarm.factory.testnet".parse().unwrap(),
            creator_id: accounts(4),
            payout_account: accounts(4),
            supply: U128(1_000_000),
            threshold_bps: 5_000,
            deadline_ns: 1,
            config_hash: "sha256:00".to_string(),
        };
        near_sdk::test_utils::testing_env_with_promise_results(
            VMContextBuilder::new()
                .predecessor_account_id("factory.testnet".parse().unwrap())
                .build(),
            near_sdk::PromiseResult::Failed,
        );
        factory.on_launch(project);
        assert_eq!(factory.project_count(), 0);
    }

    #[test]
    fn slug_rules() {
        assert!(is_valid_slug("swarm"));
        assert!(is_valid_slug("swarm-2"));
        assert!(!is_valid_slug(""));
        assert!(!is_valid_slug("Swarm"));
        assert!(!is_valid_slug("-swarm"));
        assert!(!is_valid_slug("swarm-"));
        assert!(!is_valid_slug("swarm_pad"));
        assert!(!is_valid_slug(&"a".repeat(33)));
    }
}
