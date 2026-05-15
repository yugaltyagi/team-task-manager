import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { api } from "@/api/client";

type Member = {
  id: string;
  role: string;
  user: { id: string; name: string; email: string };
};

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  dueDate: string | null;
  assignee: { id: string; name: string; email: string } | null;
  createdBy: { id: string; name: string; email: string };
};

type ProjectDetail = {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  myRole: string;
  owner: { id: string; name: string; email: string };
  members: Member[];
  _count: { tasks: number };
};

const STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { token, user } = useAuth();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"tasks" | "team">("tasks");

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!token || !projectId) return;
    const [p, t] = await Promise.all([
      api<ProjectDetail>(`/api/projects/${projectId}`, { token }),
      api<Task[]>(`/api/projects/${projectId}/tasks`, { token }),
    ]);
    setProject(p);
    setTasks(t);
  }, [token, projectId]);

  useEffect(() => {
    if (!token || !projectId) return;
    let cancelled = false;
    (async () => {
      try {
        await refresh();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load project");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, projectId, refresh]);

  const isAdmin = project?.myRole === "ADMIN";

  async function onAddTask(e: FormEvent) {
    e.preventDefault();
    if (!token || !projectId) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        token,
        body: JSON.stringify({
          title: taskTitle,
          dueDate: taskDue ? new Date(taskDue).toISOString() : null,
        }),
      });
      setTaskTitle("");
      setTaskDue("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function onInvite(e: FormEvent) {
    e.preventDefault();
    if (!token || !projectId) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/projects/${projectId}/members`, {
        method: "POST",
        token,
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      setInviteEmail("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite");
    } finally {
      setBusy(false);
    }
  }

  async function patchTask(taskId: string, body: Record<string, unknown>) {
    if (!token || !projectId) return;
    await api(`/api/projects/${projectId}/tasks/${taskId}`, {
      method: "PATCH",
      token,
      body: JSON.stringify(body),
    });
    await refresh();
  }

  async function deleteTask(taskId: string) {
    if (!token || !projectId) return;
    if (!confirm("Delete this task?")) return;
    await api(`/api/projects/${projectId}/tasks/${taskId}`, { method: "DELETE", token });
    await refresh();
  }

  async function patchMemberRole(userId: string, role: string) {
    if (!token || !projectId) return;
    await api(`/api/projects/${projectId}/members/${userId}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ role }),
    });
    await refresh();
  }

  if (error && !project) return <p className="text-red-400">{error}</p>;
  if (!project) return <p className="text-slate-400">Loading project…</p>;

  const memberUsers = project.members.map((m) => m.user);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">Project</p>
        <h1 className="text-2xl font-semibold text-white">{project.name}</h1>
        {project.description && <p className="mt-2 text-slate-400">{project.description}</p>}
        <p className="mt-2 text-sm text-slate-500">
          You are <span className="text-slate-300">{project.myRole}</span> · Owner: {project.owner.name}
        </p>
      </div>

      {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

      <div className="flex gap-2 border-b border-[var(--color-border)] pb-2">
        {(["tasks", "team"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              setError(null);
            }}
            className={`rounded-lg px-4 py-2 text-sm font-medium capitalize ${
              tab === t ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5"
            }`}
          >
            {t === "tasks" ? "Tasks" : "Team & roles"}
          </button>
        ))}
      </div>

      {tab === "tasks" && (
        <div className="space-y-6">
          <form
            onSubmit={onAddTask}
            className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/50 p-4 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <label className="mb-1 block text-xs uppercase text-slate-500">New task</label>
              <input
                className="w-full rounded-lg border border-[var(--color-border)] bg-[#0a0e14] px-3 py-2 text-white outline-none ring-blue-500/40 focus:ring-2"
                placeholder="Title"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                required
              />
            </div>
            <div className="w-full sm:w-48">
              <label className="mb-1 block text-xs uppercase text-slate-500">Due (optional)</label>
              <input
                type="datetime-local"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[#0a0e14] px-3 py-2 text-white outline-none ring-blue-500/40 focus:ring-2"
                value={taskDue}
                onChange={(e) => setTaskDue(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              Add task
            </button>
          </form>

          <ul className="space-y-2">
            {tasks.length === 0 && (
              <li className="rounded-lg border border-dashed border-[var(--color-border)] py-8 text-center text-slate-500">
                No tasks yet.
              </li>
            )}
            {tasks.map((task) => {
              const canAssign = isAdmin;
              const canDelete = isAdmin || task.createdBy.id === user?.id;
              return (
                <li
                  key={task.id}
                  className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white">{task.title}</p>
                    {task.description && <p className="text-sm text-slate-400">{task.description}</p>}
                    <p className="mt-1 text-xs text-slate-500">
                      Created by {task.createdBy.name}
                      {task.dueDate && ` · Due ${new Date(task.dueDate).toLocaleString()}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="rounded-lg border border-[var(--color-border)] bg-[#0a0e14] px-2 py-1.5 text-sm text-white"
                      value={task.status}
                      onChange={(e) => patchTask(task.id, { status: e.target.value })}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                    <select
                      className="max-w-[10rem] rounded-lg border border-[var(--color-border)] bg-[#0a0e14] px-2 py-1.5 text-sm text-white disabled:opacity-40"
                      disabled={!canAssign}
                      value={task.assignee?.id ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        patchTask(task.id, { assigneeId: v || null });
                      }}
                      title={canAssign ? "Assign teammate" : "Only admins can reassign"}
                    >
                      <option value="">Unassigned</option>
                      {memberUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                    {canDelete && (
                      <button
                        type="button"
                        className="rounded-lg border border-red-500/40 px-2 py-1.5 text-xs text-red-300 hover:bg-red-500/10"
                        onClick={() => deleteTask(task.id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {tab === "team" && (
        <div className="space-y-6">
          {isAdmin && (
            <form
              onSubmit={onInvite}
              className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/50 p-4 sm:flex-row sm:items-end"
            >
              <div className="flex-1">
                <label className="mb-1 block text-xs uppercase text-slate-500">Invite by email</label>
                <input
                  type="email"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[#0a0e14] px-3 py-2 text-white outline-none ring-blue-500/40 focus:ring-2"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase text-slate-500">Role</label>
                <select
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[#0a0e14] px-3 py-2 text-white sm:w-40"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "ADMIN" | "MEMBER")}
                >
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                Add member
              </button>
            </form>
          )}

          <ul className="divide-y divide-[var(--color-border)] overflow-hidden rounded-xl border border-[var(--color-border)]">
            {project.members.map((m) => (
              <li key={m.id} className="flex flex-col gap-2 bg-[var(--color-surface-2)]/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-white">{m.user.name}</p>
                  <p className="text-sm text-slate-500">{m.user.email}</p>
                </div>
                {isAdmin ? (
                  <select
                    className="rounded-lg border border-[var(--color-border)] bg-[#0a0e14] px-2 py-1.5 text-sm text-white"
                    value={m.role}
                    onChange={(e) => patchMemberRole(m.user.id, e.target.value)}
                  >
                    <option value="MEMBER">Member</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                ) : (
                  <span className="text-sm text-slate-400">{m.role}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
