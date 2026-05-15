import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { api } from "@/api/client";

type ProjectRow = {
  role: string;
  joinedAt: string;
  project: {
    id: string;
    name: string;
    description: string | null;
    owner: { id: string; name: string; email: string };
    _count: { tasks: number };
  };
};

export function ProjectsPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!token) return;
    const list = await api<ProjectRow[]>("/api/projects", { token });
    setRows(list);
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      }
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/projects", {
        method: "POST",
        token,
        body: JSON.stringify({ name, description: description || null }),
      });
      setName("");
      setDescription("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Projects</h1>
        <p className="mt-1 text-slate-400">Create a project and invite teammates by email.</p>
      </div>

      <form
        onSubmit={onCreate}
        className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/50 p-6"
      >
        <h2 className="text-sm font-medium text-white">New project</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs uppercase text-slate-500">Name</label>
            <input
              className="w-full rounded-lg border border-[var(--color-border)] bg-[#0a0e14] px-3 py-2 text-white outline-none ring-blue-500/40 focus:ring-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs uppercase text-slate-500">Description (optional)</label>
            <textarea
              className="w-full rounded-lg border border-[var(--color-border)] bg-[#0a0e14] px-3 py-2 text-white outline-none ring-blue-500/40 focus:ring-2"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create project"}
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#0a0e14] text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Project</th>
              <th className="px-4 py-3 font-medium">Your role</th>
              <th className="px-4 py-3 font-medium">Tasks</th>
              <th className="px-4 py-3 font-medium">Owner</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  No projects yet. Create one above.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.project.id} className="bg-[var(--color-surface-2)]/30">
                <td className="px-4 py-3">
                  <Link to={`/projects/${r.project.id}`} className="font-medium text-white hover:text-blue-300">
                    {r.project.name}
                  </Link>
                  {r.project.description && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{r.project.description}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-300">{r.role}</td>
                <td className="px-4 py-3 tabular-nums text-slate-400">{r.project._count.tasks}</td>
                <td className="px-4 py-3 text-slate-400">{r.project.owner.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
