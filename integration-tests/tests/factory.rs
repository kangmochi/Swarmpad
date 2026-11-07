//! Sandbox tests: the full factory to token flow with real receipts.
//!
//! Run after building the wasm:
//! `cargo build --workspace --target wasm32-unknown-unknown --release`
//! `cargo test -p swarmpad-integration-tests`

use base64::{engine::general_purpose::STANDARD, Engine};
use near_workspaces::types::NearToken;
use near_workspaces::{network::Sandbox, AccountId, Contract, Worker};
use serde_json::json;

fn wasm(name: &str) -> Vec<u8> {
    let path = format!(
        "{}/../target/wasm32-unknown-unknown/release/{}.wasm",
        env!("CARGO_MANIFEST_DIR"),
        name
    );
    std::fs::read(&path).unwrap_or_else(|err| panic!("read {path}: {err}"))
}

async fn deploy_factory(worker: &Worker<Sandbox>) -> Contract {
    let factory = worker
        .dev_deploy(&wasm("swarmpad_factory"))
        .await
        .expect("deploy factory");
    let admin: AccountId = factory.id().clone();
    factory
        .call("new")
        .args_json(json!({ "admin": admin, "protocol_account": admin }))
        .transact()
        .await
        .expect("factory new")
        .into_result()
        .expect("factory new result");
    factory
}

#[tokio::test]
async fn factory_deploys_a_token_and_records_it() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let factory = deploy_factory(&worker).await;

    // Protocol uploads the token code once.
    let token_code = STANDARD.encode(wasm("swarmpad_token"));
    factory
        .call("set_token_code")
        .args_json(json!({ "code": token_code }))
        .deposit(NearToken::from_millinear(500))
        .max_gas()
        .transact()
        .await?
        .into_result()?;

    let deposit: NearToken = factory
        .view("launch_deposit")
        .args_json(json!({}))
        .await?
        .json()?;

    let creator = worker.dev_create_account().await?;
    let supply = "1000000000000000000000000";
    let reward = "25000000000000000000000";
    factory
        .call("launch")
        .args_json(json!({
            "args": {
                "slug": "swarm",
                "creator_id": creator.id(),
                "payout_account": creator.id(),
                "name": "Swarm Sandbox",
                "symbol": "SWRM",
                "decimals": 18,
                "supply": supply,
                "reward_per_proof": reward,
                "epoch_cap": reward,
                "threshold_bps": 5000,
                "duration_ns": 1_800_000_000_000u64,
                "config_hash": "sha256:sandbox"
            }
        }))
        .deposit(deposit)
        .max_gas()
        .transact()
        .await?
        .into_result()?;

    // The callback records the project only when the deploy receipt succeeded.
    let project: Option<serde_json::Value> = factory
        .view("project")
        .args_json(json!({ "slug": "swarm" }))
        .await?
        .json()?;
    let project = project.expect("project recorded by on_launch");
    let token_account: AccountId = project["token_account"].as_str().unwrap().parse()?;

    let caller = factory.as_account();

    let token_status: String = caller.view(&token_account, "status").await?.json()?;
    let token_supply: String = caller.view(&token_account, "supply").await?.json()?;
    let level: u32 = caller.view(&token_account, "level").await?.json()?;
    assert_eq!(token_status, "Mining");
    assert_eq!(token_supply, supply);
    assert_eq!(level, 1);

    // The metadata trait must be exported, not just implemented: the first
    // token version shipped without `#[near]` on the impl, so wallets and the
    // web app could read balances but not the name, symbol or decimals.
    let metadata: serde_json::Value = caller.view(&token_account, "ft_metadata").await?.json()?;
    assert_eq!(metadata["name"], "Swarm Sandbox");
    assert_eq!(metadata["symbol"], "SWRM");
    assert_eq!(metadata["decimals"], 18);

    // A token account is created without keys: nothing can upgrade it.
    let keys = worker.view_access_keys(&token_account).await?;
    assert!(keys.is_empty(), "project account must have no access keys");

    // Proofs are checked on-chain: a digest above the target must fail.
    let bad_proof = STANDARD.encode([0xffu8; 32]);
    let mine = caller
        .call(&token_account, "mine")
        .args_json(json!({ "preimage": bad_proof }))
        .deposit(NearToken::from_millinear(50))
        .max_gas()
        .transact()
        .await?;
    assert!(mine.is_failure(), "invalid proof must be rejected");
    Ok(())
}
