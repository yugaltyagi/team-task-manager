import type { Request, Response, NextFunction } from "express";
import { ProjectRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { paramString } from "../util/paramString.js";

export type ProjectAccess = {
  projectId: string;
  role: ProjectRole;
  membershipId: string;
};

declare global {
  namespace Express {
    interface Request {
      projectAccess?: ProjectAccess;
    }
  }
}

/** Loads membership for :projectId. Sets req.projectAccess or 403/404. */
export async function requireProjectMember(req: Request, res: Response, next: NextFunction) {
  const userId = req.user?.id;
  const projectId = paramString(req.params, "projectId");
  if (!userId || !projectId) {
    res.status(400).json({ error: "Missing project context" });
    return;
  }
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!member) {
    res.status(404).json({ error: "Project not found or access denied" });
    return;
  }
  req.projectAccess = {
    projectId,
    role: member.role,
    membershipId: member.id,
  };
  next();
}

export function requireProjectAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.projectAccess?.role !== ProjectRole.ADMIN) {
    res.status(403).json({ error: "Admin role required" });
    return;
  }
  next();
}
