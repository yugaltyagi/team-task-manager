import "dotenv/config";
import express from "express";
import cors from "cors";
import authRouter from "./routes/auth.js";
import projectsRouter from "./routes/projects.js";
import dashboardRouter from "./routes/dashboard.js";
import { requireAuth } from "./middleware/auth.js";
import { prisma } from "./lib/prisma.js";

const app = express();
const PORT = Number(process.env.PORT) || 4000;

const allowedOrigins = process.env.CLIENT_ORIGIN?.split(",").map((o) => o.trim()) ?? [
  "http://localhost:5173",
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, service: "team-task-manager-api", database: "connected" });
  } catch (err) {
    console.error("Health check DB error:", err);
    res.status(503).json({
      ok: false,
      service: "team-task-manager-api",
      database: "disconnected",
      hint: "Set DATABASE_URL on Railway and ensure prisma migrate deploy ran.",
    });
  }
});

app.use("/api/auth", authRouter);
app.use("/api/projects", requireAuth, projectsRouter);
app.use("/api/dashboard", requireAuth, dashboardRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
