import { Router } from "express";
import { TaskStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.get("/", async (req, res) => {
  const userId = req.user!.id;
  const now = new Date();

  const memberships = await prisma.projectMember.findMany({
    where: { userId },
    select: { projectId: true },
  });
  const projectIds = memberships.map((m) => m.projectId);
  if (projectIds.length === 0) {
    res.json({
      summary: { total: 0, todo: 0, inProgress: 0, done: 0, overdue: 0 },
      overdue: [],
      upcoming: [],
      recent: [],
    });
    return;
  }

  const myTasks = await prisma.task.findMany({
    where: {
      projectId: { in: projectIds },
      OR: [{ assigneeId: userId }, { createdById: userId }],
    },
    include: {
      project: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
  });

  const counts = {
    total: myTasks.length,
    todo: myTasks.filter((t) => t.status === TaskStatus.TODO).length,
    inProgress: myTasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length,
    done: myTasks.filter((t) => t.status === TaskStatus.DONE).length,
    overdue: myTasks.filter(
      (t) =>
        t.dueDate &&
        t.dueDate < now &&
        t.status !== TaskStatus.DONE
    ).length,
  };

  const overdue = myTasks.filter(
    (t) => t.dueDate && t.dueDate < now && t.status !== TaskStatus.DONE
  );

  const upcoming = myTasks
    .filter((t) => t.dueDate && t.dueDate >= now && t.status !== TaskStatus.DONE)
    .slice(0, 10);

  res.json({
    summary: counts,
    overdue,
    upcoming,
    recent: myTasks.slice(0, 15),
  });
});

export default router;
