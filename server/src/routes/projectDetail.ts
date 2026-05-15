import { Router } from "express";
import { ProjectRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import {
  updateProjectSchema,
  addMemberSchema,
  updateMemberRoleSchema,
} from "../validation/schemas.js";
import { requireProjectAdmin } from "../middleware/projectAccess.js";
import { paramString } from "../util/paramString.js";

const router = Router({ mergeParams: true });

router.get("/", async (req, res) => {
  const projectId = paramString(req.params, "projectId")!;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { tasks: true } },
    },
  });
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json({
    ...project,
    myRole: req.projectAccess!.role,
  });
});

router.patch("/", requireProjectAdmin, async (req, res) => {
  const parsed = updateProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }
  const projectId = paramString(req.params, "projectId")!;
  const data = parsed.data;
  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }
  const project = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
    },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  });
  res.json(project);
});

router.delete("/", requireProjectAdmin, async (req, res) => {
  const projectId = paramString(req.params, "projectId")!;
  await prisma.project.delete({ where: { id: projectId } });
  res.status(204).send();
});

router.get("/members", async (req, res) => {
  const projectId = paramString(req.params, "projectId")!;
  const members = await prisma.projectMember.findMany({
    where: { projectId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  res.json(members);
});

router.post("/members", requireProjectAdmin, async (req, res) => {
  const parsed = addMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }
  const projectId = paramString(req.params, "projectId")!;
  const { email, role } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    res.status(404).json({ error: "No user with that email" });
    return;
  }
  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });
  if (existing) {
    res.status(409).json({ error: "User is already a member" });
    return;
  }
  const member = await prisma.projectMember.create({
    data: { projectId, userId: user.id, role },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  res.status(201).json(member);
});

router.patch("/members/:userId", requireProjectAdmin, async (req, res) => {
  const parsed = updateMemberRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }
  const projectId = paramString(req.params, "projectId")!;
  const targetUserId = paramString(req.params, "userId")!;
  const { role } = parsed.data;

  const target = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: targetUserId } },
  });
  if (!target) {
    res.status(404).json({ error: "Member not found" });
    return;
  }

  if (target.role === ProjectRole.ADMIN && role === ProjectRole.MEMBER) {
    const adminCount = await prisma.projectMember.count({
      where: { projectId, role: ProjectRole.ADMIN },
    });
    if (adminCount <= 1) {
      res.status(400).json({ error: "Cannot demote the only admin" });
      return;
    }
  }

  const updated = await prisma.projectMember.update({
    where: { id: target.id },
    data: { role },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  res.json(updated);
});

router.delete("/members/:userId", requireProjectAdmin, async (req, res) => {
  const projectId = paramString(req.params, "projectId")!;
  const targetUserId = paramString(req.params, "userId")!;
  const me = req.user!.id;

  const target = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: targetUserId } },
  });
  if (!target) {
    res.status(404).json({ error: "Member not found" });
    return;
  }

  if (target.role === ProjectRole.ADMIN) {
    const adminCount = await prisma.projectMember.count({
      where: { projectId, role: ProjectRole.ADMIN },
    });
    if (adminCount <= 1) {
      res.status(400).json({ error: "Cannot remove the only admin" });
      return;
    }
  }

  if (targetUserId === me) {
    res.status(400).json({ error: "Use leave project or transfer admin before removing yourself" });
    return;
  }

  await prisma.projectMember.delete({ where: { id: target.id } });
  res.status(204).send();
});

export default router;
