import { useState } from "react";

import { Mascot } from "../components/Mascot";
import { PillButton } from "../components/Pill";
import { ProjectCard } from "../components/ProjectCard";
import { PAGE, fetchProjectCount, fetchProjects } from "../lib/factory";
import { formatInt } from "../lib/format";
import { useAsync, useNow } from "../lib/hooks";
import { loadProjects } from "../lib/projects";

export function Projects() {
  const [page, setPage] = useState(0);
  const now = useNow(30_000);
  const state = useAsync(async () => {
    const [records, count] = await Promise.all([
      fetchProjects(page * PAGE, PAGE),
      fetchProjectCount(),
    ]);
    return { views: await loadProjects(records), count };
  }, [page]);

  const views = state.data?.views ?? [];
  const count = state.data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(count / PAGE));

  return (
    <section className="page">
      <div className="page__head">
        <p className="mono-label">Registry</p>
        <h1>Projects, oldest first</h1>
        <p className="page__lede">
          The factory appends one entry per successful launch and never rewrites history. A
          project whose token cannot be read is shown as unreadable rather than hidden.
        </p>
        <p className="page__meta mono-label">
          {state.loading
            ? "reading registry…"
            : `${formatInt(count)} entries · page ${page + 1} of ${pages}`}
        </p>
      </div>

      {state.error ? (
        <p className="notice notice--error">
          The factory did not answer: {state.error}.{" "}
          <button type="button" className="linkish" onClick={state.reload}>
            Try again
          </button>
        </p>
      ) : null}

      {state.loading ? <p className="notice">Reading the registry…</p> : null}

      <div className="proof-grid proof-grid--page">
        {views.map((project) => (
          <ProjectCard key={project.record.slug} project={project} now={now} />
        ))}
      </div>

      {!state.loading && views.length === 0 && !state.error ? (
        <div className="empty">
          <Mascot mood="idle" size={200} decorative />
          <p>No projects on this page.</p>
        </div>
      ) : null}

      <div className="pager">
        <PillButton
          variant="ghost"
          size="sm"
          disabled={page === 0}
          onClick={() => setPage((value) => Math.max(0, value - 1))}
        >
          ← Newer
        </PillButton>
        <span className="mono-label">
          showing {views.length} of {formatInt(count)}
        </span>
        <PillButton
          variant="ghost"
          size="sm"
          disabled={page + 1 >= pages}
          onClick={() => setPage((value) => value + 1)}
        >
          Older →
        </PillButton>
      </div>
    </section>
  );
}
