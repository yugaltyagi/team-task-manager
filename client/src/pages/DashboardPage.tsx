import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { api } from "@/api/client";

type Task = {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  project: { id: string; name: string };
};

type DashboardData = {
  summary: { total: number; todo: number; inProgress: number; done: number; overdue: number };
  overdue: Task[];
  upcoming: Task[];
  recent: Task[];
};

function statusBadge(status: string) {
  const map: Record<string, string> = {
    TODO: "bg-slate-500/20 text-slate-300",
    IN_PROGRESS: "bg-amber-500/20 text-amber-300",
    DONE: "bg-emerald-500/20 text-emerald-300",
  };
  return map[status] ?? "bg-slate-500/20";
}

export function DashboardPage() {
  const { token } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const d = await api<DashboardData>("/api/dashboard", { token });
        if (!cancelled) {
          setData({
            summary: d.summary ?? { total: 0, todo: 0, inProgress: 0, done: 0, overdue: 0 },
            overdue: d.overdue ?? [],
            upcoming: d.upcoming ?? [],
            recent: d.recent ?? [],
          });
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
        <p className="text-red-400">{error}</p>
        <p className="mt-2 text-sm text-slate-400">
          Make sure the API is running (<code className="text-slate-300">npm run dev</code> in{" "}
          <code className="text-slate-300">server/</code>) and PostgreSQL is connected.
        </p>
      </div>
    );
  }
  if (!data) {
    return <p style={{ color: "#94a3b8" }}>Loading your workspace…</p>;
  }

  const cards = [
    { label: "My tracked tasks", value: data.summary.total, hint: "assigned or created by you" },
    { label: "To do", value: data.summary.todo, hint: "" },
    { label: "In progress", value: data.summary.inProgress, hint: "" },
    { label: "Done", value: data.summary.done, hint: "" },
    { label: "Overdue", value: data.summary.overdue, hint: "not completed, past due" },
  ];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
        <p className="mt-1 text-slate-400">Tasks you own or are assigned across all projects.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/60 p-4"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{c.label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-white">{c.value}</p>
            {c.hint && <p className="mt-1 text-xs text-slate-500">{c.hint}</p>}
          </div>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-lg font-medium text-white">Overdue</h2>
          <ul className="mt-3 space-y-2">
            {data.overdue.length === 0 && (
              <li className="rounded-lg border border-dashed border-[var(--color-border)] px-4 py-6 text-center text-sm text-slate-500">
                Nothing overdue. Great job.
              </li>
            )}
            {data.overdue.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2"
              >
                <div className="min-w-0">
                  <Link
                    to={`/projects/${t.project.id}`}
                    className="truncate text-sm font-medium text-white hover:text-blue-300"
                  >
                    {t.title}
                  </Link>
                  <p className="truncate text-xs text-slate-500">{t.project.name}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${statusBadge(t.status)}`}>
                  {t.status.replace("_", " ")}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-medium text-white">Upcoming</h2>
          <ul className="mt-3 space-y-2">
            {data.upcoming.length === 0 && (
              <li className="rounded-lg border border-dashed border-[var(--color-border)] px-4 py-6 text-center text-sm text-slate-500">
                No upcoming deadlines.
              </li>
            )}
            {data.upcoming.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]/40 px-3 py-2"
              >
                <div className="min-w-0">
                  <Link
                    to={`/projects/${t.project.id}`}
                    className="truncate text-sm font-medium text-white hover:text-blue-300"
                  >
                    {t.title}
                  </Link>
                  <p className="truncate text-xs text-slate-500">
                    {t.project.name}
                    {t.dueDate && ` · due ${new Date(t.dueDate).toLocaleDateString()}`}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${statusBadge(t.status)}`}>
                  {t.status.replace("_", " ")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section>
        <h2 className="text-lg font-medium text-white">Recent activity</h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-[var(--color-border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#0a0e14] text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Task</th>
                <th className="px-4 py-2 font-medium">Project</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {data.recent.map((t) => (
                <tr key={t.id} className="bg-[var(--color-surface-2)]/30">
                  <td className="px-4 py-2">
                    <Link to={`/projects/${t.project.id}`} className="text-white hover:text-blue-300">
                      {t.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-400">{t.project.name}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${statusBadge(t.status)}`}>
                      {t.status.replace("_", " ")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
