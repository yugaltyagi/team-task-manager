import { Router } from "express";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { registerSchema, loginSchema } from "../validation/schemas.js";
import { requireAuth, signToken } from "../middleware/auth.js";

const router = Router();

function dbErrorMessage(err: unknown): string {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2021") return "Database tables missing. Run prisma migrate deploy on the server.";
    if (err.code === "P2002") return "Email already registered";
  }
  if (err instanceof Prisma.PrismaClientInitializationError) {
    return "Cannot connect to database. Check DATABASE_URL on Railway.";
  }
  return "Registration failed";
}

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }
  const { email, password, name } = parsed.data;

  try {
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email: email.toLowerCase(), passwordHash, name },
      select: { id: true, email: true, name: true, createdAt: true },
    });
    const token = signToken({ id: user.id, email: user.email, name: user.name });
    res.status(201).json({ user, token });
  } catch (err) {
    console.error("POST /api/auth/register failed:", err);
    const message = dbErrorMessage(err);
    const status =
      err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" ? 409 : 500;
    res.status(status).json({ error: message });
  }
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }
  const { email, password } = parsed.data;

  try {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    const token = signToken({ id: user.id, email: user.email, name: user.name });
    res.json({
      user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt },
      token,
    });
  } catch (err) {
    console.error("POST /api/auth/login failed:", err);
    res.status(500).json({ error: dbErrorMessage(err) });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

export default router;
