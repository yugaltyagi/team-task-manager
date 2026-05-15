import { Router } from "express";
import { ProjectRole, TaskStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { createTaskSchema, updateTaskSchema } from "../validation/schemas.js";
import { paramString } from "../util/paramString.js";

const router = Router({ mergeParams: true });

router.get("/tasks", async (req, res) => {
  const projectId = paramString(req.params, "projectId")!;
  const status = req.query.status as string | undefined;
  const where = {
    projectId,
    ...(status && Object.values(TaskStatus).includes(status as TaskStatus)
      ? { status: status as TaskStatus }
      : {}),
  };
  const tasks = await prisma.task.findMany({
    where,
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
  res.json(tasks);
});

router.post("/tasks", async (req, res) => {
  const parsed = createTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }
  const projectId = paramString(req.params, "projectId")!;
  const userId = req.user!.id;
  const { title, description, status, dueDate, assigneeId } = parsed.data;

  if (assigneeId) {
    const assigneeMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: assigneeId } },
    });
    if (!assigneeMember) {
      res.status(400).json({ error: "Assignee must be a project member" });
      return;
    }
  }

  const task = await prisma.task.create({
    data: {
      title,
      description: description ?? null,
      status: status ?? TaskStatus.TODO,
      dueDate: dueDate ?? null,
      projectId,
      assigneeId: assigneeId ?? null,
      createdById: userId,
    },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
  res.status(201).json(task);
});

function canMemberEditTask(
  role: ProjectRole,
  userId: string,
  task: { assigneeId: string | null; createdById: string }
): boolean {
  if (role === ProjectRole.ADMIN) return true;
  return task.assigneeId === userId || task.createdById === userId;
}

router.patch("/tasks/:taskId", async (req, res) => {
  const parsed = updateTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }
  const projectId = paramString(req.params, "projectId")!;
  const taskId = paramString(req.params, "taskId")!;
  const userId = req.user!.id;
  const role = req.projectAccess!.role;

  const task = await prisma.task.findFirst({
    where: { id: taskId, projectId },
  });
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  if (!canMemberEditTask(role, userId, task)) {
    res.status(403).json({ error: "You can only edit tasks assigned to you or created by you" });
    return;
  }

  const data = parsed.data;
  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  if (role !== ProjectRole.ADMIN) {
    if (data.assigneeId !== undefined) {
      res.status(403).json({ error: "Only admins can change assignee" });
      return;
    }
  }

  if (data.assigneeId) {
    const assigneeMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: data.assigneeId } },
    });
    if (!assigneeMember) {
      res.status(400).json({ error: "Assignee must be a project member" });
      return;
    }
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.dueDate !== undefined && { dueDate: data.dueDate }),
      ...(data.assigneeId !== undefined && { assigneeId: data.assigneeId }),
    },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
  res.json(updated);
});

router.delete("/tasks/:taskId", async (req, res) => {
  const projectId = paramString(req.params, "projectId")!;
  const taskId = paramString(req.params, "taskId")!;
  const userId = req.user!.id;
  const role = req.projectAccess!.role;

  const task = await prisma.task.findFirst({
    where: { id: taskId, projectId },
  });
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  if (role !== ProjectRole.ADMIN && task.createdById !== userId) {
    res.status(403).json({ error: "Only admins or the task creator can delete" });
    return;
  }

  await prisma.task.delete({ where: { id: taskId } });
  res.status(204).send();
});

export default router;
