//! Sandbox tests for the outcome path: `finalize` after the deadline.
//!
//! Run after building the wasm:
//! `cargo build --workspace --target wasm32-unknown-unknown --release`
//! `cargo test -p swarmpad-integration-tests`

use base64::{engine::general_purpose::STANDARD, Engine};
use near_workspaces::types::NearToken;
use near_workspaces::{network::Sandbox, AccountId, Contract, Worker};
use serde_json::json;

const SUPPLY: &str = "1000000000000000000000000";
const HALF_OF_SUPPLY: &str = "500000000000000000000000";
const CLAIM_FEE: NearToken = NearToken::from_millinear(50);

/// A preimage whose SHA-256 prefix is `000000008c3000c774e88f1f1914ca17`, which
/// is below the level 1 target (`2^98`) of every project. Precomputed once so
/// the test does not have to search.
const PREIMAGE: &str = "iVSjps3IhzoAAAAAAedl4g==";

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
        .call("set_token_code")
        .args_json(json!({ "code": STANDARD.encode(wasm("swarmpad_token")) }))
        .deposit(NearToken::from_millinear(500))
        .max_gas()
        .transact()
        .await
        .expect("set_token_code")
        .into_result()
        .expect("set_token_code result");

    factory
}

async fn launch(
    worker: &Worker<Sandbox>,
    factory: &Contract,
    slug: &str,
    reward: &str,
    duration_ns: u64,
) -> AccountId {
    let deposit: NearToken = factory
        .view("launch_deposit")
        .args_json(json!({}))
        .await
        .expect("launch_deposit")
        .json()
        .expect("launch_deposit json");

    let creator = worker.dev_create_account().await.expect("creator");
    factory
        .call("launch")
        .args_json(json!({
            "args": {
                "slug": slug,
                "creator_id": creator.id(),
                "payout_account": creator.id(),
                "name": format!("Test {slug}"),
                "symbol": "TEST",
                "decimals": 18,
                "supply": SUPPLY,
                "reward_per_proof": reward,
                "epoch_cap": reward,
                "threshold_bps": 5000,
                "duration_ns": duration_ns,
                "config_hash": format!("sha256:{slug}")
            }
        }))
        .deposit(deposit)
        .max_gas()
        .transact()
        .await
        .expect("launch")
        .into_result()
        .expect("launch result");

    let project: serde_json::Value = factory
        .view("project")
        .args_json(json!({ "slug": slug }))
        .await
        .expect("project view")
        .json()
        .expect("project json");
    project["token_account"]
        .as_str()
        .expect("token account")
        .parse()
        .expect("account id")
}

/// One proof is worth half the supply here, so a single claim clears the 50%
/// threshold: that is the cheapest way to reach a VALID outcome.
#[tokio::test]
async fn project_above_threshold_finalizes_valid() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let factory = deploy_factory(&worker).await;
    let token = launch(
        &worker,
        &factory,
        "validcase",
        HALF_OF_SUPPLY,
        10_000_000_000,
    )
    .await;

    let caller = factory.as_account();
    let outcome = caller
        .call(&token, "mine")
        .args_json(json!({ "preimage": PREIMAGE }))
        .deposit(CLAIM_FEE)
        .max_gas()
        .transact()
        .await
        .map_err(|error| anyhow::anyhow!("mine error: {error:?}"))?;
    if outcome.is_failure() {
        panic!("mine failed: {:?}", outcome.logs());
    }
    outcome.into_result()?;

    let mined: String = caller.view(&token, "mined").await?.json()?;
    let level: u32 = caller.view(&token, "level").await?.json()?;
    assert_eq!(mined, HALF_OF_SUPPLY);
    assert_eq!(level, 21, "50% of supply is level 21");

    // The sandbox stamps blocks with wall-clock time, so waiting is what moves
    // the deadline. fast_forward only advances heights.
    tokio::time::sleep(std::time::Duration::from_secs(12)).await;

    let status: String = caller
        .call(&token, "finalize")
        .transact()
        .await?
        .into_result()?
        .json()?;
    assert_eq!(status, "Valid");

    let burned: String = caller.view(&token, "burned").await?.json()?;
    let supply: String = caller.view(&token, "supply").await?.json()?;
    let remaining: String = caller.view(&token, "remaining").await?.json()?;
    assert_eq!(
        burned, HALF_OF_SUPPLY,
        "the unmined half is recorded as burned"
    );
    // `remaining()` keeps reporting the unmined amount; `burned()` is the record
    // that it can never be minted, so the two are equal after finalize.
    assert_eq!(remaining, burned);
    assert_eq!(supply, SUPPLY);
    Ok(())
}

#[tokio::test]
async fn project_below_threshold_finalizes_failed_and_stops_emission() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let factory = deploy_factory(&worker).await;
    let token = launch(
        &worker,
        &factory,
        "failcase",
        "25000000000000000000000",
        3_000_000_000,
    )
    .await;

    tokio::time::sleep(std::time::Duration::from_secs(5)).await;
    let caller = factory.as_account();

    // A valid proof after the deadline must still be rejected.
    let late = caller
        .call(&token, "mine")
        .args_json(json!({ "preimage": PREIMAGE }))
        .deposit(CLAIM_FEE)
        .max_gas()
        .transact()
        .await?;
    assert!(late.is_failure(), "mining after the deadline must fail");

    let status: String = caller
        .call(&token, "finalize")
        .transact()
        .await?
        .into_result()?
        .json()?;
    assert_eq!(status, "Failed");

    let burned: String = caller.view(&token, "burned").await?.json()?;
    assert_eq!(
        burned, SUPPLY,
        "nothing was mined, so the whole supply burns"
    );
    Ok(())
}
