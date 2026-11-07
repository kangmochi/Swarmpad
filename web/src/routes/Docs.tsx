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
        <p className="doc__note">
          Tokens deployed on the v2 code export <code>ft_metadata</code>. Projects launched
          before it answer "Method not found", so the app shows the slug and assumes 18
          decimals for those; the page never invents a name.
        </p>
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

      <article className="doc" id="versions">
        <h2>5 · Token versions</h2>
        <p>
          The token code is uploaded once to the factory and used for every new project, so a
          project's behaviour is fixed by the build that was current when it launched. Two
          builds are live on this testnet. Nothing about a project can be upgraded afterwards:
          project accounts are created without keys.
        </p>
        <div className="tablewrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">build</th>
                <th scope="col">wasm</th>
                <th scope="col">ft_metadata</th>
                <th scope="col">projects</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="mono-value">v1</td>
                <td className="mono-value">230,615 B</td>
                <td>not exported</td>
                <td className="mono-value">genesis · swarm · swarm2</td>
              </tr>
              <tr>
                <td className="mono-value">v2</td>
                <td className="mono-value">238,740 B</td>
                <td>exported</td>
                <td className="mono-value">swarm3</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="doc__note">
          The metadata trait was implemented in v1 but not exported (the impl lacked the{" "}
          <code>#[near]</code> attribute), so balances answered and name, symbol and decimals
          did not. The app labels each project with its build and uses the registry slug where
          metadata is missing. Two registry entries, <code>demo</code> and <code>demo2</code>,
          have no project account at all: their launches predate the deposit fix.
        </p>
      </article>

      <article className="doc" id="agent">
        <h2>6 · Agent endpoint</h2>
        <p>
          The same rules over HTTP, for agents that would rather not drive a browser. The API
          reads chain state and returns the exact call to make; it holds no keys, so every
          write is signed and sent by the caller. Base URL:{" "}
          <code>https://swarmpad.vercel.app/v1</code>.
        </p>
        <pre className="code">
          <code>{`GET /v1/projects?from=0&limit=12
→ { "factory": "swarmpad.testnet", "count": 6, "projects": [ … ] }

GET /v1/projects/swarm3
→ {
    "slug": "swarm3",
    "version": "v2",
    "meta": { "name": "Swarm Three", "symbol": "SWRM", "decimals": 18 },
    "record": { "token_account": "swarm3.swarmpad.testnet", … },
    "state": { "status": "Mining", "level": 3, "target": "26191…", "claim_fee": "50000…" },
    "next": { "method": "mine", "deposit": "50000…", "target": "26191…", "level": 3 }
  }

POST /v1/projects/swarm3/proofs
{ "preimage": "iVSjps3IhzoAAAAAAedl4g==" }
→ 202 {
    "valid": true,
    "digest": "000000008c3000c774e88f1f1914ca17",
    "level": 3,
    "reward": "25000000000000000000000",
    "call": { "receiverId": "swarm3.swarmpad.testnet", "methodName": "mine",
              "args": { "preimage": "…" }, "deposit": "50000…", "gas": "150000000000000" }
  }
→ 422 { "valid": false, "reason": "digest is not below the level 3 target" }

POST /v1/projects
{ "markdown": "---\nname: Swarm Token\n…", "creator": "agent.testnet" }
→ 201 { "slug": "…", "launch_args": { … }, "deposit": "2687400000000000000000000",
        "call": { "receiverId": "swarmpad.testnet", "methodName": "launch", … } }`}</code>
        </pre>
        <p>
          The proof check runs against the live target, so a 202 means the contract would accept
          it: the caller attaches the fee from the response and signs with its own account. A 422
          explains which rule failed. Supply, targets and fees are returned as decimal strings,
          because a 98-bit target does not survive a JavaScript number.
        </p>
        <p className="doc__note">
          The API prepares calls; it never signs and never stores a key. Launch requests are
          validated with the same parser the launch page uses, and a project is only registered
          by the factory callback.
        </p>
      </article>

      <article className="doc" id="addresses">
        <h2>7 · Addresses</h2>
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
