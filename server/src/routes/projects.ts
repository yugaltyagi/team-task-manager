import { Router } from "express";
import { ProjectRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { createProjectSchema } from "../validation/schemas.js";
import { requireProjectMember } from "../middleware/projectAccess.js";
import projectDetailRouter from "./projectDetail.js";
import tasksRouter from "./tasks.js";

const router = Router();

router.get("/", async (req, res) => {
  const userId = req.user!.id;
  const memberships = await prisma.projectMember.findMany({
    where: { userId },
    include: {
      project: {
        include: {
          owner: { select: { id: true, name: true, email: true } },
          _count: { select: { tasks: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(
    memberships.map((m) => ({
      role: m.role,
      joinedAt: m.createdAt,
      project: m.project,
    }))
  );
});

router.post("/", async (req, res) => {
  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }
  const userId = req.user!.id;
  const { name, description } = parsed.data;

  const project = await prisma.$transaction(async (tx) => {
    const p = await tx.project.create({
      data: {
        name,
        description: description ?? null,
        ownerId: userId,
      },
    });
    await tx.projectMember.create({
      data: { projectId: p.id, userId, role: ProjectRole.ADMIN },
    });
    return tx.project.findUnique({
      where: { id: p.id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    });
  });

  res.status(201).json(project);
});

const scoped = Router({ mergeParams: true });
scoped.use(requireProjectMember);
scoped.use(projectDetailRouter);
scoped.use(tasksRouter);

router.use("/:projectId", scoped);

export default router;
