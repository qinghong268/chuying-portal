import { existsSync } from "node:fs";
import { join } from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import { authRouter } from "./routes/auth";
import { contentRouter } from "./routes/content";
import { activitiesRouter } from "./routes/activities";
import { enrollmentsRouter } from "./routes/enrollments";
import { progressRouter } from "./routes/progress";
import { coursesRouter } from "./routes/courses";
import { joinRouter } from "./routes/join";
import { pointAppsRouter } from "./routes/pointApps";
import { pointTemplatesRouter } from "./routes/pointTemplates";
import { adminPointAppsRouter } from "./routes/admin/pointApps";
import { adminPointTypesRouter } from "./routes/admin/pointTypes";
import { adminContentRouter } from "./routes/admin/content";
import { adminJoinRouter } from "./routes/admin/join";
import { adminActivitiesRouter } from "./routes/admin/activities";
import { adminUsersRouter } from "./routes/admin/users";
import {
  adminPermissionPackagesRouter,
  adminGrantsRouter,
} from "./routes/admin/permissions";
import { adminDashboardRouter } from "./routes/admin/dashboard";

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth", authRouter);
  app.use("/api/content", contentRouter);
  app.use("/api/activities", activitiesRouter);
  app.use("/api/activities", enrollmentsRouter);
  app.use("/api/activities", progressRouter);
  app.use("/api/courses", coursesRouter);
  app.use("/api/join", joinRouter);
  app.use("/api/point-type-templates", pointTemplatesRouter);
  app.use("/api/me", pointAppsRouter);
  app.use("/api/admin/point-applications", adminPointAppsRouter);
  app.use("/api/admin/point-types", adminPointTypesRouter);
  app.use("/api/admin/content", adminContentRouter);
  app.use("/api/admin/join-applications", adminJoinRouter);
  app.use("/api/admin/activities", adminActivitiesRouter);
  app.use("/api/admin/users", adminUsersRouter);
  app.use("/api/admin/permission-packages", adminPermissionPackagesRouter);
  app.use("/api/admin/admin-grants", adminGrantsRouter);
  app.use("/api/admin/dashboard", adminDashboardRouter);

  const clientDist =
    process.env.CLIENT_DIST ?? join(__dirname, "..", "..", "client", "dist");
  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) {
        next();
        return;
      }
      res.sendFile(join(clientDist, "index.html"));
    });
  }

  return app;
}
