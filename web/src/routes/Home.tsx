import { Link } from "react-router";

import { LivePanel } from "../components/LivePanel";
import { Mascot } from "../components/Mascot";
import { PillLink } from "../components/Pill";
import { ProjectCard } from "../components/ProjectCard";
import { Reveal } from "../components/Reveal";
import { DOCS_LINKS, FACTORY_ID } from "../lib/config";
import { fetchProjectCount, fetchProjects } from "../lib/factory";
import { formatBps, formatInt, formatToken } from "../lib/format";
import { useAsync, useNow } from "../lib/hooks";
import { loadProjects } from "../lib/projects";

const FEATURES = [
  {
    n: "01",
    title: "Launch from a file",
    body: "You paste a markdown file, the app hashes it, and the hash is stored on-chain. The factory never fetches a URL.",
  },
  {
    n: "02",
    title: "Fixed supply, zero premine",
    body: "Supply is set at launch and never grows. Every token in circulation was mined against a proof the contract checked.",
  },
  {
    n: "03",
    title: "Proof, not permission",
    body: "A claim needs a preimage whose SHA-256 prefix sits below the level target. No oracle sits in the middle.",
  },
  {
    n: "04",
    title: "Forty levels",
    body: "Each level unlocks 2.5% of supply and makes the next puzzle 1.10x heavier. Level 40 is the whole supply, never reached in a demo.",
  },
  {
    n: "05",
    title: "Fee split, 50 / 30 / 20",
    body: "Every claim costs 0.05 NEAR: half to liquidity, 30% to the creator, 20% to the protocol. Anyone can trigger the payout; nobody can redirect it.",
  },
  {
    n: "06",
    title: "Threshold or nothing",
    body: "Hit the threshold by the deadline and the launch is Valid. Miss it and it is Failed, emission stops, and the remainder is recorded as burned.",
  },
  {
    n: "07",
    title: "Per-account brake",
    body: "One account can take a capped slice per level, and the cap resets when the ladder moves. A single miner cannot sweep a level.",
  },
  {
    n: "08",
    title: "Immutable tokens",
    body: "Project accounts hold no access keys. Rules cannot be patched in place; a fix ships as a new token version, and old projects keep running.",
  },
];

export function Home() {
  const now = useNow(30_000);
  const registry = useAsync(async () => {
    const [records, count] = await Promise.all([fetchProjects(0, 12), fetchProjectCount()]);
    return { views: await loadProjects(records), count };
  }, []);

  const views = registry.data?.views ?? [];
  const count = registry.data?.count ?? 0;
  const loading = registry.loading;
  // The bar is about work in progress. A closed project keeps its share, but it
  // is no longer minting, so only fall back to one when nothing is open.
  const open = views.filter(
    (view) => view.status === "Mining" && view.record.deadline_ns / 1e6 > now,
  );
  const lead = open.length
    ? [...open].sort((a, b) => b.minedBps - a.minedBps)[0]
    : (views.at(-1) ?? null);
  const leadLabel = open.length > 0 ? "minting progress" : "final result";

  return (
    <>
      <section className="hero">
        <div className="hero__glow" aria-hidden="true" />
        <div className="hero__copy">
          <span className="chip chip--soft">
            <span className="chip__dot" aria-hidden="true" />
            Live on NEAR testnet
          </span>
          <h1>
            Tokens that exist{" "}
            <br />
            only after the <span className="accent">work</span>
          </h1>
          <p className="hero__lede">
            A markdown file becomes a fixed-supply token. Agents mine SHA-256 proofs to unlock
            it, level by level, until the deadline decides whether the launch was real.
          </p>
          <div className="hero__actions">
            <PillLink to="/launch">Launch a token</PillLink>
            <PillLink to="/projects" variant="ghost">
              Browse projects
            </PillLink>
          </div>
          <div className={loading ? "mint mint--loading" : "mint"}>
            <div className="mint__head">
              <span className="mono-label">
                {leadLabel} · {lead ? lead.record.slug : "registry"}
              </span>
              <span className="mint__pct">{loading ? "—" : formatBps(lead ? lead.minedBps : 0)}</span>
            </div>
            <div
              className="mint__track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round((lead ? lead.minedBps : 0) / 100)}
              aria-label="Minted share of the leading project"
            >
              <span
                className="mint__fill"
                style={{ width: `${(lead ? lead.minedBps : 0) / 100}%` }}
              />
              <span className="mint__ticks" aria-hidden="true" />
            </div>
            <div className="mint__foot">
              <span className="mono-label">
                {loading ? "reading chain…" : `level ${lead ? lead.level : 1} / 40`}
              </span>
              <span className="mono-label">
                {loading
                  ? ""
                  : lead
                    ? `${formatToken((BigInt(lead.record.supply) * BigInt(lead.minedBps)) / 10_000n)} / ${formatToken(lead.record.supply)} minted`
                    : "0 minted"}
              </span>
            </div>
          </div>

          <dl className="hero__facts">
            <div>
              <dt className="mono-label">levels</dt>
              <dd>40</dd>
            </div>
            <div>
              <dt className="mono-label">per level</dt>
              <dd>2.5%</dd>
            </div>
            <div>
              <dt className="mono-label">difficulty</dt>
              <dd>×1.10</dd>
            </div>
            <div>
              <dt className="mono-label">claim fee</dt>
              <dd>0.05 NEAR</dd>
            </div>
          </dl>
        </div>

        <div className="hero__art">
          <div className="hero__ring" aria-hidden="true" />
          <Mascot size={420} className="hero__mascot" />
          <div className="hero__tags">
            <div className="hero__tag">
              <span className="mono-label">level {loading ? "—" : lead ? lead.level : 1} / 40</span>
              <strong>{loading ? "reading…" : `${lead ? formatBps(lead.minedBps) : "0%"} mined`}</strong>
            </div>
            <div className="hero__tag">
              <span className="mono-label">projects on chain</span>
              <strong>{loading ? "—" : formatInt(count)}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="section features">
        <Reveal>
          <div className="section__head">
            <p className="mono-label">How it works</p>
            <h2>Eight rules, no exceptions.</h2>
            <p className="section__lede">
              Everything below is enforced by the token contract, not by a backend. The web app
              only reads and signs.
            </p>
          </div>
        </Reveal>
        <div className="feature-grid">
          {FEATURES.map((feature, index) => (
            <Reveal key={feature.n} delay={index * 40}>
              <article className="feature">
                <span className="feature__n mono-label">{feature.n}</span>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <Reveal>
        <LivePanel projects={views} loading={registry.loading} />
      </Reveal>

      <section className="statband">
        <Reveal>
          <p className="statband__line">
            The leading project has{" "}
            <strong>{lead ? formatBps(lead.minedBps) : "0%"}</strong> of its supply unlocked
            {lead ? ` at level ${lead.level}` : ""}.
          </p>
          <p className="statband__source mono-label">
            source: {FACTORY_ID} · projects(from, limit) → token mined() / supply() · read just
            now
          </p>
        </Reveal>
      </section>

      <section className="section proof">
        <Reveal>
          <div className="section__head section__head--row">
            <div>
              <p className="mono-label">The registry</p>
              <h2>Every project is public from the first block.</h2>
            </div>
            <PillLink to="/projects" variant="ghost" size="sm">
              All {count} projects
            </PillLink>
          </div>
        </Reveal>

        {registry.error ? (
          <p className="notice notice--error">
            The factory did not answer: {registry.error}.{" "}
            <button type="button" className="linkish" onClick={registry.reload}>
              Try again
            </button>
          </p>
        ) : null}

        <div className="proof-grid">
          {views.slice(0, 4).map((project, index) => (
            <Reveal key={project.record.slug} delay={index * 50}>
              <ProjectCard project={project} now={now} />
            </Reveal>
          ))}
          {!registry.loading && views.length === 0 ? (
            <div className="empty">
              <Mascot mood="idle" size={160} decorative />
              <p>No projects yet. The first launch sets the tone.</p>
              <PillLink to="/launch" size="sm">
                Launch the first one
              </PillLink>
            </div>
          ) : null}
        </div>
      </section>

      <section className="section community">
        <Reveal>
          <div className="section__head">
            <p className="mono-label">Keep going</p>
            <h2>Read the rules, then try to break them.</h2>
          </div>
        </Reveal>
        <div className="community-grid">
          <Link className="commcard" to="/docs">
            <span className="mono-label">Docs</span>
            <h3>The .md schema and the contract surface</h3>
            <p>Every view method, every argument, and the level curve in one page.</p>
          </Link>
          <Link className="commcard" to="/docs#agent">
            <span className="mono-label">Agent endpoint</span>
            <h3>Launch and mine from a script</h3>
            <p>An HTTP sketch for agents that would rather talk to a service than a page.</p>
          </Link>
          <a
            className="commcard"
            href={DOCS_LINKS.explorerFactory}
            target="_blank"
            rel="noreferrer"
          >
            <span className="mono-label">Explorer</span>
            <h3>The factory on NEAR testnet</h3>
            <p>Registry writes, deploys and fee payouts, as the chain recorded them.</p>
          </a>
          <a className="commcard" href={DOCS_LINKS.x} target="_blank" rel="noreferrer">
            <span className="mono-label">X</span>
            <h3>Build notes and demo runs</h3>
            <p>Short updates when a ladder moves or a new token version lands.</p>
          </a>
        </div>
      </section>
    </>
  );
}
