import { Link } from "react-router";

import { CLAIM_FEE, FACTORY_ID } from "../lib/config";
import { SAMPLE } from "../lib/launch";

const FIELDS = [
  ["name", "string", "required", "Display name of the token."],
  ["symbol", "string", "required", "Ticker, upper-cased by the app."],
  ["slug", "string", "required", "1-32 chars, a-z 0-9 and hyphen. Becomes the account id."],
  ["decimals", "number", "18", "Between 0 and 24."],
  ["supply", "number", "required", "Whole tokens, fixed at launch."],
  ["reward_per_proof", "number", "required", "Tokens released per accepted proof."],
  ["epoch_cap", "number", "= reward", "Maximum one account can mine per level."],
  ["threshold_bps", "number", "5000", "Share of supply needed for a Valid launch, 5000-10000."],
  ["duration", "duration", "30d", 'Written as "30d", "2h" or "30m".'],
  ["payout", "account", "creator", "Account that receives the creator share."],
];

const FACTORY_VIEWS = [
  ["projects(from?, limit?)", "Vec<Project>", "Registry page, insertion order."],
  ["project(slug)", "Option<Project>", "One registry entry."],
  ["project_count()", "u64", "Number of entries, including failed launches."],
  ["launch_deposit()", "NearToken", "Deposit derived from the token code size."],
  ["token_code_len()", "u64", "Bytes of the token wasm used for new projects."],
  ["admin()", "AccountId", "Protocol account that can upload new token code."],
];

const TOKEN_VIEWS = [
  ["status()", "Mining | Valid | Failed", "Final once finalize() runs."],
  ["supply() / mined() / remaining()", "U128", "Mined is what exists; remaining is unmined."],
  ["mined_bps()", "u32", "Mined share of supply in basis points."],
  ["level() / target()", "u32 / u128", "Current rung and the target it accepts."],
  ["reward_per_proof() / epoch_cap()", "U128", "Payout per proof and per-account cap."],
  ["threshold_bps() / deadline_ns()", "u32 / u64", "Launch condition, fixed at deploy."],
  ["claim_fee() / accrued_fees()", "U128 / (U128,U128,U128)", "Fee per claim, split pool/creator/protocol."],
  ["ft_metadata() / ft_balance_of(a)", "FT-1 views", "Standard fungible token surface."],
];

export function Docs() {
  const fee = Number(CLAIM_FEE) / 1e24;

  return (
    <section className="page docs">
      <div className="page__head">
        <p className="mono-label">Docs</p>
        <h1>Everything the contracts expose.</h1>
        <p className="page__lede">
          Swarmpad is two contracts on NEAR testnet: a factory that deploys projects, and one
          token per project. This page is the reference, written from the source that shipped.
        </p>
      </div>

      <article className="doc" id="schema">
        <h2>1 · The markdown file</h2>
        <p>
          A launch starts from one file. The app reads the frontmatter, hashes the whole file with
          SHA-256, and passes the hash to the factory as <code>config_hash</code>. The body is
          yours; the contract never parses it.
        </p>

        <pre className="code">
          <code>{SAMPLE}</code>
        </pre>

        <div className="tablewrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">field</th>
                <th scope="col">type</th>
                <th scope="col">default</th>
                <th scope="col">meaning</th>
              </tr>
            </thead>
            <tbody>
              {FIELDS.map(([field, type, fallback, meaning]) => (
                <tr key={field}>
                  <td className="mono-value">{field}</td>
                  <td>{type}</td>
                  <td className="mono-value">{fallback}</td>
                  <td>{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="doc" id="levels">
        <h2>2 · The level curve</h2>
        <p>
          Forty levels, 2.5% of supply each. Level 1 accepts digests below 2<sup>98</sup>; every
          step multiplies the target by 10/11, so the expected work grows 1.10x. The contract
          compares the first 128 bits of the SHA-256 digest, which keeps the check inside a
          u128.
        </p>
        <div className="tablewrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">level</th>
                <th scope="col">supply unlocked</th>
                <th scope="col">relative work</th>
                <th scope="col">target bits</th>
              </tr>
            </thead>
            <tbody>
              {[1, 10, 20, 30, 40].map((level) => (
                <tr key={level}>
                  <td>{level}</td>
                  <td>{Math.min(100, level * 2.5)}%</td>
                  <td>{(1.1 ** (level - 1)).toFixed(2)}x</td>
                  <td>{Math.round(98 - Math.log2(1.1) * (level - 1))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="doc__note">
          Reaching 50% of supply is about 6.12x heavier than level 1; reaching 100% is about
          41.1x, and the total work across the ladder is roughly 443x the first level.
        </p>
      </article>

      <article className="doc" id="fees">
        <h2>3 · The claim fee</h2>
        <p>
          Each accepted claim costs {fee.toFixed(2)} NEAR and is accrued inside the token: 50% to
          the pool account, 30% to the creator payout, 20% to the protocol.{" "}
          <code>withdraw_fees</code> clears state first, then schedules transfers to fixed
          accounts, so anyone can pay the shares out and nobody can redirect them.
        </p>
        <p>
          Until a liquidity pool exists, the pool account is the protocol account, so the pool
          share cannot be stranded in an account nobody controls.
        </p>
      </article>

      <article className="doc" id="surface">
        <h2>4 · Contract surface</h2>

        <h3>Factory · {FACTORY_ID}</h3>
        <div className="tablewrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">method</th>
                <th scope="col">returns</th>
                <th scope="col">notes</th>
              </tr>
            </thead>
            <tbody>
              {FACTORY_VIEWS.map(([method, returns, note]) => (
                <tr key={method}>
                  <td className="mono-value">{method}</td>
                  <td className="mono-value">{returns}</td>
                  <td>{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3>Project token · &lt;slug&gt;.{FACTORY_ID}</h3>
        <div className="tablewrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">method</th>
                <th scope="col">returns</th>
                <th scope="col">notes</th>
              </tr>
            </thead>
            <tbody>
              {TOKEN_VIEWS.map(([method, returns, note]) => (
                <tr key={method}>
                  <td className="mono-value">{method}</td>
                  <td className="mono-value">{returns}</td>
                  <td>{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="doc" id="agent">
        <h2>5 · Agent endpoint</h2>
        <p>
          Agents that would rather not drive a browser can sign the same calls themselves. The
          sketch below is the shape the protocol intends to expose; today it is a plan, not a
          running service, and the page says so.
        </p>
        <pre className="code">
          <code>{`POST /v1/projects
{
  "markdown": "---\\nname: Swarm Token\\n...",
  "creator": "agent.testnet"
}
→ 201
{
  "slug": "swarm",
  "token_account": "swarm.swarmpad.testnet",
  "config_hash": "sha256:…",
  "launch_args": { … },
  "deposit": "2606150000000000000000000"
}

GET /v1/projects/swarm
→ 200 { "status": "Mining", "mined_bps": 250, "level": 2, "target": "…" }

POST /v1/projects/swarm/proofs
{ "preimage": "base64…" }
→ 202 { "accepted": true, "reward": "25000", "level": 2 }`}</code>
        </pre>
        <p className="doc__note">
          The service would hold no keys: it prepares an unsigned transaction and returns it, so
          the agent signs with its own account.
        </p>
      </article>

      <article className="doc" id="addresses">
        <h2>6 · Addresses</h2>
        <div className="tablewrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">item</th>
                <th scope="col">value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>factory</td>
                <td className="mono-value">{FACTORY_ID}</td>
              </tr>
              <tr>
                <td>network</td>
                <td className="mono-value">testnet · rpc.testnet.near.org</td>
              </tr>
              <tr>
                <td>explorer</td>
                <td className="mono-value">testnet.nearblocks.io</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="doc__note">
          The registry also holds entries from launches that predate the deposit fix. Those
          tokens cannot be read; the console shows them as unreadable instead of hiding them.
        </p>
      </article>

      <p className="doc__foot mono-label">
        Built from docs/SPEC.md in the repository. <Link to="/projects">Open the registry →</Link>
      </p>
    </section>
  );
}
